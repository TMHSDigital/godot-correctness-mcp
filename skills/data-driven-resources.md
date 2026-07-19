# Data-driven resources and registry loading

Custom `Resource` types let you drive game content from `.tres` files instead of
hardcoding it. Keep resources as **pure data**, load them through a validated
**registry**, and this server's `validate_registries` tool can catch dangling
references before they fail at runtime.

## Keep Resource state data-only

A data resource should hold values, not runtime/session state. Runtime state
(current health, cooldown timers, whoever owns it) belongs on the node that uses
the resource, not on the shared resource instance — resources are shared by
reference, so mutating one at runtime mutates it everywhere and can leak into
saved copies.

```gdscript
# item.gd - data only
extends Resource
class_name ItemData

@export var id: StringName
@export var display_name: String
@export var icon: Texture2D
@export var scene_path: String  # path to a .tscn to spawn; validated statically
```

```gdscript
# WRONG: runtime state on the shared data resource
extends Resource
class_name ItemData
@export var display_name: String
var current_stack := 0  # <- mutated at runtime, shared across every holder
```

Put `current_stack` on the inventory node instead, keyed by `ItemData`.

## Registry-loading pattern

Load a directory of `.tres` into a typed dictionary once, keyed by a stable id.

```gdscript
# item_registry.gd (autoload)
extends Node

const ITEM_DIR := "res://resources/items"
var _items: Dictionary[StringName, ItemData] = {}

func _ready() -> void:
	for file in DirAccess.get_files_at(ITEM_DIR):
		if not file.ends_with(".tres"):
			continue
		var res := load(ITEM_DIR.path_join(file)) as ItemData
		if res == null:
			push_error("Not an ItemData: %s" % file)
			continue
		_items[res.id] = res

func get_item(id: StringName) -> ItemData:
	return _items.get(id)
```

## Validate before runtime

String path properties like `scene_path` above are invisible failures: a renamed
or deleted `.tscn` only errors when something actually loads it. Configure the
registry directory so the static validator checks every `.tres`:

```json
// godot-correctness.config.json
{
  "registryDirs": ["resources/items"],
  "pathPropertyPatterns": ["*_path", "*_scene"]
}
```

Then `validate_registries` (or `gdcorrect validate-registries .`) confirms each
`.tres` parses, its script resolves, and every resource-path property points at
an existing file. See also [[signal-hygiene]] and [[typed-gdscript]].
