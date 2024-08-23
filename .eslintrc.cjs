// module.exports = {
//   parser: "@typescript-eslint/parser",
//   extends: [
//     // "next/core-web-vitals", // This is the Next.js ESLint configuration
//     "eslint:recommended",
//     // "plugin:react/recommended",
//     // "plugin:@typescript-eslint/recommended",
//     // "plugin:jsx-a11y/recommended",
//     // "plugin:import/errors",
//     // "plugin:import/warnings",
//     // "plugin:import/typescript",
//     // "next",
//     // "next/core-web-vitals",
//     // "plugin:prettier/recommended", // Adds Prettier recommended configuration
//   ],
//   plugins: [
//     "react",
//     "react-hooks",
//     "@typescript-eslint",
//     "jsx-a11y",
//     "import",
//     "prettier",
//   ],
//   rules: {
//     "react/react-in-jsx-scope": "off",
//     "@typescript-eslint/no-explicit-any": "off",
//     "@typescript-eslint/explicit-module-boundary-types": "off",
//     "import/no-anonymous-default-export": "off",
//     "jsx-a11y/anchor-is-valid": "off",
//     "prettier/prettier": ["error"], // Ensure Prettier rules are enforced
//   },
//   settings: {
//     react: {
//       version: "detect",
//     },
//     "import/resolver": {
//       node: {
//         extensions: [".js", ".jsx", ".ts", ".tsx"],
//       },
//       typescript: {},
//     },
//   },
// };
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "next",
    "plugin:prettier/recommended", // Adds Prettier recommended configuration
  ],
  plugins: [
    "react",
    "react-hooks",
    "@typescript-eslint",
    "jsx-a11y",
    "import",
    "prettier",
  ],
  rules: {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "import/no-anonymous-default-export": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "prettier/prettier": ["error"], // Ensure Prettier rules are enforced
  },
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      typescript: {},
    },
  },
};
