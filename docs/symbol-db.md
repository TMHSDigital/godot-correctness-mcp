# Godot symbol database

The API lookup pillar (`api_symbol_lookup`, `api_class_summary`, `api_diff`) reads
compact, gzipped symbol databases committed under [`data/`](../data):

| File | Godot version | Release tag | Archive SHA-256 |
|------|---------------|-------------|-----------------|
| `data/godot-4.4.symbols.json.gz` | 4.4.1 | `4.4.1-stable` | `1c729738f42e43036a7147838aa9fa56d62101cf90884f315e1ab525e8e69d61` |
| `data/godot-4.5.symbols.json.gz` | 4.5.2 | `4.5.2-stable` | `3766090865330ab2a0ed33594520394b711c620b1378f9223904faeef60f2f14` |

Each `.gz` decompresses to a JSON object whose exact provenance (full version,
release tag, and the SHA-256 of the archive it was generated from) is recorded in
its `meta` block. The schema lives in
[`src/symbols/schema.ts`](../src/symbols/schema.ts).

## Design

The databases are derived from `godot --headless --dump-extension-api`
(`extension_api.json`, ~6 MB each) and trimmed to only what lookup and diffing
need: classes and inheritance; methods (name, args, arg types, defaults, return
type, and static/virtual/const flags); properties; signals; enums; constants;
builtin classes; utility functions; global enums; and singletons. Hashes, memory
offsets, class sizes, and native structures are dropped. The result gzips to
~280 KB per version.

## Generation is local-only; CI never runs Godot

CI validates the committed artifacts instead of regenerating them
(`npm run validate:artifacts`, wired into `ci.yml`): each `.gz` is decompressed,
parsed, schema-validated, and its version label is checked. No Godot binary,
network, or editor is ever required in CI or at server runtime.

## Regenerating the artifacts

You need the pinned Godot binaries locally. This repo was built against the
official `godotengine/godot-builds` **non-mono** (GDScript-only) win64 console
builds. Acquire a version if you do not have it:

```bash
gh release download 4.4.1-stable --repo godotengine/godot-builds \
  --pattern "Godot_v4.4.1-stable_win64.exe.zip" --dir E:/godot-toolchain
# unzip, then verify:
E:/godot-toolchain/godot-4.4.1/Godot_v4.4.1-stable_win64_console.exe --version
# -> 4.4.1.stable.official.<hash>
```

Then run the generator (dev-only, via `tsx`). Pass the archive SHA-256 so it is
recorded in the DB metadata:

```bash
npx tsx scripts/generate-symbol-db.ts \
  --godot "E:/godot-toolchain/godot-4.4.1/Godot_v4.4.1-stable_win64_console.exe" \
  --label 4.4 --tag 4.4.1-stable \
  --archive-name Godot_v4.4.1-stable_win64.exe.zip \
  --archive-sha256 1c729738f42e43036a7147838aa9fa56d62101cf90884f315e1ab525e8e69d61

npx tsx scripts/generate-symbol-db.ts \
  --godot "E:/godot-toolchain/godot-4.5.2/Godot_v4.5.2-stable_win64_console.exe" \
  --label 4.5 --tag 4.5.2-stable \
  --archive-name Godot_v4.5.2-stable_win64.exe.zip \
  --archive-sha256 3766090865330ab2a0ed33594520394b711c620b1378f9223904faeef60f2f14
```

The generator dumps the extension API into a temp directory, transforms it,
validates the result against the schema, and writes the gzipped DB to `data/`.
Finally, validate before committing:

```bash
npm run validate:artifacts
```

## Bumping a pinned version

To move a minor line to a newer patch (e.g. 4.5.2 -> 4.5.3): download the new
build, regenerate with the new `--tag`/`--archive-sha256`, update the table
above, and commit the new `.gz`. Bump `SCHEMA_VERSION` in `src/symbols/schema.ts`
only when the DB shape itself changes.
