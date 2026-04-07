import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Supabase select 결과(특히 JOIN)가 any로 추론되는 경우가 많음.
      // 점진적으로 정리할 예정이라 lint를 막지는 않도록 warning으로 강등.
      "@typescript-eslint/no-explicit-any": "warn",
      // React 19의 새 규칙. 페이지 진입 시 fetch 후 setState 하는 일상적 패턴까지
      // 잡으므로 너무 보수적. 의도된 패턴이 많아 warning으로 강등.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
