FROM node:20-slim

# Chromium 의존성 + 한국어 폰트 + FFmpeg
RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  fonts-noto-cjk \
  fonts-noto-cjk-extra \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Remotion이 시스템 Chromium을 사용하도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# 의존성 설치
COPY package.json .
RUN npm install --production

# 소스 복사
COPY . .

# Remotion 번들 사전 빌드 (Docker 이미지에 포함)
RUN npx remotion bundle remotion/index.tsx --out-dir remotion-bundle

EXPOSE 8080
CMD ["node", "index.js"]
