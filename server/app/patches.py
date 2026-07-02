import json
from html.parser import HTMLParser
from typing import Any

from pydantic import TypeAdapter, ValidationError

from .models import UiPatch


patches_adapter = TypeAdapter(list[UiPatch])


class UnsafeHtmlError(ValueError):
    pass


class InsertHtmlSafetyParser(HTMLParser):
    blocked_tags = {"script", "iframe", "object", "embed"}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._validate_tag(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._validate_tag(tag, attrs)

    def _validate_tag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.blocked_tags:
            raise UnsafeHtmlError(f"insert_html contains blocked tag: {tag}.")

        for name, value in attrs:
            lower_name = name.lower()
            lower_value = (value or "").strip().lower()
            if lower_name.startswith("on"):
                raise UnsafeHtmlError(f"insert_html contains blocked event handler: {name}.")
            if lower_value.startswith("javascript:"):
                raise UnsafeHtmlError("insert_html contains a javascript: URL.")


def parse_and_validate_patches(raw: str) -> list[UiPatch]:
    json_array = extract_json_array(raw)

    try:
        parsed = json.loads(json_array)
    except json.JSONDecodeError as error:
        raise ValueError("Model response contains invalid JSON.") from error

    if not isinstance(parsed, list):
        raise ValueError("Model response must be a JSON array.")

    try:
        patches = patches_adapter.validate_python(parsed)
    except ValidationError as error:
        raise ValueError("Model returned one or more invalid patches.") from error

    validate_patch_safety(parsed)
    return patches


def extract_json_array(raw: str) -> str:
    start = raw.find("[")
    end = raw.rfind("]")
    if start < 0 or end < start:
        raise ValueError("No JSON array found in model response.")

    return raw[start : end + 1]


def validate_patch_safety(patches: list[dict[str, Any]]) -> None:
    for patch in patches:
        if patch.get("action") != "insert_html":
            continue

        html = patch.get("html")
        if not isinstance(html, str):
            raise ValueError("insert_html patch must include an HTML string.")

        parser = InsertHtmlSafetyParser()
        try:
            parser.feed(html)
        except UnsafeHtmlError:
            raise
        except Exception as error:
            raise ValueError("insert_html patch contains invalid HTML.") from error
