//FIND: (?<=(?:, )|\()([^,\(\)\s:]+) ([^,\(\)\s:]+)(?=,|\))
//REPLACE: $2: $1

// (?<=^\s*)(\S+) (\S+\(.+\))(?=;$)
// $2: $1
// interface IChangeToken { }
/// <summary>
/// Represents a set of key/value application configuration properties.
/// </summary>
export interface IConfiguration {
    /// <summary>
    /// Gets or sets a configuration value.
    /// </summary>
    /// <param name="key">The configuration key.</param>
    /// <returns>The configuration value.</returns>
    get(key: string): string | undefined;
    set(key: string, value: string): this;
    /// <summary>
    /// Gets a configuration sub-section with the specified key.
    /// </summary>
    /// <param name="key">The key of the configuration section.</param>
    /// <returns>The <see cref="IConfigurationSection"/>.</returns>
    /// <remarks>
    ///     This method will never return <c>null</c>. If no matching sub-section is found with the specified key,
    ///     an empty <see cref="IConfigurationSection"/> will be returned.
    /// </remarks>
    getSection(key: string): IConfigurationSection;

    /// <summary>
    /// Gets the immediate descendant configuration sub-sections.
    /// </summary>
    /// <returns>The configuration sub-sections.</returns>
    getChildren(): Iterable<IConfigurationSection>;

    /// <summary>
    /// Returns a <see cref="IChangeToken"/> that can be used to observe when this configuration is reloaded.
    /// </summary>
    /// <returns>An <see cref="IChangeToken"/> token if this provider supports change tracking; otherwise, <see langword="null" />.</returns>
    // getReloadToken(): IChangeToken;
}
/// <summary>
/// Represents a type used to build application configuration.
/// </summary>
export interface IConfigurationBuilder {
    /// <summary>
    /// Gets a key/value collection that can be used to share data between the <see cref="IConfigurationBuilder"/>
    /// and the registered <see cref="IConfigurationSource"/>s.
    /// </summary>
    // get properties(): Record<string, object>;

    /// <summary>
    /// Gets the sources used to obtain configuration values
    /// </summary>
    get sources(): Set<IConfigurationSource>

    /// <summary>
    /// Adds a new configuration source.
    /// </summary>
    /// <param name="source">The configuration source to add.</param>
    /// <returns>The same <see cref="IConfigurationBuilder"/>.</returns>
    add(source: IConfigurationSource): IConfigurationBuilder;

    /// <summary>
    /// Builds an <see cref="IConfiguration"/> with keys and values from the set of sources registered in
    /// <see cref="Sources"/>.
    /// </summary>
    /// <returns>An <see cref="IConfigurationRoot"/> with keys and values from the registered sources.</returns>
    build(): IConfigurationRoot;
}
/// <summary>
/// Represents a mutable configuration object.
/// </summary>
/// <remarks>
/// It is both an <see cref="IConfigurationBuilder"/> and an <see cref="IConfiguration"/>.
/// As sources are added, it updates its current view of configuration.
/// </remarks>
export interface IConfigurationManager extends IConfiguration, IConfigurationBuilder {
}
/// <summary>
/// Represents the root of an <see cref="IConfiguration"/> hierarchy.
/// </summary>
export interface IConfigurationRoot extends IConfiguration {
    /// <summary>
    /// Forces the configuration values to be reloaded from the underlying <see cref="IConfigurationProvider"/> providers.
    /// </summary>
    reload(): void;

    /// <summary>
    /// Gets the <see cref="IConfigurationProvider"/> providers for this configuration.
    /// </summary>
    get providers(): Iterable<IConfigurationProvider>;
}
/// <summary>
/// Represents a source of configuration key/values for an application.
/// </summary>
export interface IConfigurationSource {
    /// <summary>
    /// Builds the <see cref="IConfigurationProvider"/> for this source.
    /// </summary>
    /// <param name="builder">The <see cref="IConfigurationBuilder"/>.</param>
    /// <returns>An <see cref="IConfigurationProvider"/></returns>
    build(builder: IConfigurationBuilder): IConfigurationProvider;
}
export type ITryGetResult<T> = [success: false] | [success: true, value: T];
/// <summary>
/// Provides configuration key/values for an application.
/// </summary>
export interface IConfigurationProvider {
    /// <summary>
    /// Tries to get a configuration value for the specified key.
    /// </summary>
    /// <param name="key">The key.</param>
    /// <param name="value">When this method returns, contains the value for the specified key.</param>
    /// <returns><see langword="true" /> if a value for the specified key was found, otherwise <see langword="false" />.</returns>
    tryGet(key: string): ITryGetResult<string>

    /// <summary>
    /// Sets a configuration value for the specified key.
    /// </summary>
    /// <param name="key">The key.</param>
    /// <param name="value">The value.</param>
    set(key: string, value?: string): void;

    /// <summary>
    /// Attempts to get an <see cref="IChangeToken"/> for change tracking.
    /// </summary>
    /// <returns>An <see cref="IChangeToken"/> token if this provider supports change tracking, <see langword="null"/> otherwise.</returns>
    // getReloadToken(): IChangeToken;

    /// <summary>
    /// Loads configuration values from the source represented by this <see cref="IConfigurationProvider"/>.
    /// </summary>
    load(): void;

    /// <summary>
    /// Returns the immediate descendant configuration keys for a given parent path based on the data of this
    /// <see cref="IConfigurationProvider"/> and the set of keys returned by all the preceding
    /// <see cref="IConfigurationProvider"/> providers.
    /// </summary>
    /// <param name="earlierKeys">The child keys returned by the preceding providers for the same parent path.</param>
    /// <param name="parentPath">The parent path.</param>
    /// <returns>The child keys.</returns>
    getChildKeys(earlierKeys: Iterable<string>, parentPath?: string): Iterable<string>;
}

/// <summary>
/// Represents a section of application configuration values.
/// </summary>
export interface IConfigurationSection extends IConfiguration {
    /// <summary>
    /// Gets the key this section occupies in its parent.
    /// </summary>
    get key(): string;

    /// <summary>
    /// Gets the full path to this section within the <see cref="IConfiguration"/>.
    /// </summary>
    get path(): string;

    /// <summary>
    /// Gets or sets the section value.
    /// </summary>
    get value(): string | undefined;
    set value(value: string);
}
