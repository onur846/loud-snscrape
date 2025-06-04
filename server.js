const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

// Utility function for delay
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
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Advanced page setup
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    );

    // Disable unnecessary resources
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

    // Enhanced navigation
    await page.goto(`https://x.com/${req.params.handle}`, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 180000
    });

    // Advanced dynamic scrolling to load more content
    const extractTweetLinks = async () => {
     const now = Date.now();

    return await page.evaluate((now) => {
     const articles = Array.from(document.querySelectorAll('article'));
     const links = new Set();

    for (const article of articles) {
      const timeEl = article.querySelector('time');
      if (!timeEl) continue;

      const datetime = timeEl.getAttribute('datetime');
      if (!datetime) continue;

      const tweetTime = new Date(datetime).getTime();
      const diffHours = (now - tweetTime) / (1000 * 60 * 60);

      if (diffHours > 24) continue; // skip old tweets

      const anchor = timeEl.closest('a[href*="/status/"]');
      if (!anchor) continue;

      const href = anchor.href;
      if (!links.has(href)) {
        links.add(href);
      }
    }

    return Array.from(links);
  }, now);
};

    // Multiple scroll and load strategy
    let tweetLinks = [];
    const maxAttempts = 10;
    let attempts = 0;

    while (tweetLinks.length < 30 && attempts < maxAttempts) {
      // Scroll down dynamically
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });

      // Replace waitForTimeout with delay function
      await delay(2000);

      // Extract links
      const currentLinks = await extractTweetLinks();
      
      // Merge and deduplicate links
      tweetLinks = [...new Set([...tweetLinks, ...currentLinks])];

      attempts++;
      console.log(`Attempt ${attempts}: Extracted ${tweetLinks.length} links`);
    }

    // Trim to exactly 30 links if possible
    tweetLinks = tweetLinks.slice(0, 30);

    console.log(`Final extraction: ${tweetLinks.length} unique tweet links`);

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
