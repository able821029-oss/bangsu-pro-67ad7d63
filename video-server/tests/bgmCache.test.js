// BGM 프리셋 캐싱 테스트 — Redis 불필요
//
// 실행: node --test tests/bgmCache.test.js

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { generateBgm, clearBgmCache, CACHE_DIR } = require("../bgm");

test("두 번째 호출이 첫 번째보다 빠르다 (캐시 hit)", () => {
  clearBgmCache();

  const out1 = path.join(os.tmpdir(), `bgm_c1_${Date.now()}.mp3`);
  const out2 = path.join(os.tmpdir(), `bgm_c2_${Date.now()}.mp3`);

  try {
    const t0 = Date.now();
    assert.ok(generateBgm("calm", 10, out1), "첫 호출 성공");
    const first = Date.now() - t0;

    const t1 = Date.now();
    assert.ok(generateBgm("calm", 15, out2), "두 번째 호출 성공");
    const second = Date.now() - t1;

    assert.ok(fs.existsSync(out1), "첫 출력 파일 존재");
    assert.ok(fs.existsSync(out2), "두 번째 출력 파일 존재");
    assert.ok(fs.statSync(out1).size > 1000, "첫 파일 크기 정상");
    assert.ok(fs.statSync(out2).size > 1000, "두 번째 파일 크기 정상");

    console.log(`[bgm-cache] 1회차 ${first}ms → 2회차 ${second}ms`);
    // 캐시 hit은 수백ms 이내, 첫 호출은 보통 1000ms 이상
    assert.ok(second < first, `캐시 hit이 더 빠름 (1st: ${first}ms, 2nd: ${second}ms)`);
  } finally {
    try { fs.unlinkSync(out1); } catch { /* ignore */ }
    try { fs.unlinkSync(out2); } catch { /* ignore */ }
  }
});

test("마스터 파일이 캐시 디렉토리에 생성된다", () => {
  clearBgmCache();
  const out = path.join(os.tmpdir(), `bgm_master_${Date.now()}.mp3`);
  try {
    assert.ok(generateBgm("upbeat", 5, out), "호출 성공");
    const master = path.join(CACHE_DIR, "upbeat.mp3");
    assert.ok(fs.existsSync(master), `마스터 파일 존재: ${master}`);
    assert.ok(fs.statSync(master).size > 10_000, "마스터 파일 크기 합리적");
  } finally {
    try { fs.unlinkSync(out); } catch { /* ignore */ }
  }
});

test("bgmType=none이면 false 반환", () => {
  const out = path.join(os.tmpdir(), `bgm_none_${Date.now()}.mp3`);
  assert.strictEqual(generateBgm("none", 10, out), false);
  assert.ok(!fs.existsSync(out), "none이면 파일 생성 안함");
});

test("알 수 없는 타입은 calm으로 대체", () => {
  clearBgmCache();
  const out = path.join(os.tmpdir(), `bgm_unknown_${Date.now()}.mp3`);
  try {
    assert.ok(generateBgm("nonexistent_type", 3, out), "알 수 없는 타입도 성공");
    assert.ok(fs.existsSync(out));
    // calm 마스터가 생성되었을 것
    assert.ok(fs.existsSync(path.join(CACHE_DIR, "calm.mp3")));
  } finally {
    try { fs.unlinkSync(out); } catch { /* ignore */ }
  }
});
