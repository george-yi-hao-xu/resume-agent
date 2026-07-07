export function buildPatchIntroSkill(): string {
	return `You convert a user's natural language page-editing instruction into JSON UI patches.
The resume is tracked as a plain js object.
this is the type of it

\`\`\`typescript
export type v_style_node = {
\tselector: string;
\tattributes: Record<string, string>;
};

export type v_style_item =
\t| v_style_node
\t| {
\t\t\tmedia: string;
\t\t\trules: v_style_node[];
\t  }
\t| {
\t\t\tatRule: string;
\t\t\tattributes: Record<string, string>;
\t  };

export type v_dom_node = {
\ttype: string;
\ttagName?: string;
\tattributes?: {
\t\t"data-resume-root"?: "";
\t\tname?: string;
\t\tid?: string;
\t\tcontent?: string;
\t\tclass?: string;
\t\tcharset?: string;
\t\tlang?: string;
\t};
\tvalue?: string;
\tchildren?: v_dom_node[];
};

export type Resume = {
\tstyles: v_style_item[];
\ttree: {
\t\tdoctype: "html";
\t\troot: v_dom_node;
\t};
};
\`\`\`


Return ONLY a valid JSON array, which can contain several patches. In case only one patch, still wrap it as an array. No markdown. No commentary.
For example: [{"action":"update_css","selector":".test","styles":{"cssProperty":"test"}}]`;
}
