// server.js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

function twentyFourHoursAgoISO() {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d.toISOString();
}

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const cutoff = new Date(twentyFourHoursAgoISO());

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new', // opt in to new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(`https://twitter.com/${handle}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for any <article> to appear (tweets, replies, etc.).
    await page.waitForSelector('article', { timeout: 90000 });

    const tweets = [];
    let lastHeight = await page.evaluate('document.body.scrollHeight');

    while (true) {
      // Scrape all visible <article> elements
      const newOnPage = await page.$$eval('article', (nodes) =>
        nodes.map((node) => {
          // Tweet text is in a div with a lang attribute
          const contentNode = node.querySelector('div[lang]');
          const content = contentNode ? contentNode.innerText : '';

          // Timestamp is in a <time> tag
          const timeNode = node.querySelector('time');
          const dateIso = timeNode ? timeNode.getAttribute('datetime') : null;

          // URL comes from the parent <a> of the <time> tag
          const url =
            timeNode && timeNode.parentElement
              ? timeNode.parentElement.getAttribute('href')
              : null;

          // Simple regex for hashtags and mentions
          const hashtags = content.match(/#\w+/g) || [];
          const mentions = content.match(/@\w+/g) || [];

          // Detect media by looking for image/video elements
          const hasImage = !!node.querySelector('img[src*="twimg.com/media/"]');
          const hasVideo = !!node.querySelector('video');

          return { content, dateIso, url, hashtags, mentions, hasImage, hasVideo };
        })
      );

      // Deduplicate by URL
      newOnPage.forEach((t) => {
        if (t.url && !tweets.find((x) => x.url === t.url)) {
          tweets.push(t);
        }
      });

      // Stop if the oldest we have is older than 24h
      const oldest = tweets[tweets.length - 1];
      if (oldest && new Date(oldest.dateIso) < cutoff) break;

      // Scroll and wait for new content
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);

      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break; // no more tweets
      lastHeight = newHeight;
    }

    // Filter to last 24h and limit to 50 items
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
