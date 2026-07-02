RESUME_SELECTORS = {
    "root": "[data-resume-root]",
    "resume": ".resume",
    "resumeHeader": ".resume-header",
    "resumeName": ".resume-name",
    "resumeTitle": ".resume-title",
    "contactList": ".contact-list",
    "contactEmail": ".contact-email",
    "contactPhone": ".contact-phone",
    "contactLocation": ".contact-location",
    "contactPortfolio": ".contact-portfolio",
    "summarySection": ".summary-section",
    "summaryText": ".summary-text",
    "experienceSection": ".experience-section",
    "experienceList": ".experience-list",
    "experienceItem": ".experience-item",
    "jobTitle": ".job-title",
    "resumeMeta": ".resume-meta",
    "bulletList": ".bullet-list",
    "skillsSection": ".skills-section",
    "skillsList": ".skills-list",
    "projectSection": ".project-section",
    "projectList": ".project-list",
    "projectItem": ".project-item",
    "projectSummary": ".project-summary",
}

MAX_CONTEXT_ITEMS = 80


def cls(selector: str) -> str:
    if not selector.startswith("."):
        raise ValueError(f"Selector is not a class selector: {selector}")
    return selector[1:]


selector_lines = "\n".join(f"- {selector}" for selector in RESUME_SELECTORS.values())

BASE_SYSTEM_PROMPT = f"""You convert a user's natural language page-editing instruction into JSON UI patches.

Return ONLY a valid JSON array. No markdown. No commentary.

Allowed actions:
1. {{"action":"update_css","selector":"CSS selector","styles":{{"cssProperty":"value"}}}}
2. {{"action":"update_text","selector":"CSS selector","text":"new text"}}
3. {{"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}}
4. {{"action":"remove_element","selector":"CSS selector"}}

The preview is a resume. Available page selectors:
__SELECTOR_CONTEXT__

Rules:
- Do not return a full HTML document.
- Prefer small, targeted patches.
- Use {RESUME_SELECTORS["summaryText"]} only for the top resume summary paragraph. Use {RESUME_SELECTORS["projectSummary"]} for project descriptions.
- Use only selectors from the available page selectors unless inserting into one of the listed insertion targets.
- For adding a skill, always use {{"action":"insert_html","parent":"{RESUME_SELECTORS["skillsList"]}","position":"beforeend","html":"<li>Skill name</li>"}}.
- For adding experience, insert an <article class="resume-item {cls(RESUME_SELECTORS["experienceItem"])}"> into {RESUME_SELECTORS["experienceList"]}.
- For adding a project, insert an <article class="resume-item {cls(RESUME_SELECTORS["projectItem"])}"> into {RESUME_SELECTORS["projectList"]}.
- For changing the resume accent color, update {RESUME_SELECTORS["resume"]} with {{"--accent-color":"color"}}.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs."""


def build_system_prompt(preview_context: object | None = None) -> str:
    return BASE_SYSTEM_PROMPT.replace("__SELECTOR_CONTEXT__", get_selector_context(preview_context))


def get_selector_context(preview_context: object | None) -> str:
    if not preview_context:
        return selector_lines

    groups = [
        ("Editable elements:", getattr(preview_context, "elements", []) or []),
        ("Insertion targets:", getattr(preview_context, "insertion_targets", []) or []),
    ]
    lines = [
        line
        for heading, items in groups
        for line in ([heading] + [format_context_item(item) for item in list(items)[:MAX_CONTEXT_ITEMS]] if items else [])
    ]

    return "\n".join(lines) if lines else selector_lines


def format_context_item(item: object) -> str:
    tag = str(getattr(item, "tag", "") or "").lower()
    role = str(getattr(item, "role", "") or "")
    selector = str(getattr(item, "selector", "") or "")
    text = " ".join(str(getattr(item, "text", "") or "").split())[:160]
    details = [value for value in [tag, role, f'text="{text}"' if text else ""] if value]
    suffix = f" ({'; '.join(details)})" if details else ""
    return f"- {selector}{suffix}"
