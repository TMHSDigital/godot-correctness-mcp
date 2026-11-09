# Changelog

All notable changes to godot-correctness-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- `gdcorrect lint --fix` re-lints only the files it rewrote instead of the whole project (#130)

## [0.2.0] - 2026-11-08

### Added

- Inline suppression comments: `# gdcorrect-ignore[rule]`, `# gdcorrect-ignore-file[rule]`, with `unused-suppression` reporting (#33)
- `gdcorrect --format sarif` emits SARIF 2.1.0 for GitHub code scanning annotations (#34)
- `gdcorrect --write-baseline` / `--baseline` so existing projects can gate CI on new findings only (#53)
- `project-input-action-undefined`: flags input action names used in scripts that are not defined in `project.godot` (#50)
- Scene checks `scene-missing-sub-resource-id`, `scene-node-parent-missing`, and `scene-connection-method-missing`; ExtResource refs inside `[sub_resource]` sections are now checked too (#52)
- `uid://` references resolve through `.uid` sidecars, `.import` files, and scene headers: new `scene-ext-resource-path-stale`, `scene-ext-resource-uid-mismatch`, and `scene-ext-resource-uid-unknown` checks, and `uid://` main scenes and autoloads are validated (#35)
- `removed-api-usage` lint rule: flags engine API removed (or call arity broken) in a target Godot version, using the symbol DBs (#36)
- `scene-node-path-missing`: literal `$Path` / `get_node()` paths are checked against the scenes that attach the script (#54)
- `removed-api-usage` reads its target version from `project.godot` (`config/features`), so it works with no config; `lint` output reports `godotVersion` (#91)
- `list_rules` MCP tool and `gdcorrect rules [projectPath]`: every rule id with its default and per-project settings (#94)
- Optional `baseline` argument on `lint_project`, the `validate_*` tools, and `project_report` (#95)
- Machine-applicable fixes: `fix` in JSON, `fixes` in SARIF, and `gdcorrect lint --fix` (`missing-onready`, plain `get_node("A/B")` to `$A/B`) (#96)
- `gdcorrect --fail-on error|warning|info|none`, `--help`, `--version` (#92, #76)
- `gdcorrect lint --files` / `--changed-since <git-ref>` to lint only named or changed files (#93)
- `registry-dir-missing`: `registryDirs` entries that do not exist or lie outside the project are reported; `res://` prefixes are accepted (#63)

### Fixed

- `removed-api-usage` no longer counts comments as call arguments or override parameters, so multi-line calls and overrides with interleaved comments get the correct arity (#108)
- `--changed-since` includes tracked and untracked paths containing non-ASCII characters, quotes, tabs, or newlines (#99)
- `gdcorrect lint --files` reports each path that matches no included script (missing, outside the project root, excluded, or not a `.gd` file) on stderr, resolves paths against the project root as well as the current directory, and matches on-disk casing. **Behavior change:** when none of the `--files` paths match (and `--changed-since` is not given), the run exits 2 instead of passing, so a pre-commit hook that passes every staged file should filter to `*.gd` first (#98)
- The example config sets `registryDirs` to `[]`, so copying it into a fresh project no longer reports a missing `resources/registries` (#114)
- `gdcorrect` exits 2 for a nonexistent project directory instead of reporting a clean run
- Added `THIRD_PARTY_NOTICES.md` (shipped in the npm package) with the MIT notices for the bundled tree-sitter-gdscript grammar and Godot API data (#26)
- `delta-misuse` no longer flags acceleration or damping (`velocity += get_gravity() * delta`, `velocity.x = move_toward(...)`), including Godot's own CharacterBody templates (#58)
- `gdcorrect` no longer exits 127 on Windows after parsing some scripts (#59)
- Inherited scenes: children added under base-scene nodes are no longer reported as `scene-node-parent-missing` (#60)
- `rules` config (enable/severity) and inline suppressions now apply to scene, project, and registry findings; the documented `# gdcorrect-ignore[scene-node-path-missing]` no longer produces `unused-suppression` (#62)
- Unknown rule ids and rule-config keys in the config are rejected instead of silently ignored (#63)
- `missing-onready` accepts `@onready` on the line above the declaration (#64)
- `scene-connection-method-missing` finds methods declared with same-line annotations (`@rpc func ...`) (#65)
- `uid://` resolution is shared by scenes, registry scripts, and autoloads: registry scripts with a stale path but valid uid resolve, and unknown-uid autoloads are reported (#66)
- Quoted `project.godot` keys (`"move left"={...}`) are parsed, so such input actions are no longer flagged as undefined (#67)
- Unknown CLI options, missing option values, and extra arguments exit 2 instead of being ignored (#68)
- Input actions built at runtime (`prefix + "_jump"`) are no longer flagged (#69)
- API lookup: kind-filtered and de-duplicated suggestions, inherited `Owner.member` queries, `api_diff` suggestions, and no crash on names like `constructor` (#70)
- `gdcorrect-ignore` text inside a string literal no longer suppresses findings (#81)
- `await null` is reported by `await-misuse` (#80)
- Resolved `res://` paths outside the project root count as missing and are never read
- Scene and resource parsing stays fast on malformed input

### Changed

- `include` now scopes every `.gd` check (lint, node paths, input actions), not just lint (#87)
- Releases are tagged only after CI passes on the commit, and publishing runs the full CI gates (#71)
- Faster lint and project reports: rules share one AST traversal, project files are walked and read once per run, and connection checks cache scripts (#85, #86, #87)
- `server_info` reports the API pillar available when any pinned symbol DB is present (#89)
- Baseline files are validated; `fromVersion` for `removed-api-usage` is validated (#89)
- `zod` upgraded to 4.x (#77)
- SECURITY.md points to GitHub private vulnerability reporting (#72)
- ESLint (typescript-eslint) runs in CI; CI also smoke-tests the packed npm artifact (#90, #84)

## [0.1.2] - 2026-11-03

### Fixed

- The MCP server and `gdcorrect` now run when launched through npm's bin symlinks (Linux/macOS `npx` and global installs previously exited 0 without doing anything) (#31)
- README and docs CI snippets use `npx -y -p @tmhs/godot-correctness-mcp gdcorrect ...` so they run the CLI rather than the MCP server (#32)
- Parsed tree-sitter trees are freed after linting, so long-running servers no longer grow WASM memory; a failed grammar load can be retried (#38)
- `validate_scenes` checks `ExtResource` references in node `instance=` attributes and nested inside arrays/dictionaries (#37)
- Multi-line values report their first line; duplicate unquoted ext_resource ids are named in the message (#55)
- Tool failures return `isError: true`; nonexistent project roots fail clearly (#40)
- `lint_file` loads config from the project root (nearest ancestor with `godot-correctness.config.json` or `project.godot`) and reports project-relative paths, matching `lint_project` (#39)

### Changed

- Invalid config files report the file and the offending key; unknown top-level keys are rejected
- `lint_project` prunes excluded directories instead of walking them, and always skips `.git/` and `.godot/` (#41)
- Scene tool JSON includes `root`, matching the CLI output
- Tools are registered with `registerTool` and carry read-only annotations; version and kind enums derive from the pinned version list (#47)
- `@modelcontextprotocol/sdk` floor raised to `^1.32.2` (#42)
- Node.js 22 or newer is required (Node 20 is end-of-life); CI runs Node 22/24 on Ubuntu and Windows (#43, #44)
- `mcp-tools.json` is generated with `npm run generate:tools` and checked by a test (#48)

## [0.1.1] - 2026-11-03

### Changed

- Publish via npm trusted publishing (OIDC) from `publish.yml`; first publish validates the trusted publisher connection

## [0.1.0] - 2026-07-19

### Added

- stdio MCP server with the `server_info` health tool
- GDScript linting via a committed tree-sitter grammar: `lint_file` and `lint_project` with 8 rules (`delta-misuse`, `get-node-in-process`, `missing-onready`, `untyped-declaration`, `await-misuse`, `stringly-nodepath`, `connect-without-disconnect`, `float-grid-equality`) and `godot-correctness.config.json`
- Cross-version API tools for Godot 4.4 and 4.5 from committed symbol databases: `api_symbol_lookup`, `api_class_summary`, `api_diff`
- Scene, project, and registry analysis: `validate_scenes`, `validate_project_config`, `validate_registries`, `project_report`
- `gdcorrect` CLI (`lint`, `validate-scenes`, `validate-project`, `validate-registries`, `report`) with CI exit codes and `json`/`pretty` output
- `skill://` MCP resources with curated Godot 4.x guidance
- CI/CD workflows (ci, release, publish, drift-check, pages, stale, label-sync) and a GitHub Pages site
