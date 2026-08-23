import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";

// `strictTypeChecked` needs type information, so every linted file must belong to a tsconfig.
// `eslint src test` is what CI runs: src -> tsconfig.app.json, test -> tsconfig.test.json.
const typeAware = {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

export default [
  { ignores: ["dist", "node_modules"] },
  eslint.configs.recommended,
  sonarjs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...vue.configs["flat/recommended"],
  { languageOptions: { parserOptions: typeAware } },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: [".vue"], ...typeAware },
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "error",
      "vue/multi-word-component-names": "off",

      // `node:test`'s test/describe return promises nobody awaits — that is the runner's contract,
      // not a dropped rejection. Everything else must be handled: this repo has already shipped a
      // beat that produced ten unhandled rejections per keystroke.
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", package: "node:test", name: ["describe", "it", "test", "suite"] }] },
      ],
      // `@click="doThing()"` on a void function is the Vue idiom, not a confusion.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true, ignoreVoidOperator: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
    },
  },
  {
    // ─── the backlog ───────────────────────────────────────────────────────────────────────
    // Every rule above is an error, so a clean rule stays clean. These are the ones that are
    // NOT clean today; the count is what they reported when this config landed, and the point
    // of writing it down is that the next person can tell progress from drift.
    //
    // Draining them is the follow-up, not this change: turning them to error today would mean
    // rewriting code in the same commit that changed the rules, and nothing would be reviewable.
    rules: {
      "@typescript-eslint/no-unnecessary-type-assertion": "warn", // 17 — each one is an `as` the compiler says is redundant
      "@typescript-eslint/no-unsafe-assignment": "warn", // 12
      "@typescript-eslint/no-unnecessary-condition": "warn", // 13 — some of these are dead branches
      "@typescript-eslint/no-non-null-assertion": "warn", // 3
      "@typescript-eslint/no-unsafe-argument": "warn", // 3
      "@typescript-eslint/no-unnecessary-type-conversion": "warn", // 2
      "@typescript-eslint/no-dynamic-delete": "warn", // 2
      "@typescript-eslint/no-invalid-void-type": "warn", // 1
      "@typescript-eslint/no-unnecessary-type-parameters": "warn", // 1
      "@typescript-eslint/no-unsafe-return": "warn", // 1
      "@typescript-eslint/no-base-to-string": "warn", // 1
      "sonarjs/function-return-type": "warn", // 2
      "sonarjs/no-misleading-array-reverse": "warn", // 1
      "sonarjs/no-alphabetical-sort": "warn", // 1
      "sonarjs/prefer-regexp-exec": "warn", // 1

      // Size and shape. CLAUDE.md asks for functions under 20 lines; these report the gap
      // rather than blocking, because the fix is an extraction and extractions need proof.
      "max-lines-per-function": ["warn", { max: 20, skipBlankLines: true, skipComments: true }], // 13
      complexity: ["warn", 8], // 10
      "max-depth": ["warn", 3], // 0 today — kept as warn so it reads with the other two
    },
  },
  eslintConfigPrettier,
];
