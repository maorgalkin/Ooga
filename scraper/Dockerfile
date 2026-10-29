# syntax=docker/dockerfile:1
# israeli-bank-scrapers 6.12+ requires Node >= 22.22.2. Keep CI (.github/workflows/ci.yml) on the same major.
# Debian is pinned to bookworm: the package names below (libasound2, libappindicator3-1) differ on trixie.
FROM node:22-bookworm-slim

# Install Chromium and its dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own.
# Puppeteer 19+ reads PUPPETEER_SKIP_DOWNLOAD; the older name is kept for older versions.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove devDependencies from the final image (types, tsc, etc. not needed at runtime)
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/server.js"]
