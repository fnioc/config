# TODO

Running list of unfinished work and reviewed-but-not-yet-acted-on decisions
for `@fnconfig/config`, as of 2026-07-01. Ground truth is always the GitHub
issues/PRs linked below — this is a snapshot, not the source of truth.

## Blocking — needs maintainer action

- **`NPM_TOKEN` repo secret is invalid/missing.** `publish-next` CI fails
  with `EINVALIDNPMTOKEN`; nothing has ever been published to npm
  (confirmed via `npm view` — 404). Needs the package claimed on npm
  and/or a valid token set in repo secrets, or OIDC trusted-publisher
  configured.
- **`.github/workflows/auto-merge.yml`'s `enable-auto-merge` job never
  sets `GH_TOKEN`.** Auto-merge has never actually worked in this repo
  (exit 4 every time). Every PR so far has been merged by hand
  (`gh pr merge --squash --delete-branch` after confirming
  `verify: SUCCESS`). Needs `AUTOMERGE_PAT` (or similar) wired into the
  workflow.
- **Once `NPM_TOKEN` is fixed:** promoting `@next` → `@latest` is a
  manual gate (the `production` environment, reviewer-approval-gated)
  and must be run by the maintainer. Nothing has been promoted; this
  stays untouched by design.

## Feature work — parked

**Issue [#7](https://github.com/fnioc/config/issues/7) —
`addConfig<T>()` binding sugar.** Superseded by the standalone
direction on the `@fnconfig` scope. The original design coupled the
sugar to an external dependency-injection framework and a compile-time
transformer — both of which this library no longer depends on — so the
questions that blocked it (which DI surface to target, transformer
compatibility, mono- vs. multi-repo packaging, and an `addConfig`
naming collision with the transformer's method-detection) are all moot.
Parked pending a fresh design that fits the no-framework,
no-transformer model.

## Deferred, no blocker, not started

- **Issue [#1](https://github.com/fnioc/config/issues/1)** —
  live-reload / config monitoring (file-watch, re-bind on change). No
  design yet.
- **Post-configure hook.** Mentioned in the PR #4 shipping log as
  backlog; no design yet.

## Reviewed architecture decisions (confirmed by maintainer 2026-07-01, no changes needed)

Baked into the shipped MVP (PRs #4/#5/#6). Revisit only if a real need
surfaces:

- **Last-source-wins flat merge** (not deep merge) across JSON/env/CLI
  sources.
- **Case-insensitive resolution everywhere** — keys, sections,
  `opts.section` — meaning two differently-cased keys can never coexist
  as distinct entries.
- **`ConfigBindError` aggregates every problem** into one throw instead
  of failing on the first bad field.
- **`SchemaFor<T>` compile-time checking is the only safety mechanism in
  the MVP** — no independent runtime schema-validation layer; bad values
  are only caught by `bindConfig`'s coercion.
- **Fix-forward instead of revert** for the PR #4 premature-merge
  incident — the merge stayed, review findings shipped as follow-up PRs
  #5/#6 rather than reverting and redoing.
- **Draft PR #2 closed as superseded** rather than reconciled, since
  the standalone example shipped for real in PR #4 and collided with
  the sketch.
