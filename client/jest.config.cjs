/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "jsdom",
	testMatch: ["<rootDir>/src/**/*.test.ts"],
	roots: ["<rootDir>/src"],
	moduleNameMapper: {
		"^@repo/schema$": "<rootDir>/../packages/schema/src/index.ts",
		"^@repo/schema/src/resume.types$":
			"<rootDir>/../packages/schema/src/resume.types.ts",
		"^\\./resume.types.js$":
			"<rootDir>/../packages/schema/src/resume.types.ts",
		"^\\./str.js$": "<rootDir>/../packages/schema/src/str.ts",
	},
};
