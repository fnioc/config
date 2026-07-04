// Behavior tests for CommandLineConfigurationSource/Provider -- flattens
// process.argv-style tokens into the case-insensitive store every
// ConfigurationProvider maintains.
//
// Migrated from the pre-monorepo test/sources/command-line.test.ts: every
// existing fail-loud assertion is kept unchanged (just re-pointed at the new
// source/provider construction), plus new tests for the construction-time
// switchMappings validation and the "/switch" -> "--switch" rewrite.

import { describe, expect, test } from "bun:test";
import { CommandLineConfigurationSource } from "../src/command-line-configuration-source";

/** Builds a provider from `args`/`switchMappings`, loads it, and returns the
 * flattened key -> value map it produced (via getChildKeys + tryGet, since
 * ConfigurationProvider has no public "dump everything" API -- so we walk the
 * top-level and nested keys explicitly through the same public surface a
 * ConfigurationRoot would use). */
function load(
  args: readonly string[],
  switchMappings?: Record<string, string>,
): Record<string, string> {
  const source = new CommandLineConfigurationSource(args, { switchMappings });
  const provider = source.build({} as never);
  provider.load();

  const result: Record<string, string> = {};
  const visit = (parentPath: string | undefined): void => {
    for (const childKey of provider.getChildKeys([], parentPath)) {
      const fullKey = parentPath === undefined ? childKey : `${parentPath}:${childKey}`;
      const [found, value] = provider.tryGet(fullKey);
      if (found) {
        result[fullKey] = value;
      }
      visit(fullKey);
    }
  };
  visit(undefined);

  return result;
}

describe("CommandLineConfigurationProvider -- long form (--Key)", () => {
  test("parses --Key value (space-separated) into the flat map", () => {
    expect(load(["--Key", "value"])).toEqual({ Key: "value" });
  });

  test("parses --Key=value into the flat map", () => {
    expect(load(["--Key=value"])).toEqual({ Key: "value" });
  });

  test("keeps a colon-delimited key verbatim for nesting", () => {
    expect(load(["--Server:Port", "8080"])).toEqual({ "Server:Port": "8080" });
  });

  test("keeps a colon-delimited key verbatim with = form too", () => {
    expect(load(["--Server:Port=8080"])).toEqual({ "Server:Port": "8080" });
  });

  test("a later duplicate key overrides an earlier one", () => {
    expect(load(["--Key", "first", "--Key", "second"])).toEqual({ Key: "second" });
  });

  test("throws when a long-form switch has no trailing value", () => {
    expect(() => load(["--Key"])).toThrow();
  });

  test("a valueless switch followed by another --switch is boolean-true, not corrupted", () => {
    // `--Verbose --Port 8080`: without a guard, `--Verbose` swallows the
    // following `--Port` token as its value -> {Verbose: "--Port"} and Port
    // is dropped entirely, corrupting both flags. A switch whose next token
    // is itself a long switch has no value -- treat it as a boolean flag
    // ("true", so downstream boolean coercion binds it to `true`).
    expect(load(["--Verbose", "--Port", "8080"])).toEqual({
      Verbose: "true",
      Port: "8080",
    });
  });

  test("a boolean flag followed by a registered short switch is boolean-true, not swallowed as its value", () => {
    // `--Verbose -p 8080` with `-p` registered: without a guard covering
    // short-switch tokens, `--Verbose` swallows `-p` as its own value ->
    // {Verbose: "-p"} and Port is dropped, same corruption as the --Port
    // case above but via a registered short switch instead of a long one.
    expect(load(["--Verbose", "-p", "8080"], { "-p": "Port" })).toEqual({
      Verbose: "true",
      Port: "8080",
    });
  });

  test("preserves a negative-number value instead of treating it as a switch", () => {
    // `--Offset -5`: `-5` is dash-prefixed like a switch, but it's a
    // legitimate negative-number value, not another switch -- must still
    // bind Offset="-5" rather than treating --Offset as a valueless boolean.
    expect(load(["--Offset", "-5"])).toEqual({ Offset: "-5" });
  });

  test('a lone "--" terminates option parsing (standard argv convention)', () => {
    // `--` is the end-of-options marker: everything after it is positional
    // (and this source ignores positionals). It must not be treated as an
    // empty-key long switch that swallows the following token.
    expect(load(["--Key", "value", "--", "--NotASwitch", "ignored"])).toEqual({
      Key: "value",
    });
  });
});

