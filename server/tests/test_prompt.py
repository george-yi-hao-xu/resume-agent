from server.app.models import PreviewContext, PreviewContextElement
from server.app.prompt import build_system_prompt


def test_build_system_prompt_includes_preview_context_selectors():
    prompt = build_system_prompt(
        PreviewContext(
            elements=[
                PreviewContextElement(
                    selector="[data-resume-root] > section:nth-of-type(1) > p:nth-of-type(1)",
                    tag="p",
                    role="summary",
                    text="Product-minded engineer.",
                )
            ],
            insertion_targets=[
                PreviewContextElement(
                    selector=".skills-list",
                    tag="ul",
                    role="skills insertion target",
                )
            ],
        )
    )

    assert "[data-resume-root] > section:nth-of-type(1) > p:nth-of-type(1)" in prompt
    assert ".skills-list" in prompt
    assert 'text="Product-minded engineer."' in prompt
