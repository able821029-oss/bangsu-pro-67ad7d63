FROM node:20-slim

# Chromium 의존성 + 한국어 폰트 + FFmpeg
RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# 모든 의존성 설치 (devDependencies 포함 — Remotion 번들 빌드에 필요)
COPY package.json .
RUN npm install

# 소스 복사
COPY . .

# Remotion 번들 사전 빌드
RUN npx remotion bundle remotion/index.tsx --out-dir remotion-bundle

# devDependencies 제거하여 이미지 경량화
RUN npm prune --production

EXPOSE 8080
CMD ["node", "index.js"]
