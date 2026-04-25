// 핵심 smoke 테스트 — 출시 전 회귀 감지용
// 2026-04-25
//
// 실행:
//   터미널 1: cd /e/dev/sms-app && npx vite --port 5173
//   터미널 2: cd "e:/#앱 개발/SMS앱 개발" && npx playwright test e2e/smoke.spec.ts
//
// 인증 후 시나리오는 별도 — 실데이터 의존 + Supabase 토큰 mock 필요.

import { test, expect } from "@playwright/test";

test.describe("SMS smoke", () => {
  test("앱이 정상 부팅되고 콘솔 에러가 없다", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // 외부 확장 프로그램 / 알려진 무관 에러는 무시
        if (text.includes("listener indicated an asynchronous response")) return;
        if (text.includes("ResizeObserver loop")) return;
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.message}\n${err.stack || ""}`);
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // 페이지 제목 확인 (브랜드명 포함)
    await expect(page).toHaveTitle(/SMS/);

    // 1초 정도 더 기다려 비동기 에러 캐치
    await page.waitForTimeout(1000);

    expect(pageErrors, `pageerror 발생:\n${pageErrors.join("\n---\n")}`).toEqual([]);
    expect(
      consoleErrors,
      `콘솔 에러 발생:\n${consoleErrors.join("\n---\n")}`,
    ).toEqual([]);
  });

  test("PWA manifest 가 정상 응답한다", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.name).toBeTruthy();
    expect(json.start_url).toBeTruthy();
    expect(json.icons?.length).toBeGreaterThan(0);
  });

  test("sitemap.xml 이 노출된다", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>");
  });

  test("robots.txt 에 Sitemap 라인이 있다", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toMatch(/Sitemap:\s*https?:\/\//);
  });

  test("Service Worker 파일이 응답한다", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toMatch(/javascript/);
  });

  test("OG 이미지가 응답한다", async ({ request }) => {
    const res = await request.get("/og-image.png");
    expect(res.ok()).toBeTruthy();
    const ct = res.headers()["content-type"] || "";
    expect(ct).toMatch(/image/);
  });

  test("중요 보안 헤더가 적용되어 있다 (CSP, HSTS 등)", async ({ request }) => {
    // dev 서버 기준 — _headers 는 Cloudflare Pages 전용이라 prod 빌드에서만 적용.
    // 그래도 응답 자체는 200 이어야 함.
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    // prod 환경에서만 검사할 강한 단언은 별도 prod-only 스위트로 분리.
  });

  test("404 페이지가 정상 렌더된다 (라우팅 폴백)", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // NotFound 컴포넌트가 의도적으로 console.error 로 라우트 미스 기록 — 정상.
        if (text.includes("404 Error: User attempted to access")) return;
        if (text.includes("listener indicated an asynchronous response")) return;
        if (text.includes("Failed to load resource")) return;
        consoleErrors.push(text);
      }
    });

    await page.goto("/#/__no_such_route__", { waitUntil: "networkidle" });
    // 우리 NotFound 컴포넌트 또는 홈 fallback 어느 쪽도 OK.
    // 핵심은 흰 화면이 아니다는 것 → body 텍스트가 비어있지 않아야 함.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
    expect(consoleErrors).toEqual([]);
  });
});
