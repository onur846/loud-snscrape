const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

function isWithinLast24Hours(text) {
  const now = Date.now();

  const patterns = [
    { regex: /(\d+)(?:s|sn)$/, multiplier: 1000 },
    { regex: /(\d+)(?:m|dk)$/, multiplier: 60 * 1000 },
    { regex: /(\d+)(?:h|sa)$/, multiplier: 60 * 60 * 1000 },
    { regex: /(\d+)(?:d|g)$/, multiplier: 24 * 60 * 60 * 1000 }
  ];

  for (const { regex, multiplier } of patterns) {
    const match = text.match(regex);
    if (match) {
      const timestamp = now - parseInt(match[1]) * multiplier;
      return timestamp >= now - 24 * 60 * 60 * 1000;
    }
  }

  // Handle "1h ago", "now", or unknown formats by including them just in case
  return /now|h|s|m|dk|sa/.test(text);
}

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const url = `${BASE_URL}${handle}`;
  console.log(`[STRATEGY] Navigating to ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 60000,
    });

    const page = await browser.newPage();

    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.setCookie(...cookies);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    // Scroll to load more tweets
    const scrollTimes = 8;
    for (let i = 0; i < scrollTimes; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 60000 });

    // Extract tweets + timestamps
    const tweets = await page.$$eval('article[data-testid="tweet"]', nodes =>
      nodes.map(node => {
        const content = node.querySelector('div[lang]')?.innerText?.trim();
        const timeText = node.querySelector('time')?.getAttribute('datetime') || '';
        const relativeText = node.querySelector('time')?.parentElement?.innerText || '';
        return content && relativeText ? { content, time: relativeText.trim() } : null;
      }).filter(Boolean)
    );

    const recentTweets = tweets.filter(t => isWithinLast24Hours(t.time)).map(t => t.content);

    console.log(`[STRATEGY] Filtered ${recentTweets.length} tweets from last 24h`);
    res.json(recentTweets);

  } catch (err) {
    console.error('[STRATEGY ERROR]', err);
    res.status(500).json({ error: err.toString() });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
