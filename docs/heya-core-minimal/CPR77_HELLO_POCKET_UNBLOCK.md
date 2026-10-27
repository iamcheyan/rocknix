# CPR77 Hello PocketJS build and runtime validation

Status: app build and bounded headless runtime lifecycle verified; H700 physical display not tested.

## Source and workspace identity

- PocketJS baseline: upstream commit `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f` (kept as a separate clean source worktree).
- ROCKNIX report branch: `cpr80/hello-report`, based on `feat/pocketjs-runtime-kms` at `a1e3a50422798ef918b83abda1b6b81eca33709f`.
- PocketJS changes were made in an isolated worktree based on the exact commit above. CPR78's `.work/pocketjs-upstream` was not modified; its pre-existing untracked `apps/rocknix-hello/` was copied as input.
- No package, H700 startup, or session lifecycle files were changed.

## Root cause with source evidence

The supported CLI path is shared by `pocket check` and `pocket compile`: `tools/pocket.ts:150-183` parses the manifest and runtime profile, then calls `checkAppTypes()` with `apps/rocknix-hello/tsconfig.json` at lines 178-182. `compile` returns only for `check`; otherwise it runs `tools/build.ts` and packages JS/PAK at lines 185 onward. Neither command calls `checkProjectTypes()`.

`checkAppTypes()` at `framework/compiler/app-check.ts:46-72` builds an ephemeral config that `extends` the supplied tsconfig, then at lines 103-123 writes it beside that config. It parses and creates the TypeScript program at lines 125-145. It does not derive PocketJS aliases from the framework subpath registry.

By contrast, `checkProjectTypes()` at `framework/compiler/app-check.ts:218-245` constructs its own config, sets `baseUrl` to `frameworkRoot`, and populates `paths` from `frameworkPaths()`. `frameworkPaths()` at lines 188-203 reads `SUBPATHS` and maps each public specifier to its exact source file. The three expected paths are `@pocketjs/framework/solid` → `framework/src/index.ts`, `@pocketjs/framework/solid/components` → `framework/src/components.ts`, and `@pocketjs/framework/input` → `framework/src/input-api.ts`.

The copied app's `tsconfig.json` replaced inherited `paths` with only `@pocketjs/framework/*: ../../framework/src/*` and `*: ../../node_modules/*`. The narrow wildcard maps `solid` to nonexistent `framework/src/solid`, and similarly misses the prefixed components path; it also does not reliably preserve the root's exact `input` alias. This is the cause of all three reproduced TS2307 errors. Removing the app-level `compilerOptions.paths` lets the inherited root config resolve the aliases. The initial source diagnosis is validated by the before/after CLI runs below.

After aliases resolved, TypeScript exposed a separate app error: `BTN.CONFIRM` does not exist. The input API exports button constants including `BTN.CROSS`; the sample now uses `BTN.CROSS`.

## Patch

The upstream-local fix is intentionally app-local: remove the stale app `paths` override and use the framework's canonical inherited alias map; correct the invalid button constant. No PocketJS compiler or ROCKNIX startup changes were needed.

Changed files in the PocketJS worktree:

- `apps/rocknix-hello/tsconfig.json`
- `apps/rocknix-hello/main.tsx`
- `tests/rocknix-hello.test.ts` (regression coverage for aliases and button constant)

Inspect the full patch with `git diff` in the isolated PocketJS worktree, or after delivery with `git show <PocketJS-fix-commit>`. The clean source baseline remains available as commit `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f`.

## Build evidence

Commands were run from the isolated PocketJS worktree with the CPR78-compatible profile config:

```sh
bun tools/pocket.ts check --runtime-config programs/linux-kms/pocket.runtime-config.ts --target product-linux-kms --manifest apps/rocknix-hello/pocket.json
bun tools/pocket.ts compile --runtime-config programs/linux-kms/pocket.runtime-config.ts --target product-linux-kms --manifest apps/rocknix-hello/pocket.json --output hello.pocket
```

Before the fix, both commands exited 1 and emitted exactly:

```text
main.tsx:2:23 TS2307: Cannot find module '@pocketjs/framework/solid' or its corresponding type declarations.
main.tsx:3:43 TS2307: Cannot find module '@pocketjs/framework/solid/components' or its corresponding type declarations.
main.tsx:4:21 TS2307: Cannot find module '@pocketjs/framework/input' or its corresponding type declarations.
```

After removing the alias override, `pocket check` found only the invalid `BTN.CONFIRM`. After correcting it, `pocket check` and `pocket compile` both exited 0. Full non-sensitive logs are retained in ignored `.pocket-build/validation/cpr80/run1/` in that worktree (`check-final.log`, `compile-final.log`, and `tests.log`). The compile reported 58 modules, 10 generated style records, three font atlases, a 145,696-byte PAK, and a 170,245-byte JS bundle (with package NUL terminator: 170,246 bytes).

Artifact: `apps/rocknix-hello/hello.pocket`, 317,944 bytes, SHA-256 `3c03dd912054b6379421eda188bde753476a29977d555cf868253649a2b38942`.

The package decoder accepted the file and reported a `product-linux-kms` variant, host ABI 12, with identity (60 bytes), plan (1,145 bytes), JS (170,246 bytes), and PAK (145,696 bytes) sections. Runtime `--check` independently admitted it against the CPR78 runtime profile.

## Runtime lifecycle

The host is Debian without an H700 DRM device. The CPR78 build artifact is x86-64, so it was copied (not moved or modified) into the isolated validation output and run locally. `programs/linux-kms/src/main.rs:31-64` documents `--headless` and bounded `--frames`; lines 161-189 use an in-memory framebuffer and diagnostic input, while lines 245-263 boot, tick, call `runtime.shutdown()`, and exit after the frame count.

Observed commands/results:

```text
pocket-linux-kms --package hello.pocket --check
package admitted: hello.pocket (product-linux-kms)

pocket-linux-kms --package hello.pocket --headless --frames 5
completed 5 logical ticks; 800x600; product-linux-kms
exit status: 0
```

The process returned normally and no `pocket-linux-kms` process remained. This verifies guest boot/tick/shutdown through the supported headless backend; it does not verify a visible first frame, DRM/KMS presentation, controller input, or H700 hardware. Those require a real H700 display/runtime build. No long-running process was left on a framebuffer.

## Checks

- `pocket check`: pass.
- `pocket compile`: pass; non-empty valid package produced.
- `bun test tests/rocknix-hello.test.ts tests/app-check.test.ts`: 11 pass, 0 fail.
- Runtime package admission: pass.
- Five-tick headless guest lifecycle and normal exit: pass.
- Physical H700 DRM display and visual first frame: not tested on this Debian VM.

PocketJS framework files use the root MIT license. The Linux runtime source has the same MIT workspace license; Pocket3D's separate license does not apply to this Hello app because it uses no Pocket3D assets or modules. `LICENSE.pocketjs-mit` accompanies the package source as the license notice.
