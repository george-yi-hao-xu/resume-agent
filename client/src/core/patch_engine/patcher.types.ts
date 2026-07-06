export type MutableNode = {
	type: string;
	tagName?: string;
	attributes?: Record<string, string>;
	value?: string;
	children?: MutableNode[];
};

export type NodeRef = {
	node: MutableNode;
	parent: MutableNode | null;
	index: number;
	path: number[];
	ancestors: MutableNode[];
};


