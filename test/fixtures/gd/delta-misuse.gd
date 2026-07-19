extends CharacterBody2D

const SPEED := 300.0

func _physics_process(delta: float) -> void:
	velocity = Vector2.RIGHT * SPEED * delta
	move_and_slide()

func _process(delta: float) -> void:
	position.x += 5
