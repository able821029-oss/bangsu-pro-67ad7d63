// 오디오 믹싱 — 나레이션 concat + BGM 생성 + 영상과 합체
// 기존 index.js/worker.js에 있던 오디오 로직을 추출해 렌더 엔진(Remotion/FFmpeg) 공통으로 사용한다.

const fs = require("fs");
const { execSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { generateBgm } = require("./bgm");

/**
 * 오디오 없는 영상 + 나레이션 base64[] + BGM 타입을 받아 최종 mp4를 만든다.
 *
 * @param {Object} opts
 * @param {string} opts.videoPath              오디오 없는 원본 mp4 (Remotion 또는 FFmpeg 출력)
 * @param {(string|null)[]} [opts.narrationAudios]  base64 MP3 배열 (null은 스킵)
 * @param {string} [opts.bgmType]              "upbeat"|"calm"|"hiphop"|...|"none"
 * @param {number} opts.durationSec            영상 길이(BGM 길이 계산용)
 * @param {string} opts.jobId
 * @returns {Promise<{ finalPath, hasNarration, hasBgm, hasAudio, tempFiles }>}
 */
async function mixAudio({ videoPath, narrationAudios, bgmType = "none", durationSec, jobId }) {
  const audioPath = `/tmp/sms_${jobId}_audio.mp3`;
  const bgmPath = `/tmp/sms_${jobId}_bgm.mp3`;
  const mixedPath = `/tmp/sms_${jobId}_mixed.mp3`;
  const finalPath = `/tmp/sms_${jobId}_final.mp4`;
  const listFile = `/tmp/sms_${jobId}_list.txt`;
  const narrationFiles = [];

  // Step 1: 나레이션 base64 → mp3 concat
  let hasNarration = false;
  const validAudios = (narrationAudios || []).filter(Boolean);
  if (validAudios.length > 0) {
    for (let i = 0; i < validAudios.length; i++) {
      const ap = `/tmp/sms_${jobId}_nar_${i}.mp3`;
      fs.writeFileSync(ap, Buffer.from(validAudios[i], "base64"));
      narrationFiles.push(ap);
    }
    if (narrationFiles.length === 1) {
      fs.copyFileSync(narrationFiles[0], audioPath);
    } else {
      fs.writeFileSync(listFile, narrationFiles.map((f) => `file '${f}'`).join("\n"));
      execSync(`${ffmpegPath} -y -f concat -safe 0 -i "${listFile}" -c copy "${audioPath}"`);
    }
    hasNarration = true;
  }

  // Step 2: BGM 합성
  let hasBgm = false;
  if (bgmType && bgmType !== "none") {
    hasBgm = generateBgm(bgmType, durationSec + 1, bgmPath);
  }

  // Step 3: 나레이션+BGM 믹싱
  let finalAudioPath = null;
  if (hasNarration && hasBgm) {
    execSync(
      `${ffmpegPath} -y -i "${audioPath}" -i "${bgmPath}" ` +
        `-filter_complex "[0:a]volume=1.0[nar];[1:a]volume=0.25[bgm];[nar][bgm]amix=inputs=2:normalize=0[out]" ` +
        `-map "[out]" -c:a libmp3lame -b:a 192k "${mixedPath}"`
    );
    finalAudioPath = mixedPath;
  } else if (hasNarration) {
    finalAudioPath = audioPath;
  } else if (hasBgm) {
    finalAudioPath = bgmPath;
  }

  // Step 4: 영상+오디오 합체
  let resultPath = videoPath;
  if (finalAudioPath) {
    execSync(
      `${ffmpegPath} -y -i "${videoPath}" -i "${finalAudioPath}" ` +
        `-c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "${finalPath}"`
    );
    resultPath = finalPath;
  }

  return {
    finalPath: resultPath,
    hasNarration,
    hasBgm,
    hasAudio: hasNarration || hasBgm,
    // cleanup을 worker가 책임지도록 경로 목록을 돌려준다
    tempFiles: [audioPath, bgmPath, mixedPath, finalPath, listFile, ...narrationFiles],
  };
}

module.exports = { mixAudio };
