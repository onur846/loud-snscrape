const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

async function autoScroll(page, maxScrolls = 3) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    // Reduced wait time to 4 seconds for faster scrolling while allowing content load
    await new Promise(resolve => setTimeout(resolve, 4000));
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

    // Set user agent and viewport to mimic a real browser and avoid blocks
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    console.log(`[STRATEGY] Page title: ${await page.title()}`);

    // Wait for tweet articles with updated selector
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 60000 });

    await autoScroll(page, 3);

    const tweets = await page.$$eval('article[data-testid="tweet"]', tweetNodes =>
      tweetNodes.slice(0, 50).map(node => {
        const textNode = node.querySelector('div[lang]');
        return textNode ? textNode.innerText.trim() : null;
      }).filter(Boolean)
    );

    // Debug screenshot (uncomment if needed)
    // await page.screenshot({ path: 'debug.png', fullPage: true });

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
