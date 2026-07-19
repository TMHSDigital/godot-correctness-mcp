# Backlog

Planned work not yet implemented. See [ROADMAP.md](ROADMAP.md) for the shipped
milestones.

## v0.2

### `signal-callback-arity` lint rule

Cross-check `connect()` callback signatures against the connected signal's
definition, using the committed symbol database (pillar 2). When a built-in
signal is connected to a `Callable`, the callback's parameter count/types should
match the signal's declared arguments; a mismatch throws at emit time in Godot 4.

Example the rule should catch:

```gdscript
# Timer.timeout has zero arguments, but the callback takes one:
$Timer.timeout.connect(_on_timeout)
func _on_timeout(delta: float) -> void:  # arity mismatch -> runtime error
	pass
```

Design notes:
- Resolve the signal owner's class from the symbol DB (`api_symbol_lookup`),
  read the signal's argument list, and compare against the target function's
  declared parameters (ignoring `bind()`-ed trailing args).
- Conservative by default: only flag when both the signal and the callback are
  statically resolvable, to keep the zero-false-positive posture of the CI gate.
- Likely severity: `warning`.

Not implemented in v0.1.0.
