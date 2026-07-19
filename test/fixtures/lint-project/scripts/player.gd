extends CharacterBody2D

const SPEED := 300.0

var loose = 1

func _physics_process(delta: float) -> void:
	velocity = Vector2.RIGHT * SPEED * delta
	move_and_slide()

func check() -> bool:
	return get_progress() == 0.5
