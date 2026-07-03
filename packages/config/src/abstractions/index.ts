// The configuration abstraction types (the IConfiguration* interface family +
// ITryGetResult) now live in the types-only @fnconfig/core package. This barrel
// keeps the runtime configPath helpers (combine / getSectionKey / getParentPath
// / KeyDelimiter) that stay in @fnconfig/config.

export * as configPath from './configuration-path'
