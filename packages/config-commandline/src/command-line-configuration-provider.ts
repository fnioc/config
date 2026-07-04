// CommandLineConfigurationProvider -- flattens argv-style tokens (e.g.
// `process.argv.slice(2)`) into the case-insensitive store every
// ConfigurationProvider maintains. Long `--Key value` / `--Key=value`
// switches, plus short `-x` switches that must be pre-registered via
// switchMappings (validated at construction time -- see
// command-line-configuration-source.ts).
//
// This is this repo's pre-existing, already-tested fail-loud parse loop:
// an unmapped short switch (with no "=") or any switch with no trailing
// value is a thrown error, not a silently dropped entry -- a CLI
// configuration source should error on unparseable input, not silently drop
// config the caller thought they'd supplied.
//
// One rewrite runs on top of that fail-loud baseline: "/switch" is treated
// the same as "--switch" ("'/SomeSwitch' is equivalent to '--SomeSwitch' when
// interpreting switch mappings"). It applies only to a token being examined
// in switch position (the top of each main-loop iteration) -- never to a
// token consumed as another switch's *value*, so `--Path /usr/bin` is
// untouched.
//
// A `--LongSwitch` with no "=" looks ahead at its next token to decide
// whether it has a value at all: if that token is itself another switch --
// long (`--Foo`), a registered short switch (`-p`), or any other `-`-prefixed
// token that isn't a valid negative number -- the switch is treated as a
// valueless boolean ("true") instead of swallowing the next switch as its
// value. A negative number (`--Offset -5`) is the deliberate carve-out: it
// looks dash-prefixed but is a legitimate value, not a switch.

import { ConfigurationProvider } from "@fnconfig/config";

export class CommandLineConfigurationProvider extends ConfigurationProvider {
  private readonly argv: readonly string[];
  /** Switch mapping lookup, keyed by lower-cased mapping key for
   * case-insensitive matching -- the same folded form the construction-time
   * validation runs against (see command-line-configuration-source.ts). */
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

    // If the next token is itself another switch, this switch has no value of
    // its own -- treat it as a valueless boolean flag ("true") rather than
    // consuming the following switch, which would corrupt both
    // (`["--Verbose", "--Port", "8080"]` -> {Verbose: "--Port"}, Port lost).
    // "Another switch" covers a long switch (`--Foo`), a registered short
    // switch (`-p` when `-p` is a switchMappings key -- otherwise
    // `["--Verbose", "-p", "8080"]` would bind Verbose="-p" and drop Port),
    // and any other `-`-prefixed token that isn't a valid negative number.
    // That last carve-out deliberately leaves negative-number values (e.g.
    // `--Offset -5`) intact -- see looksLikeAnotherSwitch below.
    if (this.looksLikeAnotherSwitch(value)) {
      this.set(rest, "true");
      return index;
    }

    this.set(rest, value);
    return index + 1;
  }

  /** A negative integer or decimal literal, e.g. "-5" or "-3.14". */
  private static readonly NEGATIVE_NUMBER_PATTERN = /^-\d+(\.\d+)?$/;

  /**
   * True when `value` -- the token immediately following a `--LongSwitch`
   * with no `=` -- is itself another switch rather than this switch's value.
   * See the call site in {@link consumeLongSwitch} for why this matters.
   */
  private looksLikeAnotherSwitch(value: string): boolean {
    if (value.startsWith("--")) {
      return true;
    }
    if (!value.startsWith("-")) {
      return false;
    }

    // A registered short switch (allowing for its own "=value" suffix) is
    // always another switch, even on the rare chance it happens to look
    // numeric (e.g. a caller registering "-5" as a switchMappings key).
    const eqIndex = value.indexOf("=");
    const switchName = eqIndex !== -1 ? value.slice(0, eqIndex) : value;
    if (this.foldedSwitchMappings.has(switchName.toLowerCase())) {
      return true;
    }

    // Anything else that's "-"-prefixed is another switch UNLESS it's a
    // valid negative number, which is a legitimate value, not a switch.
    return !CommandLineConfigurationProvider.NEGATIVE_NUMBER_PATTERN.test(value);
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
