# Signal hygiene

Godot 4 signals are first-class. Connect with the typed `Callable` API, avoid
frame-fragile lookups, and disconnect (or use one-shot) when a connection should
not outlive the node.

## Prefer the typed connect API

```gdscript
# Godot 4: reference the signal object and pass a Callable
button.pressed.connect(_on_button_pressed)

# Avoid the stringly-typed legacy form
button.connect("pressed", Callable(self, "_on_button_pressed"))
```

## Connect once, disconnect deliberately

Connecting in `_ready()` without cleanup risks double-connections (if the node
re-enters the tree) or dangling references (if the emitter outlives the receiver).

```gdscript
func _ready() -> void:
	# One-shot: auto-disconnects after the first emission.
	get_tree().create_timer(1.0).timeout.connect(_spawn, CONNECT_ONE_SHOT)
	EventBus.player_died.connect(_on_player_died)

func _exit_tree() -> void:
	if EventBus.player_died.is_connected(_on_player_died):
		EventBus.player_died.disconnect(_on_player_died)
```

This server's `connect-without-disconnect` lint rule flags `connect()` in
`_ready()` when there is no matching `disconnect()` and no `CONNECT_ONE_SHOT`.

## await a signal instead of polling

```gdscript
func flash() -> void:
	modulate = Color.RED
	await get_tree().create_timer(0.1).timeout  # await a real signal
	modulate = Color.WHITE
```

Never `await` a plain value — `await` expects a signal or a coroutine
(the `await-misuse` rule catches `await <literal>`). See [[typed-gdscript]].
