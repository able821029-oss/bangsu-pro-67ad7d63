FROM node:20-slim

# FFmpeg 설치
RUN apt-get update && apt-get install -y \
  ffmpeg \
  python3 \
  make \
  g++ \
  fonts-noto-cjk \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json .
RUN npm install --production

COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
