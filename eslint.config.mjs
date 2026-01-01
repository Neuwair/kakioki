import { configs } from "eslint-config-next";

const eslintConfig = [
  ...configs.flat.recommended,
  ...configs.flat.typescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
