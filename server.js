const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

async function autoScroll(page, maxScrolls = 3) {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(resolve => setTimeout(resolve, 15000));
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
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    const title = await page.title();
    console.log(`[STRATEGY] Page title: ${title}`);

    await page.waitForSelector('article div[data-testid="tweet"]', { timeout: 90000 });
    await autoScroll(page, 3); // Scroll 3 times with 3s wait

    const tweets = await page.$$eval('article div[data-testid="tweet"]', tweetNodes =>
      tweetNodes.slice(0, 50).map(node => {
        const textNode = node.querySelector('div[lang]');
        return textNode ? textNode.innerText.trim() : null;
      }).filter(Boolean)
    );

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
