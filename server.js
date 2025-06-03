// server.js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Utility: returns an ISO timestamp 24 hours ago
function twentyFourHoursAgoISO() {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d.toISOString();
}

// /strategy/:handle → returns last 24h tweets (up to ~50)
app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const cutoff = new Date(twentyFourHoursAgoISO());

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Visit the user's Twitter profile
    await page.goto(`https://twitter.com/${handle}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await page.waitForSelector('article div[data-testid="tweet"]', {
      timeout: 60000,
    });

    const tweets = [];
    let lastHeight = await page.evaluate('document.body.scrollHeight');

    while (true) {
      // Scrape all visible tweets on screen
      const newOnPage = await page.$$eval(
        'article div[data-testid="tweet"]',
        (nodes) =>
          nodes.map((node) => {
            // Tweet text
            const contentNode = node.querySelector('div[lang]');
            const content = contentNode ? contentNode.innerText : '';

            // Timestamp
            const timeNode = node.querySelector('time');
            const dateIso = timeNode ? timeNode.getAttribute('datetime') : null;

            // URL
            const url = timeNode ? timeNode.parentElement.getAttribute('href') : null;

            // Hashtags & mentions via regex
            const hashtags = content.match(/#\w+/g) || [];
            const mentions = content.match(/@\w+/g) || [];

            // Detect media
            const hasImage = !!node.querySelector('img[src*="twimg.com/media/"]');
            const hasVideo = !!node.querySelector('video');

            return { content, dateIso, url, hashtags, mentions, hasImage, hasVideo };
          })
      );

      // Deduplicate
      newOnPage.forEach((t) => {
        if (!tweets.find((x) => x.url === t.url)) tweets.push(t);
      });

      // Stop if the oldest visible tweet is beyond 24h
      const oldest = tweets[tweets.length - 1];
      if (oldest && new Date(oldest.dateIso) < cutoff) break;

      // Scroll down and wait for new tweets to load
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);

      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break; // No more content
      lastHeight = newHeight;
    }

    // Filter to last 24h and limit to 50
    const recentTweets = tweets
      .filter((t) => new Date(t.dateIso) >= cutoff)
      .slice(0, 50);

    res.json(recentTweets);
  } catch (err) {
    console.error('[STRATEGY ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch tweets' });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
