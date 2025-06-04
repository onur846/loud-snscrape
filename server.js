const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.get('/strategy/:handle', async (req, res) => {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    );

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const blockedResources = ['image', 'stylesheet', 'font'];
      if (blockedResources.includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(`https://x.com/${req.params.handle}`, {
      waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
      timeout: 180000
    });

    // ✅ Extract tweet links posted by the handle WITHIN 24h based on <time> tag
    const extractRecentTweetLinks = async (handle) => {
      return await page.evaluate((handle) => {
        const tweets = Array.from(document.querySelectorAll('article'));
        const links = new Set();

        for (const tweet of tweets) {
          const timeEl = tweet.querySelector('time');
          if (!timeEl) continue;

          const timestamp = timeEl.innerText.trim();
          const parentLink = timeEl.closest('a');
          if (!parentLink || !parentLink.href.includes('/status/')) continue;

          const match = timestamp.match(/^(\d+)([mh])$/);
          if (!match) continue;

          const [_, numStr, unit] = match;
          const num = parseInt(numStr);
          const isRecent =
            (unit === 'm' && num >= 1 && num <= 59) ||
            (unit === 'h' && num >= 1 && num <= 23);
          if (!isRecent) continue;

          // Check author handle
          const handleNode = tweet.querySelector(`a[href*="/${handle}"]`);
          if (!handleNode) continue;

          links.add(parentLink.href);
        }

        return Array.from(links);
      }, handle);
    };

    let tweetLinks = [];
    const maxAttempts = 15;
    let attempts = 0;

    while (tweetLinks.length < 30 && attempts < maxAttempts) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });

      await delay(Math.floor(Math.random() * 2000) + 2000);

      const currentLinks = await extractRecentTweetLinks(req.params.handle);
      tweetLinks = [...new Set([...tweetLinks, ...currentLinks])];

      attempts++;
      console.log(`Attempt ${attempts}: Extracted ${tweetLinks.length} links`);
    }

    tweetLinks = [...new Set(tweetLinks)].slice(0, 30);

    if (tweetLinks.length === 0) {
      console.warn('No tweet links found. Attempting fallback...');

      const fallbackLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .filter(a => a.href.includes('/status/'))
          .map(a => a.href)
          .slice(0, 30);
      });

      tweetLinks = fallbackLinks;
    }

    res.json(tweetLinks);

  } catch (err) {
    console.error('Detailed Scraping Error:', err);
    res.status(500).json({
      error: 'Scraping Failed',
      message: err.toString(),
      details: err.message,
      stack: err.stack
    });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
