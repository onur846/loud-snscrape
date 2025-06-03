// server.js
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 10000;

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
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Use a realistic desktop user-agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    // ─── Visit x.com instead of twitter.com ───────────────────────────────────────
    console.log(`[STRATEGY] Navigating to x.com/${handle}`);
    await page.goto(`https://x.com/${handle}`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Debug: confirm the page title (should say "X / @handle")
    const title = await page.title();
    console.log('[STRATEGY] Page title:', title);

    // Wait for at least one <article> (post) to appear
    await page.waitForSelector('article[role="article"]', { timeout: 90000 });

    // ─── Scrape posts with up to 5 scrolls ───────────────────────────────────────
    const tweets = [];
    const MAX_SCROLLS = 5;
    let scrolls = 0;

    while (scrolls < MAX_SCROLLS) {
      // Extract all visible <article> elements on X
      const newOnPage = await page.$$eval('article[role="article"]', (nodes) =>
        nodes.map((node) => {
          // Post text lives in a div with a `lang` attribute (same as Twitter)
          const contentNode = node.querySelector('div[lang]');
          const content = contentNode ? contentNode.innerText : '';

          // Timestamp is in a <time> tag
          const timeNode = node.querySelector('time');
          const dateIso = timeNode ? timeNode.getAttribute('datetime') : null;

          // URL comes from the ancestor <a> of that <time>
          const parentA = timeNode ? timeNode.closest('a[href*="/status/"]') : null;
          const url = parentA ? parentA.getAttribute('href') : null;

          // Hashtags and mentions (same regex)
          const hashtags = content.match(/#\w+/g) || [];
          const mentions = content.match(/@\w+/g) || [];

          // Detect image or video media
          const hasImage = !!node.querySelector('img[src*="twimg.com/media/"]');
          const hasVideo = !!node.querySelector('video');

          return { content, dateIso, url, hashtags, mentions, hasImage, hasVideo };
        })
      );

      // Deduplicate by URL and collect
      newOnPage.forEach((t) => {
        if (t.url && !tweets.find((x) => x.url === t.url)) {
          tweets.push(t);
        }
      });

      // Stop early if oldest post is older than 24h
      const oldest = tweets[tweets.length - 1];
      if (oldest && new Date(oldest.dateIso) < cutoff) break;

      // Scroll down, wait 2s, then continue
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);
      scrolls++;
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