describe("CommandLineConfigurationProvider -- short form (-x)", () => {
  test("parses a mapped short switch with a space-separated value", () => {
    expect(load(["-p", "8080"], { "-p": "Server:Port" })).toEqual({
      "Server:Port": "8080",
    });
  });

  test("parses a mapped short switch with an = value", () => {
    expect(load(["-p=8080"], { "-p": "Server:Port" })).toEqual({
      "Server:Port": "8080",
    });
  });

  test("throws synchronously naming an unmapped short switch", () => {
    expect(() => load(["-z", "value"])).toThrow(/-z/);
  });

  test("throws for an unmapped short switch even when other switches are mapped", () => {
    expect(() => load(["-p", "8080", "-z", "value"], { "-p": "Server:Port" }))
      .toThrow(/-z/);
  });
});

describe("CommandLineConfigurationProvider -- positional args", () => {
  test("ignores bare positional args with no leading dash", () => {
    expect(load(["serve", "--Key", "value", "now"])).toEqual({ Key: "value" });
  });

  test("returns an empty map when argv has only positional args", () => {
    expect(load(["serve", "now"])).toEqual({});
  });
});

describe("CommandLineConfigurationProvider -- mixed", () => {
  test("combines long form, mapped short form, and ignored positionals", () => {
    expect(
      load(["deploy", "--Env=prod", "-p", "8080", "extra"], { "-p": "Server:Port" }),
    ).toEqual({
      Env: "prod",
      "Server:Port": "8080",
    });
  });
});

describe("CommandLineConfigurationSource -- switchMappings validation", () => {
  test("throws at construction when a mapping key does not start with '-'", () => {
    expect(() => new CommandLineConfigurationSource([], { switchMappings: { p: "Server:Port" } }))
      .toThrow(/-/);
  });

  test("throws at construction for case-insensitive duplicate mapping keys", () => {
    expect(() =>
      new CommandLineConfigurationSource([], {
        switchMappings: { "-p": "Server:Port", "-P": "Other:Key" },
      })
    ).toThrow();
  });

  test("does not throw for distinct mapping keys with mixed casing", () => {
    expect(() =>
      new CommandLineConfigurationSource([], {
        switchMappings: { "-p": "Server:Port", "-q": "Other:Key" },
      })
    ).not.toThrow();
  });

  test("validation runs even for an empty args array (construction-time, not parse-time)", () => {
    // The malformed table is rejected before load() ever runs -- confirms
    // this isn't accidentally deferred to parse time.
    expect(() => new CommandLineConfigurationSource([], { switchMappings: { p: "x" } }))
      .toThrow();
  });
});

describe("CommandLineConfigurationProvider -- '/switch' rewrite", () => {
  test("rewrites a leading '/switch' to '--switch' (long form)", () => {
    expect(load(["/Key", "value"])).toEqual({ Key: "value" });
  });

  test("rewrites '/Key=value' the same as '--Key=value'", () => {
    expect(load(["/Key=value"])).toEqual({ Key: "value" });
  });

  test("does not rewrite a value token that happens to start with '/'", () => {
    // Only a token examined in SWITCH position gets rewritten -- the value
    // consumed by the preceding switch is untouched. The rewrite only applies
    // while classifying the current position as a switch, not when reading
    // the following value.
    expect(load(["--Path", "/usr/bin"])).toEqual({ Path: "/usr/bin" });
  });

  test("a '/switch' followed by another switch is boolean-true, matching '--switch' behavior", () => {
    expect(load(["/Verbose", "--Port", "8080"])).toEqual({
      Verbose: "true",
      Port: "8080",
    });
  });
});
