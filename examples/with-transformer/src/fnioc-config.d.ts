// Loads @fnioc/config's OWN `declare module "@fnioc/di"` augmentation --
// mirrors @fnioc/transformer's augment.ts pattern exactly, but contributes a
// FOURTH type-driven authoring method (`addConfig<T>`) alongside the
// existing `add<I>(C)` / `add<I>(fn)` / `addValue<I>(v)` trio. Different
// package, same mechanism: this only type-checks with @fnioc/config's
// transformer in the program, which is the truth at runtime tool-free too.
import "@fnioc/config";

// DESIGN SKETCH -- what @fnioc/config's real augment.ts would contain. Not
// shipped from here; shown so the shape of the addConfig<T> overloads is
// concrete for this review, not just described in prose.
//
// declare module "@fnioc/di" {
//   interface ServiceManifestClass<Scopes extends string = "singleton"> {
//     /**
//      * Type-driven config registration -- lowers to
//      * `addFactory("<derived-token>", () => bindConfig(root, <generated-schema>, opts)).as(...)`.
//      * The type param drives BOTH the token (Rule 1, shared with add<I>(C))
//      * and the generated bind schema. Never runs post-transform.
//      */
//     addConfig<T>(root: ConfigurationRoot, opts?: BindOptions): AddBuilder<Scopes>;
//     /**
//      * Explicit-token config registration -- for named instances of the same
//      * shape. The type param STILL drives the generated schema; only the
//      * token is pinned by hand. Mirrors add(token, C) vs add<I>(C).
//      */
//     addConfig<T>(token: string, root: ConfigurationRoot, opts?: BindOptions): AddBuilder<Scopes>;
//   }
// }
