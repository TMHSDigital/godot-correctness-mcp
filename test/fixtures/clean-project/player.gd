extends Node

@onready var sprite: Sprite2D = $Sprite2D
var speed: float = 300.0

func _ready() -> void:
	sprite.visible = true

func approx(a: float, b: float) -> bool:
	return is_equal_approx(a, b)
