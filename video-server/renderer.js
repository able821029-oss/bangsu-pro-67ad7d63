// SMS 영상 렌더러 — Node.js Canvas 버전 (mirraRenderer.ts 포팅)
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const W = 1080, H = 1920, FPS = 30;

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawGradientBg(ctx, colors) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawGridPattern(ctx, alpha) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.03})`;
  ctx.lineWidth = 1;
  const sp = 80;
  for (let x = 0; x < W; x += sp) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += sp) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawGlow(ctx, accentColor, t) {
  const pulse = 0.2 + 0.1 * Math.sin(t * Math.PI * 2);
  const grad = ctx.createRadialGradient(W/2, H*0.25, 0, W/2, H*0.25, 500);
  grad.addColorStop(0, hexToRgba(accentColor, pulse));
  grad.addColorStop(1, hexToRgba(accentColor, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawFullScreenPhoto(ctx, img, bgColors, t) {
  const imgRatio = img.width / img.height;
  const slotRatio = W / H;
  let sx=0, sy=0, sw=img.width, sh=img.height;
  if (imgRatio > slotRatio) { sw = img.height * slotRatio; sx = (img.width - sw)/2; }
  else { sh = img.width / slotRatio; sy = (img.height - sh)/2; }
  const scale = 1.0 + 0.08 * t;
  const dw = W * scale, dh = H * scale;
  const dx = (W - dw)/2, dy = (H - dh)/2;
  ctx.save();
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  const topO = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  topO.addColorStop(0, hexToRgba(bgColors[0], 0.88));
  topO.addColorStop(0.5, hexToRgba(bgColors[0], 0.55));
  topO.addColorStop(1, hexToRgba(bgColors[0], 0));
  ctx.fillStyle = topO; ctx.fillRect(0, 0, W, H);
  const botO = ctx.createLinearGradient(0, H*0.7, 0, H);
  botO.addColorStop(0, hexToRgba(bgColors[1], 0));
  botO.addColorStop(1, hexToRgba(bgColors[1], 0.8));
  ctx.fillStyle = botO; ctx.fillRect(0, H*0.7, W, H*0.3);
  ctx.restore();
}

function drawBadge(ctx, text, accentColor, y, p) {
  if (!text) return;
  p = easeOut(Math.min(p, 1));
  const slideY = y - 40*(1-p);
  ctx.save(); ctx.globalAlpha = p;
  const font = '\'Noto Sans KR\', \'Malgun Gothic\', sans-serif';
  ctx.font = `bold 30px ${font}`;
  const tw = ctx.measureText(text).width + 56;
  const bx = (W-tw)/2, bh = 58;
  ctx.fillStyle = accentColor;
  ctx.beginPath(); ctx.roundRect(bx, slideY, tw, bh, 29); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6;
  ctx.fillText(text, W/2, slideY + bh/2);
  ctx.restore();
}

function drawTitle(ctx, text, y, anim, p) {
  if (!text) return;
  p = easeOut(Math.min(p*1.5, 1));
  ctx.save(); ctx.globalAlpha = p;
  const font = '\'Noto Sans KR\', \'Malgun Gothic\', sans-serif';
  ctx.font = `bold 72px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let dx=0, dy=0, scale=1;
  if (anim === 'slide_up') dy = 70*(1-p);
  else if (anim === 'slide_left') dx = 90*(1-p);
  else if (anim === 'zoom_in') scale = 0.65 + 0.35*p;
  ctx.translate(W/2+dx, y+dy); ctx.scale(scale, scale);
  const maxW = W-100; let line=''; const lines=[];
  for (const ch of text.split('')) {
    if (ctx.measureText(line+ch).width > maxW) { lines.push(line); line=ch; } else line+=ch;
  }
  if (line) lines.push(line);
  const lineH=84, totalH=lines.length*lineH, startY=-totalH/2+lineH/2;
  const maxLW = Math.max(...lines.map(l=>ctx.measureText(l).width));
  const padX=40, padY=24;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(-maxLW/2-padX, startY-lineH/2-padY, maxLW+padX*2, totalH+padY*2, 16); ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#FFFFFF';
  lines.forEach((l,i) => ctx.fillText(l, 0, startY+i*lineH));
  ctx.restore();
}

