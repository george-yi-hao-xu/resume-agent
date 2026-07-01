import type { UiPatch } from "../types";

export function mockLlm(instruction: string): UiPatch[] {
  const text = instruction.toLowerCase();

  if (text.includes("名字") || text.includes("name")) {
    const requested = extractAfter(instruction, ["改成", "to", ":"]);
    return [
      {
        action: "update_text",
        selector: ".resume-name",
        text: requested || "Grace Liu"
      }
    ];
  }

  if (text.includes("职位") || text.includes("title") || text.includes("role")) {
    const requested = extractAfter(instruction, ["改成", "to", ":"]);
    return [
      {
        action: "update_text",
        selector: ".resume-title",
        text: requested || "AI Full-Stack Engineer"
      }
    ];
  }

  if (text.includes("绿色") || text.includes("green")) {
    return [
      {
        action: "update_css",
        selector: ".resume-title, .section-title",
        styles: {
          color: "#047857"
        }
      },
      {
        action: "update_css",
        selector: ".resume-header",
        styles: {
          borderBottomColor: "#047857"
        }
      }
    ];
  }

  if (text.includes("技能") || text.includes("skill")) {
    const requested = extractAfter(instruction, ["添加", "add", ":"]);
    return [
      {
        action: "insert_html",
        parent: ".skills-list",
        position: "beforeend",
        html: `<li>${escapeHtml(requested || "Next.js")}</li>`
      }
    ];
  }

  if (text.includes("summary") || text.includes("总结") || text.includes("简介")) {
    return [
      {
        action: "update_text",
        selector: ".summary-text",
        text: "AI-focused full-stack engineer experienced in React, TypeScript, local LLM tooling, and production-ready web workflows."
      }
    ];
  }

  return [
    {
      action: "update_text",
      selector: ".summary-text",
      text: "Updated from chat: product-minded engineer building practical AI-assisted web tools."
    }
  ];
}

function extractAfter(input: string, separators: string[]): string {
  for (const separator of separators) {
    const index = input.toLowerCase().lastIndexOf(separator);
    if (index >= 0) {
      return input.slice(index + separator.length).trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
