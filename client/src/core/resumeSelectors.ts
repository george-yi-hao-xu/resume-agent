export const RESUME_SELECTORS = {
  root: "[data-resume-root]",
  resume: ".resume",
  resumeHeader: ".resume-header",
  resumeName: ".resume-name",
  resumeTitle: ".resume-title",
  contactList: ".contact-list",
  contactEmail: ".contact-email",
  contactPhone: ".contact-phone",
  contactLocation: ".contact-location",
  contactPortfolio: ".contact-portfolio",
  summarySection: ".summary-section",
  summaryText: ".summary-text",
  experienceSection: ".experience-section",
  experienceList: ".experience-list",
  experienceItem: ".experience-item",
  jobTitle: ".job-title",
  resumeMeta: ".resume-meta",
  bulletList: ".bullet-list",
  skillsSection: ".skills-section",
  skillsList: ".skills-list",
  projectSection: ".project-section",
  projectList: ".project-list",
  projectItem: ".project-item",
  projectSummary: ".project-summary"
} as const;

/**
 *  function: rm . in classname
 */
export function cls(selector: string): string {
  if (!selector.startsWith(".")) {
    throw new Error(`Selector is not a class selector: ${selector}`);
  }

  return selector.slice(1);
}
