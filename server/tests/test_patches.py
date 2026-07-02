import pytest

from server.app.patches import extract_json_array, parse_and_validate_patches


def test_extracts_json_array_from_model_text():
    assert extract_json_array('Sure: [{"action":"remove_element","selector":".x"}] done') == (
        '[{"action":"remove_element","selector":".x"}]'
    )


def test_accepts_valid_patch_actions():
    patches = parse_and_validate_patches(
        """
        [
          {"action":"update_css","selector":".resume","styles":{"color":"red"}},
          {"action":"update_text","selector":".resume-name","text":"Grace Liu"},
          {"action":"insert_html","parent":".skills-list","position":"beforeend","html":"<li>Python</li>"},
          {"action":"remove_element","selector":".project-item"}
        ]
        """
    )

    assert len(patches) == 4


def test_rejects_non_array_response():
    with pytest.raises(ValueError, match="No JSON array found"):
        parse_and_validate_patches('{"action":"remove_element","selector":".x"}')


def test_rejects_invalid_patch_shape():
    with pytest.raises(ValueError, match="invalid patches"):
        parse_and_validate_patches('[{"action":"update_text","selector":".x"}]')


def test_rejects_unsafe_insert_html():
    with pytest.raises(ValueError, match="blocked tag"):
        parse_and_validate_patches(
            '[{"action":"insert_html","parent":".skills-list","html":"<script>alert(1)</script>"}]'
        )
