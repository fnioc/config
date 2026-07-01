// Behavior tests for CommandLineSource -- flattens process.argv-style tokens
// into the flat colon-delimited key -> string-value map every ConfigSource
// produces.

import { describe, expect, test } from "bun:test";
import { CommandLineSource } from "../../src/sources/command-line.js";

describe("CommandLineSource -- long form (--Key)", () => {
  test("parses --Key value (space-separated) into the flat map", () => {
    const source = new CommandLineSource(["--Key", "value"]);

    expect(source.load()).toEqual({ Key: "value" });
  });

  test("parses --Key=value into the flat map", () => {
    const source = new CommandLineSource(["--Key=value"]);

    expect(source.load()).toEqual({ Key: "value" });
  });

  test("keeps a colon-delimited key verbatim for nesting", () => {
    const source = new CommandLineSource(["--Server:Port", "8080"]);

    expect(source.load()).toEqual({ "Server:Port": "8080" });
  });

  test("keeps a colon-delimited key verbatim with = form too", () => {
    const source = new CommandLineSource(["--Server:Port=8080"]);

    expect(source.load()).toEqual({ "Server:Port": "8080" });
  });

  test("a later duplicate key overrides an earlier one", () => {
    const source = new CommandLineSource([
      "--Key",
      "first",
      "--Key",
      "second",
    ]);

    expect(source.load()).toEqual({ Key: "second" });
  });

  test("throws when a long-form switch has no trailing value", () => {
    const source = new CommandLineSource(["--Key"]);

    expect(() => source.load()).toThrow();
  });

  test("a valueless switch followed by another --switch is boolean-true, not corrupted", () => {
    // `--Verbose --Port 8080`: without a guard, `--Verbose` swallows the
    // following `--Port` token as its value -> {Verbose: "--Port"} and Port
    // is dropped entirely, corrupting both flags. A switch whose next token
    // is itself a long switch has no value -- treat it as a boolean flag
    // ("true", so downstream boolean coercion binds it to `true`).
    const source = new CommandLineSource(["--Verbose", "--Port", "8080"]);

    expect(source.load()).toEqual({ Verbose: "true", Port: "8080" });
  });

  test('a lone "--" terminates option parsing (standard argv convention)', () => {
    // `--` is the end-of-options marker: everything after it is positional
    // (and this source ignores positionals). It must not be treated as an
    // empty-key long switch that swallows the following token.
    const source = new CommandLineSource([
      "--Key",
      "value",
      "--",
      "--NotASwitch",
      "ignored",
    ]);

    expect(source.load()).toEqual({ Key: "value" });
  });
});

describe("CommandLineSource -- short form (-x)", () => {
  test("parses a mapped short switch with a space-separated value", () => {
    const source = new CommandLineSource(["-p", "8080"], {
      switchMappings: { "-p": "Server:Port" },
    });

    expect(source.load()).toEqual({ "Server:Port": "8080" });
  });

  test("parses a mapped short switch with an = value", () => {
    const source = new CommandLineSource(["-p=8080"], {
      switchMappings: { "-p": "Server:Port" },
    });

    expect(source.load()).toEqual({ "Server:Port": "8080" });
  });

  test("throws synchronously naming an unmapped short switch", () => {
    const source = new CommandLineSource(["-z", "value"]);

    expect(() => source.load()).toThrow(/-z/);
  });

  test("throws for an unmapped short switch even when other switches are mapped", () => {
    const source = new CommandLineSource(["-p", "8080", "-z", "value"], {
      switchMappings: { "-p": "Server:Port" },
    });

    expect(() => source.load()).toThrow(/-z/);
  });
});

describe("CommandLineSource -- positional args", () => {
  test("ignores bare positional args with no leading dash", () => {
    const source = new CommandLineSource(["serve", "--Key", "value", "now"]);

    expect(source.load()).toEqual({ Key: "value" });
  });

  test("returns an empty map when argv has only positional args", () => {
    const source = new CommandLineSource(["serve", "now"]);

    expect(source.load()).toEqual({});
  });
});

describe("CommandLineSource -- mixed", () => {
  test("combines long form, mapped short form, and ignored positionals", () => {
    const source = new CommandLineSource(
      ["deploy", "--Env=prod", "-p", "8080", "extra"],
      { switchMappings: { "-p": "Server:Port" } },
    );

    expect(source.load()).toEqual({
      Env: "prod",
      "Server:Port": "8080",
    });
  });
});
