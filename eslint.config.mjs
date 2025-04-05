import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add custom rules object
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off", // Disable unused variable checks
      "@next/next/no-img-element": "off", // Disable next/image warning
      "react/no-unescaped-entities": "off", // Disable check for unescaped entities like quotes
    },
  },
];

export default eslintConfig;
