# Typed GDScript patterns

Static types make GDScript faster (typed instructions) and let tools catch
mistakes. Prefer inference with `:=`, annotate function signatures, and cache
node references with `@onready`.

## Type every declaration

```gdscript
var speed := 300.0            # inferred float via :=
var target: Node2D = null     # explicit type when there is no initializer
const MAX_HP := 100           # inferred int

func take_damage(amount: int) -> void:
	_hp = maxi(_hp - amount, 0)
```

Avoid bare `var x = 3` — it is untyped. Use `:=` to infer or `: Type` to
annotate. The `untyped-declaration` rule flags declarations with neither.

## Cache node references with @onready

```gdscript
# Resolved once, after the node enters the tree.
@onready var sprite: Sprite2D = $Sprite2D
@onready var _agent: NavigationAgent2D = $NavigationAgent2D
```

Do not look nodes up every frame:

```gdscript
# WRONG: $ / get_node() inside _process runs every frame
func _process(delta: float) -> void:
	$Sprite2D.rotation += delta   # get-node-in-process
```

The `missing-onready` rule flags a class-level node-path member without
`@onready`; `get-node-in-process` flags per-frame lookups.

## Prefer $ over string paths

```gdscript
@onready var hp_bar := $UI/HPBar          # rename-safe editor reference
# var hp_bar = get_node("UI/HPBar")       # stringly-nodepath: fragile
```

See [[signal-hygiene]] and [[data-driven-resources]].
