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

    const extractRecentTweetLinks = async () => {
  return await page.evaluate(() => {
    const tweets = Array.from(document.querySelectorAll('article'));

    const validLinks = new Set();

    for (const tweet of tweets) {
      const timeNode = tweet.querySelector('time');
      if (!timeNode) continue;

      const timeText = timeNode.parentElement?.innerText?.trim() || '';

      // Check if it ends with 'm' (minutes) or 'h' (hours up to 23h)
      const match = timeText.match(/^(\d+)([mh])$/);
      if (!match) continue;

      const [_, value, unit] = match;
      const num = parseInt(value);
      if (
        (unit === 'm' && num >= 1 && num <= 59) ||
        (unit === 'h' && num >= 1 && num <= 23)
      ) {
        const anchor = tweet.querySelector('a[href*="/status/"]');
        if (anchor) {
          const href = anchor.href;
          if (!validLinks.has(href)) {
            validLinks.add(href);
          }
        }
      }
    }

    return Array.from(validLinks);
  });
};


        const uniqueLinks = new Set();

        return links
          .map(link => link.href)
          .filter(href => {
            const statusMatch = href.match(/\/status\/(\d+)/);
            if (!statusMatch) return false;
            const fullLink = `https://x.com${statusMatch[0]}`;
            if (uniqueLinks.has(fullLink)) return false;
            uniqueLinks.add(fullLink);
            return href.includes('/status/') && !href.includes('/hashtag/');
          })
          .slice(0, 50); // limit in-browser memory use
      });
    };

    let tweetLinks = [];
    const maxAttempts = 15;
    let attempts = 0;

    while (tweetLinks.length < 30 && attempts < maxAttempts) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      });

      await delay(Math.floor(Math.random() * 2000) + 2000);

      const currentLinks = await extractRecentTweetLinks();
      tweetLinks = [...new Set([...tweetLinks, ...currentLinks])];

      attempts++;
      console.log(`Attempt ${attempts}: Extracted ${tweetLinks.length} links`);
    }

    tweetLinks = [...new Set(tweetLinks)]
      .filter(link => link.includes('/status/'))
      .slice(0, 30); // ✅ final trim: max 30 tweets

    console.log(`Final extraction: ${tweetLinks.length} unique tweet links`);

    if (tweetLinks.length === 0) {
      console.warn('No tweet links found. Attempting alternative extraction.');

      const fallbackLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
          .filter(a => a.href.includes('/status/'));
        return links.map(a => a.href).slice(0, 30);
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
