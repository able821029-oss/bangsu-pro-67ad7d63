import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:5173",
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
