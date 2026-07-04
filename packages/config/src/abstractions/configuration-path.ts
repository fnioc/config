
function isIterable(value: any): value is Iterable<any> {
    // A string is itself iterable (over its characters), so it must be
    // excluded here -- otherwise a single variadic string argument to
    // `combine` (e.g. `combine("Host")`) is mistaken for the
    // Iterable<string> overload and exploded into per-character segments
    // (or, for a single-character string, recurses forever).
    return value != null && typeof value !== "string" && !!value[Symbol.iterator];
}

/// <summary>
/// Provides utility methods and constants for manipulating Configuration paths.
/// </summary>

/// <summary>
/// The delimiter ":" used to separate individual keys in a path.
/// </summary>
export const KeyDelimiter = ":";

/// <summary>
/// Combines path segments into one path.
/// </summary>
/// <param name="pathSegments">The path segments to combine.</param>
/// <returns>The combined path.</returns>
export function combine(...pathSegments: string[]): string;
export function combine(pathSegments: Iterable<string>): string;
export function combine(...args: [pathSegments: Iterable<string>] | [...pathSegments: string[]]) {
    if (args.length === 1 && isIterable(args[0])) {
        return combine(...Array.from(args[0]));
    }
    return Array.from(args).join(KeyDelimiter);
}

/// <summary>
/// Extracts the last path segment from the path.
/// </summary>
/// <param name="path">The path.</param>
/// <returns>The last path segment of the path.</returns>
// [return: NotNullIfNotNull(nameof(path))]
export function getSectionKey(path?: string) {
    if (!path?.trim()) {
        return path;
    }

    const lastDelimiterIndex = path.lastIndexOf(':');
    return lastDelimiterIndex < 0 ? path : path.substring(lastDelimiterIndex + 1);
}

/// <summary>
/// Extracts the path corresponding to the parent node for a given path.
/// </summary>
/// <param name="path">The path.</param>
/// <returns>The original path minus the last individual segment found in it. Null if the original path corresponds to a top level node.</returns>
export function getParentPath(path?: string) {
    if (!path?.trim()) {
        return null;
    }

    const lastDelimiterIndex = path.lastIndexOf(':');
    return lastDelimiterIndex < 0 ? null : path.substring(0, lastDelimiterIndex);
}
