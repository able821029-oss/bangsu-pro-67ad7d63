import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    // 환경변수로 prod / staging URL 직접 검증 가능.
    // 예: E2E_BASE_URL=https://sms-app-9p9.pages.dev npx playwright test e2e/smoke.spec.ts
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    headless: true,
    viewport: { width: 390, height: 844 },
    screenshot: "on",
    video: "off",
    trace: "on-first-retry",
    locale: "ko-KR",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
