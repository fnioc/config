// Ported Microsoft.Extensions.Configuration.Abstractions surface.
//
// ConfigurationKeyNameDecorator is intentionally NOT re-exported (nor kept):
// it was a reflection-attribute stand-in with no reflection to back it and no
// consumer anywhere in this codebase.

export * from './abstractions'
export * as configPath from './configuration-path'
