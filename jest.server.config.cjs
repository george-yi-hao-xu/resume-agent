/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/hono_bk_end/src/**/*.test.ts"],
	roots: ["<rootDir>/hono_bk_end/src"],
	passWithNoTests: true,
	globals: {
		"ts-jest": {
			tsconfig: "<rootDir>/hono_bk_end/tsconfig.json",
		},
	},
};
