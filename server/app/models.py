from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class PatchAction(str, Enum):
    update_css = "update_css"
    update_text = "update_text"
    insert_html = "insert_html"
    remove_element = "remove_element"


class UpdateCssPatch(BaseModel):
    action: Literal[PatchAction.update_css]
    selector: str
    styles: dict[str, str]


class UpdateTextPatch(BaseModel):
    action: Literal[PatchAction.update_text]
    selector: str
    text: str


class InsertHtmlPatch(BaseModel):
    action: Literal[PatchAction.insert_html]
    parent: str
    position: str | None = None
    html: str


class RemoveElementPatch(BaseModel):
    action: Literal[PatchAction.remove_element]
    selector: str


class PreviewContextElement(BaseModel):
    selector: str
    tag: str
    text: str | None = None
    role: str | None = None


class PreviewContext(BaseModel):
    elements: list[PreviewContextElement] = Field(default_factory=list)
    insertion_targets: list[PreviewContextElement] = Field(default_factory=list)


UiPatch = Annotated[
    Union[UpdateCssPatch, UpdateTextPatch, InsertHtmlPatch, RemoveElementPatch],
    Field(discriminator="action"),
]


class PatchRequest(BaseModel):
    instruction: str
    model: str
    temperature: float = Field(default=0.1, ge=0, le=2)
    preview_context: PreviewContext | None = Field(default=None, alias="previewContext")


class PatchProviderResult(BaseModel):
    patches: list[UiPatch]
    provider: Literal["ollama"] = "ollama"
    model: str | None = None
    note: str | None = None

    model_config = ConfigDict(use_enum_values=True)


class HealthOk(BaseModel):
    ok: Literal[True]


class HealthError(BaseModel):
    ok: Literal[False]
    reason: Literal["offline", "model_missing"]
    message: str


HealthResult = HealthOk | HealthError
