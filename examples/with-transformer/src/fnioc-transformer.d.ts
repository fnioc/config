// Loads @fnioc/transformer's `declare module "@fnioc/di"` augmentation into
// this example's TypeScript program, exactly as ioc's own with-transformer
// example does -- see ioc@fnioc/examples/with-transformer/src/fnioc-transformer.d.ts,
// which this file is a copy of. Needed here because this example ALSO uses
// the plain `add<I>(C)` / `.as<"x">()` authoring forms for ApiServer and
// DatabasePool, not just @fnioc/config's addConfig<T>().
import "@fnioc/transformer";

declare const TOK: unique symbol;
export type Inject<T, K extends string> = T & { readonly [TOK]?: K };
