// CommandLineConfigurationProvider -- flattens argv-style tokens (e.g.
// `process.argv.slice(2)`) into the case-insensitive store every
// ConfigurationProvider maintains. Long `--Key value` / `--Key=value`
// switches, plus short `-x` switches that must be pre-registered via
// switchMappings (validated at construction time -- see
// command-line-configuration-source.ts).
//
// This is this repo's pre-existing, already-tested fail-loud parse loop
// (ported verbatim from the pre-monorepo `CommandLineSource`), deliberately
// KEPT rather than reverted to match Microsoft's real
// CommandLineConfigurationProvider.Load(), which silently ignores both an
// unmapped short switch (with no "=") and any switch with no trailing value
// -- confirmed against the real dotnet/runtime source this session. That's
// back-compat baggage, not a virtue: a CLI configuration source should error
// on unparseable input, not silently drop config the caller thought they'd
// supplied.
//
// The ONE behavior adopted from Microsoft on top of the kept baseline is the
// "/switch" -> "--switch" rewrite (real dotnet/runtime comment: "'/SomeSwitch'
// is equivalent to '--SomeSwitch' when interpreting switch mappings"). It
// applies only to a token being examined in switch position (the top of each
// main-loop iteration) -- never to a token consumed as another switch's
// *value*, so `--Path /usr/bin` is untouched. This matches the real
// source, which only rewrites `currentArg` at the point where it's
// classifying the current enumerator position as a switch, not when it reads
// the following value via a second `MoveNext()`.

import { ConfigurationProvider } from "@fnconfig/config";

export class CommandLineConfigurationProvider extends ConfigurationProvider {
  private readonly argv: readonly string[];
  /** Switch mapping lookup, keyed by lower-cased mapping key for
   * case-insensitive matching -- mirrors Microsoft's switchMappings
   * dictionary, which is itself `StringComparer.OrdinalIgnoreCase`-backed
   * (the same dictionary construction-time validation runs against; see
   * `GetValidatedSwitchMappingsCopy` in the real source). */
  private readonly foldedSwitchMappings: Map<string, string>;

  public constructor(argv: readonly string[], switchMappings: Record<string, string>) {
    super();
    this.argv = argv;
    this.foldedSwitchMappings = new Map(
      Object.entries(switchMappings).map(([key, value]) => [key.toLowerCase(), value]),
    );
  }

  public override load(): void {
    const argv = this.argv;

    for (let i = 0; i < argv.length; i++) {
      let token = argv[i];
      if (token === undefined) {
        continue;
      }

      // A lone "--" is the standard end-of-options marker: everything after
      // it is positional (and this source ignores positionals). Stop parsing
      // rather than treating "--" as an empty-key long switch that swallows
      // the following token. Checked BEFORE the "/switch" rewrite since "--"
      // does not start with "/" anyway, but kept first for clarity/parity
      // with the pre-monorepo baseline.
      if (token === "--") {
        break;
      }

      // "/switch" -> "--switch": Windows-style switch notation, normalized
      // only at switch-position (never applied to a value token -- see the
      // module doc comment above).
      if (token.startsWith("/")) {
        token = `--${token.slice(1)}`;
      }

      if (token.startsWith("--")) {
        i = this.consumeLongSwitch(token, argv, i);
        continue;
      }

      if (token.startsWith("-")) {
        i = this.consumeShortSwitch(token, argv, i);
        continue;
      }

      // Bare positional arg (no leading dash) -- ignored.
    }
  }

  /** Handles a `--Key value` / `--Key=value` token; returns the new index. */
  private consumeLongSwitch(
    token: string,
    argv: readonly string[],
    index: number,
  ): number {
    const rest = token.slice(2);
    const eqIndex = rest.indexOf("=");

    if (eqIndex !== -1) {
      const key = rest.slice(0, eqIndex);
      this.set(key, rest.slice(eqIndex + 1));
      return index;
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(
        `Missing value for command-line switch "${token}" -- expected "${token} <value>" or "${token}=<value>"`,
      );
    }

    // If the next token is itself a long switch (`--Foo`), this switch has no
    // value of its own -- treat it as a valueless boolean flag ("true")
    // rather than consuming the following switch, which would corrupt both
    // (`["--Verbose", "--Port", "8080"]` -> {Verbose: "--Port"}, Port lost).
    // Restricting the guard to `--` deliberately leaves negative-number
    // values (e.g. `--Offset -5`) intact.
    if (value.startsWith("--")) {
      this.set(rest, "true");
      return index;
    }

    this.set(rest, value);
    return index + 1;
  }

  /** Handles a mapped `-x value` / `-x=value` token; returns the new index. */
  private consumeShortSwitch(
    token: string,
    argv: readonly string[],
    index: number,
  ): number {
    const eqIndex = token.indexOf("=");
    const switchName = eqIndex !== -1 ? token.slice(0, eqIndex) : token;
    const mappedKey = this.foldedSwitchMappings.get(switchName.toLowerCase());

    if (mappedKey === undefined) {
      throw new Error(
        `Unmapped command-line switch "${switchName}" -- register it in switchMappings before it can be used`,
      );
    }

    if (eqIndex !== -1) {
      this.set(mappedKey, token.slice(eqIndex + 1));
      return index;
    }

    const value = argv[index + 1];
    if (value === undefined) {
      throw new Error(
        `Missing value for command-line switch "${switchName}" -- expected "${switchName} <value>" or "${switchName}=<value>"`,
      );
    }

    this.set(mappedKey, value);
    return index + 1;
  }
}
