import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// 빌드 시 sw.js에 타임스탬프 주입 → 매 배포마다 새 SW 감지
function injectSwVersion(): Plugin {
  return {
    name: "inject-sw-version",
    apply: "build",
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      if (!fs.existsSync(swPath)) return;
      const version = Date.now().toString();
      const content = fs.readFileSync(swPath, "utf-8");
      const updated = `// BUILD_VERSION=${version}\n` + content.replace(
        /const CACHE_NAME = .*/,
        `const CACHE_NAME = 'sms-app-${version}';`
      );
      fs.writeFileSync(swPath, updated);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    injectSwVersion(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // 공통 의존성을 별도 청크로 분리 → 메인 번들 축소 + 브라우저 캐시 재활용
        manualChunks: {
          "react-core": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "charts": ["recharts"],
          "radix-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-progress",
          ],
          "date-utils": ["date-fns"],
          "query": ["@tanstack/react-query"],
        },
      },
    },
  },
}));
