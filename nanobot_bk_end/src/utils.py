"""Small utilities ported from the legacy TS backend."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, TypeVar

T = TypeVar("T")


def extract_json(raw_output: str) -> str:
    """Extract the first JSON array or object from a possibly fenced string."""
    trimmed = raw_output.strip()
    fenced = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", trimmed, re.IGNORECASE)
    text = fenced.group(1).strip() if fenced else trimmed

    array_start = text.find("[")
    array_end = text.rfind("]")
    object_start = text.find("{")
    object_end = text.rfind("}")

    if (
        array_start != -1
        and array_end != -1
        and (object_start == -1 or array_start < object_start)
    ):
        return text[array_start : array_end + 1]

    if object_start != -1 and object_end != -1:
        return text[object_start : object_end + 1]

    raise ValueError(f"Invalid JSON output: {raw_output[:80]}")


def parse_json_value(value: Any) -> Any:
    """Normalize a diff value to JSON-serializable primitives."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, list):
        return [parse_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: parse_json_value(item) for key, item in value.items()}
    raise ValueError(f"Diff value must be JSON-serializable, got {type(value).__name__}")


def validate_json_pointer(path: str) -> str:
    if not path.startswith("/") and path != "":
        raise ValueError(f"Invalid JSON pointer path: {path}")
    if path == "":
        raise ValueError("Root edits are not supported.")
    return path


def read_diff_items(parsed: Any) -> list[Any] | None:
    if isinstance(parsed, list):
        return parsed
    if not isinstance(parsed, dict):
        return None
    if isinstance(parsed.get("op"), str):
        return [parsed]

    for key in (
        "diffs",
        "diff",
        "operations",
        "operation",
        "ops",
        "patches",
        "patch",
        "changes",
    ):
        value = parsed.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict) and isinstance(value.get("op"), str):
            return [value]
    return None


def read_diff_op(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Resume diff item must be an object.")

    op = value.get("op")
    if op in ("add", "replace", "test"):
        return {
            "op": op,
            "path": validate_json_pointer(value.get("path")),
            "value": parse_json_value(value.get("value")),
        }
    if op == "remove":
        return {
            "op": "remove",
            "path": validate_json_pointer(value.get("path")),
        }
    if op in ("move", "copy"):
        return {
            "op": op,
            "from": validate_json_pointer(value.get("from")),
            "path": validate_json_pointer(value.get("path")),
        }
    raise ValueError(f"Unsupported resume diff op: {op}")


def parse_resume_diffs(raw_output: str) -> list[dict[str, Any]]:
    json_text = extract_json(raw_output)
    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse resume diff JSON: {json_text[:80]}") from exc

    items = read_diff_items(parsed)
    if items is None:
        raise ValueError(
            f"Resume diff output must be diff ops. Raw JSON: {json_text[:160]}"
        )

    return [read_diff_op(item) for item in items]


async def with_timeout(
    coro: asyncio.Future[T] | asyncio.Task[T],
    timeout_ms: int,
    message: str,
) -> T:
    return await asyncio.wait_for(coro, timeout=timeout_ms / 1000.0)
