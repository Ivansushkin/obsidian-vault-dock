import prettier from "eslint-config-prettier/flat";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ languageOptions: { globals: globals.browser } },
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ["package.json"],
		rules: {
			"depend/ban-dependencies": [
				"error",
				{
					presets: ["native", "microutilities", "preferred"],
					allowed: ["lint-staged"],
				},
			],
		},
	},
	{
		files: ["**/*.mjs"],
		languageOptions: { globals: globals.node },
		rules: { "import/no-nodejs-modules": "off" },
	},
	{
		ignores: [
			"build/",
			"dist/",
			".husky/_/",
			".env*",
			".npmrc",
			"**/data.json",
		],
	},
	prettier,
	{
		files: ["**/*.{ts,mjs}"],
		rules: { curly: ["error", "all"] },
	},
);