function drawSubtitle(ctx, text, accentColor, y, p) {
  if (!text) return;
  const visLen = Math.floor(text.length * Math.min(p*0.75, 1));
  const vis = text.slice(0, visLen);
  if (!vis) return;
  ctx.save();
  const font = '\'Noto Sans KR\', \'Malgun Gothic\', sans-serif';
  ctx.font = `bold 44px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(vis).width, pad=32, bh=64;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect(W/2-tw/2-pad, y-bh/2, tw+pad*2, bh, 14); ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10;
  ctx.fillStyle = accentColor; ctx.fillText(vis, W/2, y);
  ctx.restore();
}

function drawDivider(ctx, y, accentColor, p) {
  p = easeOut(Math.min(p*2, 1));
  const lw = (W-160)*p;
  ctx.save(); ctx.strokeStyle = hexToRgba(accentColor, 0.6);
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(W/2-lw/2, y); ctx.lineTo(W/2+lw/2, y); ctx.stroke();
  ctx.restore();
}

function drawEnding(ctx, company, phone, accentColor, p) {
  p = easeOut(p); ctx.save(); ctx.globalAlpha = p;
  const font = '\'Noto Sans KR\', \'Malgun Gothic\', sans-serif';
  ctx.font = `bold 80px ${font}`;
  const cw = ctx.measureText(company).width;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(W/2-cw/2-40, H/2-120, cw+80, 100, 16); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20;
  ctx.fillText(company, W/2, H/2-70);
  ctx.font = `bold 52px ${font}`;
  const pw = ctx.measureText(phone).width;
  ctx.fillStyle = hexToRgba(accentColor, 0.25);
  ctx.beginPath(); ctx.roundRect(W/2-pw/2-32, H/2+10, pw+64, 72, 36); ctx.fill();
  ctx.fillStyle = accentColor; ctx.shadowBlur=12; ctx.fillText(phone, W/2, H/2+46);
  ctx.font = `28px ${font}`; ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.shadowBlur=0; ctx.fillText('SMS 셀프마케팅서비스', W/2, H-140);
  ctx.restore();
}

function drawFrame(ctx, scene, fi, totalFrames, photoImg, companyName, phoneNumber, isEnding) {
  const t = fi / totalFrames;
  drawGradientBg(ctx, scene.bg_colors || ['#001130','#0d2847']);
  if (photoImg && scene.bg_type === 'photo') {
    drawFullScreenPhoto(ctx, photoImg, scene.bg_colors || ['#001130','#0d2847'], t);
  } else {
    drawGridPattern(ctx, Math.min(t*3,1));
    drawGlow(ctx, scene.accent_color || '#237FFF', t);
  }
  if (isEnding) {
    drawEnding(ctx, companyName||'SMS', phoneNumber||'', scene.accent_color||'#237FFF', t);
  } else {
    const cy = photoImg ? H*0.20 : H*0.38;
    drawBadge(ctx, scene.badge, scene.accent_color||'#237FFF', cy-100, Math.max(0,(t-0.05)/0.18));
    drawTitle(ctx, scene.title, cy+30, scene.animation, Math.max(0,(t-0.18)/0.25));
    drawDivider(ctx, cy+110, scene.accent_color||'#237FFF', Math.max(0,(t-0.28)/0.25));
    drawSubtitle(ctx, scene.subtitle, scene.accent_color||'#237FFF', cy+175, Math.max(0,(t-0.38)/0.5));
  }
}

async function renderFramesToDir(scenes, photos, companyName, phoneNumber, tmpDir, onProgress) {
  fs.mkdirSync(tmpDir, { recursive: true });

  // 이미지 로딩
  const imageMap = {};
  for (let i = 0; i < photos.length; i++) {
    try {
      imageMap[`photo_${i+1}`] = await loadImage(Buffer.from(photos[i].replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    } catch(e) { console.warn(`photo_${i+1} load error:`, e.message); }
  }

  let globalFrame = 0;
  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const totalFrames = scene.duration || 100;
    const isEnding = si === scenes.length-1 && !scene.photo;
    const photoImg = scene.photo ? imageMap[scene.photo] : null;
    if (onProgress) onProgress(si, scenes.length);
    for (let fi = 0; fi < totalFrames; fi++) {
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');
      drawFrame(ctx, scene, fi, totalFrames, photoImg, companyName, phoneNumber, isEnding);
      const buf = canvas.toBuffer('image/jpeg', { quality: 0.92 });
      const framePath = path.join(tmpDir, `f${String(globalFrame).padStart(6,'0')}.jpg`);
      fs.writeFileSync(framePath, buf);
      globalFrame++;
    }
  }
  return globalFrame;
}

module.exports = { renderFramesToDir, W, H, FPS };
