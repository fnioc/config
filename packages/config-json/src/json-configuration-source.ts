// JsonConfigurationSource -- builds a JsonConfigurationProvider bound to a
// path + the file-existence/optionality options. Mirrors dotnet/runtime's
// Microsoft.Extensions.Configuration.Json.JsonConfigurationSource, minus the
// shared FileConfigurationSource base class (folded in directly -- see the
// plan's rationale for not replicating Microsoft's FileExtensions package for
// a single file-based provider).

import type { IConfigurationBuilder, IConfigurationProvider, IConfigurationSource } from "@fnioc/config";
import { JsonConfigurationProvider } from "./json-configuration-provider";

/** Options accepted by {@link JsonConfigurationSource}'s constructor. */
export interface JsonConfigurationSourceOptions {
  /**
   * When `true`, a missing file yields an empty provider instead of
   * throwing. Malformed JSON in a file that *does* exist always throws,
   * regardless of this flag -- "optional" only covers file absence, not
   * file validity.
   */
  optional?: boolean;
}

/**
 * A {@link IConfigurationSource} that reads a JSON file from disk (resolved
 * relative to `process.cwd()`) and flattens it into the case-insensitive
 * key/value store shared by every {@link ConfigurationProvider}.
 */
export class JsonConfigurationSource implements IConfigurationSource {
  public readonly path: string;
  public readonly optional: boolean;

  public constructor(path: string, opts?: JsonConfigurationSourceOptions) {
    this.path = path;
    this.optional = opts?.optional ?? false;
  }

  public build(_builder: IConfigurationBuilder): IConfigurationProvider {
    return new JsonConfigurationProvider(this);
  }
}
