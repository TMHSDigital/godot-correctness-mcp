extends Node

func f() -> bool:
	if get_x() == 0.5:
		return true
	if get_pos() == Vector2(1, 1):
		return true
	return false
