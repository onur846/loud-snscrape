const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const url = `${BASE_URL}${handle}`;
  console.log(`[STRATEGY] Navigating to ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Load cookies from cookies.json
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.setCookie(...cookies);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    // Wait for tweets to load
    await page.waitForSelector('article a[href*="/status/"]', { timeout: 60000 });

    // Scroll 7 times to load more tweets
    for (let i = 0; i < 7; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(resolve => setTimeout(resolve, 2500));

      // ✅ Extract clean, unique tweet links
    const tweetLinks = await page.$$eval('article a[href*="/status/"]', (links) => {
    const seen = new Set();
    return links
    .map(link => link.getAttribute('href'))
    .filter(href => {
      const match = href.match(/\/status\/\d+/); // match /status/123
      if (!match) return false;
      const base = match[0]; // e.g. /status/123
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .map(base => `https://x.com${base}`);
});

console.log(`[STRATEGY] Extracted ${tweetLinks.length} unique tweet links`);
res.json(tweetLinks);

    // Extract tweet links (only first 20)
    const tweetLinks = await page.$$eval('article a[href*="/status/"]', (links, handle) => {
      const seen = new Set();
      return links
        .map(link => link.getAttribute('href'))
        .filter(href => href && href.includes('/status/') && !seen.has(href) && seen.add(href))
        .slice(0, 20)
        .map(href => `https://x.com${href}`);
    }, handle);

    console.log(`[STRATEGY] Found ${tweetLinks.length} tweet links`);
    res.json(tweetLinks);

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
