/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: "node",
	testMatch: ["<rootDir>/hono_bk_end/src/**/*.test.ts"],
	roots: ["<rootDir>/hono_bk_end/src"],
	passWithNoTests: true,
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: {
					module: "CommonJS",
					moduleResolution: "Node",
					target: "ESNext",
					strict: true,
					verbatimModuleSyntax: false,
					types: ["node", "jest"],
				},
			},
		],
	},
};
