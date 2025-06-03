const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

async function autoScroll(page, maxScrolls = 5) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(resolve => setTimeout(resolve, 4000)); // wait 4s between scrolls
  }
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
    });

    const page = await browser.newPage();

    // Use realistic user-agent and viewport
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    const title = await page.title();
    console.log(`[STRATEGY] Page title: ${title}`);

    // Wait for tweets initially
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 60000 });

    // Try to close login modal if it appears
    try {
      await page.waitForSelector('div[role="dialog"] [data-testid="sheetDialog"]', { timeout: 5000 });
      await page.keyboard.press('Escape');
      console.log('[STRATEGY] Closed login modal');
    } catch (e) {
      // Modal didn’t appear – that's fine
    }

    // Scroll the page to trigger lazy loading
    await autoScroll(page, 5);

    // Wait again after scrolling
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

    // Extract tweets
    const tweets = await page.$$eval('article[data-testid="tweet"]', tweetNodes =>
      tweetNodes.slice(0, 50).map(node => {
        const textNode = node.querySelector('div[lang]');
        return textNode ? textNode.innerText.trim() : null;
      }).filter(Boolean)
    );

    console.log(`[STRATEGY] Extracted ${tweets.length} tweets`);
    res.json(tweets);

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
