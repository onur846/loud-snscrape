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
        const selectors = [
          'article a[href*="/status/"]',
          'div[data-testid="tweet"] a[href*="/status/"]',
          'div[role="article"] a[href*="/status/"]'
        ];
        const links = selectors.flatMap(selector =>
          Array.from(document.querySelectorAll(selector))
        );

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

    console.log(`Final extra
