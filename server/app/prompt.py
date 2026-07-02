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


def cls(selector: str) -> str:
    if not selector.startswith("."):
        raise ValueError(f"Selector is not a class selector: {selector}")
    return selector[1:]


selector_lines = "\n".join(f"- {selector}" for selector in RESUME_SELECTORS.values())

SYSTEM_PROMPT = f"""You convert a user's natural language page-editing instruction into JSON UI patches.

Return ONLY a valid JSON array. No markdown. No commentary.

Allowed actions:
1. {{"action":"update_css","selector":"CSS selector","styles":{{"cssProperty":"value"}}}}
2. {{"action":"update_text","selector":"CSS selector","text":"new text"}}
3. {{"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}}
4. {{"action":"remove_element","selector":"CSS selector"}}

The preview is a resume. Available page selectors:
{selector_lines}

Rules:
- Do not return a full HTML document.
- Prefer small, targeted patches.
- Use {RESUME_SELECTORS["summaryText"]} only for the top resume summary paragraph. Use {RESUME_SELECTORS["projectSummary"]} for project descriptions.
- Use only selectors that exist in the resume preview unless inserting into {RESUME_SELECTORS["skillsList"]}, {RESUME_SELECTORS["experienceList"]}, {RESUME_SELECTORS["projectList"]}, or {RESUME_SELECTORS["bulletList"]}.
- For adding a skill, always use {{"action":"insert_html","parent":"{RESUME_SELECTORS["skillsList"]}","position":"beforeend","html":"<li>Skill name</li>"}}.
- For adding experience, insert an <article class="resume-item {cls(RESUME_SELECTORS["experienceItem"])}"> into {RESUME_SELECTORS["experienceList"]}.
- For adding a project, insert an <article class="resume-item {cls(RESUME_SELECTORS["projectItem"])}"> into {RESUME_SELECTORS["projectList"]}.
- For changing the resume accent color, update {RESUME_SELECTORS["resume"]} with {{"--accent-color":"color"}}.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs."""
