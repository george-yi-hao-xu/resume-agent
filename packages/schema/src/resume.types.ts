// types related to resume v-dom

export type v_style_node = {
	selector: string;
	attributes: Record<string, string>;
};

export type v_style_item =
	| v_style_node
	| {
			media: string;
			rules: v_style_node[];
	  }
	| {
			atRule: string;
			attributes: Record<string, string>;
	  };

export type v_dom_node = {
	type: string;
	tagName?: string;
	attributes?: Record<string, string> & {
		"data-resume-root"?: "";
		name?: string;
		id?: string;
		content?: string;
		class?: string;
		charset?: string;
		lang?: string;
	};
	value?: string;
	children?: v_dom_node[];
};

export type Resume = {
	styles: v_style_item[];
	tree: {
		doctype: "html";
		root: v_dom_node;
	};
};
