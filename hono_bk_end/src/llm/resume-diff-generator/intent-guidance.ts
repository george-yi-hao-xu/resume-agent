export function buildIntentGuidance(instruction: string): string {
	const text = instruction.toLowerCase();
	const hasVisualIntent = hasAny(text, [
		"layout",
		"grid",
		"column",
		"columns",
		"2-column",
		"two-column",
		"flex",
		"spacing",
		"space",
		"width",
		"height",
		"margin",
		"padding",
		"color",
		"font",
		"typography",
		"style",
		"theme",
		"布局",
		"网格",
		"两列",
		"双栏",
		"列",
		"间距",
		"宽",
		"高",
		"边距",
		"颜色",
		"字体",
		"样式",
	]);
	const hasStructureIntent = hasAny(text, [
		"add",
		"insert",
		"remove",
		"delete",
		"reorder",
		"move",
		"section",
		"item",
		"bullet",
		"experience",
		"project",
		"skill",
		"education",
		"添加",
		"新增",
		"插入",
		"删除",
		"移除",
		"调整顺序",
		"移动",
		"章节",
		"条目",
		"经历",
		"项目",
		"技能",
		"教育",
	]);
	const hasTextIntent = hasAny(text, [
		"replace",
		"rename",
		"rewrite",
		"title",
		"name",
		"summary",
		"text",
		"替换",
		"改成",
		"重写",
		"标题",
		"姓名",
		"总结",
		"文本",
		"内容",
	]);
	const hasPageCloneIntent =
		hasAny(text, [
			"second page",
			"another page",
			"new page",
			"duplicate page",
			"copy page",
			"clone page",
			"translated page",
			"version",
			"第二页",
			"另一页",
			"新页面",
			"复制页面",
			"克隆页面",
			"翻译版",
			"版本",
		]) &&
		hasAny(text, [
			"chinese",
			"中文",
			"汉语",
			"translated",
			"translation",
			"translate",
			"翻译",
		]);

	if (hasPageCloneIntent) {
		return [
			"The instruction asks for an additional translated page/version.",
			"First use a copy op to duplicate the existing page container, usually from /tree/root/children/0 to /tree/root/children/1.",
			"After copying, use replace ops on the copied page text paths under /tree/root/children/1/... to translate content.",
			"Do not synthesize a partial page with add, and do not add only one translated section.",
			"Keep the copied page's DOM structure and classes unless the instruction asks for layout changes.",
		].join(" ");
	}

	if (hasVisualIntent && !hasStructureIntent && !hasTextIntent) {
		return [
			"The instruction appears to be visual/layout-only.",
			"Prefer small /styles diffs on existing selectors.",
			"For a 2-column grid layout, update an existing container style with display:grid, grid-template-columns, and gap.",
			"Do not add wrapper/sidebar/main nodes or replace children arrays unless the instruction explicitly asks for content structure changes.",
		].join(" ");
	}

	if ((hasStructureIntent || hasTextIntent) && !hasVisualIntent) {
		return [
			"The instruction appears to change content or document structure.",
			"Prefer precise /tree diffs for text nodes, node fields, or specific children.",
			"Use /styles only if the instruction also asks for appearance.",
		].join(" ");
	}

	if (hasVisualIntent && (hasStructureIntent || hasTextIntent)) {
		return [
			"The instruction appears mixed: content/structure plus visual styling.",
			"Use /tree for actual content or element structure changes, and /styles for presentation.",
			"Keep each diff small and avoid replacing whole children arrays unless necessary.",
		].join(" ");
	}

	return [
		"The instruction intent is ambiguous.",
		"Choose the smallest valid diffs.",
		"Use /styles for presentation-only effects and /tree for content or semantic structure.",
	].join(" ");
}

function hasAny(text: string, needles: string[]): boolean {
	return needles.some((needle) => text.includes(needle));
}
