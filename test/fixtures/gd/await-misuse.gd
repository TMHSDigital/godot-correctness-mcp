extends Node

func f() -> void:
	await 5
	await get_tree().process_frame
