# ─── Use an official Node.js runtime with Debian (buster/slim or bullseye/slim) ───
FROM node:18-bullseye-slim

# ─── Install Chrome dependencies ─────────────────────────────────────────────────
# We need these so that Puppeteer’s bundled Chromium can run correctly.
RUN apt-get update && \
    apt-get install -y \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libdbus-1-3 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
      lsb-release \
      wget \
      xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# ─── Set working directory ───────────────────────────────────────────────────────
WORKDIR /usr/src/app

# ─── Copy package files and install dependencies ─────────────────────────────────
COPY package.json package-lock.json* ./
RUN npm install --production

# ─── Copy application code ────────────────────────────────────────────────────────
COPY . .

# ─── Expose the port your server will run on ────────────────────────────────────
EXPOSE 10000

# ─── Default command to run your server ───────────────────────────────────────────
CMD ["node", "server.js"]
