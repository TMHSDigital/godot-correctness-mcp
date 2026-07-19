# preload vs load

Choose between `preload` and `load` by *when* you need the resource and whether
the path is known at compile time.

## preload: compile-time, known path

`preload` resolves at parse time and bakes the dependency into the script. Use it
for assets you always need and whose path is a constant literal.

```gdscript
const BulletScene := preload("res://actors/bullet.tscn")

func fire() -> void:
	var b := BulletScene.instantiate()
	add_child(b)
```

Because `preload` needs a constant literal path, prefer it over `load("res://...")`
with a hardcoded string — it fails at compile time (not runtime) if the path is
wrong, and it does not re-hit the disk cache each call.

## load: runtime, dynamic path

Use `load` when the path is computed (e.g. from a data resource) or the asset is
optional/lazy.

```gdscript
func spawn_from(item: ItemData) -> Node:
	var scene := load(item.scene_path) as PackedScene  # path came from data
	return scene.instantiate() if scene else null
```

Data-driven paths like `item.scene_path` are exactly what
[[data-driven-resources]] and the `validate_registries` tool guard: a dangling
`res://` path here is invisible until this line runs. Validate registries in CI
so a bad path fails the build, not the player's session.

## Do not preload inside hot loops

`preload` is resolved once at parse time regardless of where it appears, but keep
`load()` calls out of `_process`/`_physics_process`; cache the `PackedScene` once.
See [[typed-gdscript]].
