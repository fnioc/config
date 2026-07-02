
/// <summary>
/// Specifies the key name for a configuration property.
/// </summary>
export class ConfigurationKeyNameDecorator {
    /// <summary>
    /// Initializes a new instance of <see cref="ConfigurationKeyNameAttribute"/>.
    /// </summary>
    /// <param name="name">The key name.</param>
    constructor(name: string) {
        this.#name = name;
    }

    /// <summary>
    /// Gets the key name for a configuration property.
    /// </summary>
    get name() {
        return this.#name;
    }


    readonly #name: string;

}
