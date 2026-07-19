extends Node

func _process(delta: float) -> void:
	var s := $Sprite2D
	s.visible = true

func _physics_process(delta: float) -> void:
	get_node_or_null("Path/To/Node")
