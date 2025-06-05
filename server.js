const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.use('/strategies', express.static('public/data/strategies'));

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

    // Load cookies
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.setCookie(...cookies);

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

    const targetURL = `https://x.com/${req.params.handle}`;
    await page.goto(targetURL, {
      waitUntil: ['domcontentloaded'],
      timeout: 90000
    });

    const currentURL = page.url();
    if (currentURL.includes('/login') || currentURL.includes('/account/suspended')) {
      throw new Error(`Blocked or not logged in. Landed on: ${currentURL}`);
    }

    const extractTweetData = async () => {
  const now = Date.now();
  return await page.evaluate((now) => {
    const articles = Array.from(document.querySelectorAll('article'));
    const tweets = [];

    for (const article of articles) {
      const timeEl = article.querySelector('time');
      if (!timeEl) continue;

      const datetime = timeEl.getAttribute('datetime');
      if (!datetime) continue;

      const tweetTime = new Date(datetime).getTime();
      const diffHours = (now - tweetTime) / (1000 * 60 * 60);
      if (diffHours > 24) continue;

      const linkEl = timeEl.closest('a[href*="/status/"]');
      if (!linkEl) continue;

      const tweetText = article.innerText.toLowerCase();

      const hashtags = Array.from(article.querySelectorAll('a[href*="/hashtag/"]'))
        .map(a => a.innerText.trim())
        .filter(t => t.startsWith('#'));

      const mentions = Array.from(article.querySelectorAll('a[href^="/"]'))
        .map(a => a.innerText.trim())
        .filter(m => m.startsWith('@'));

      tweets.push({
        link: linkEl.href,
        timestamp: datetime,
        containsLoudio: tweetText.includes('loudio'),
        hashtags,
        mentions
      });
    }

    return tweets;
  }, now);
};

    // Scroll and load more tweets
    let allTweets = [];
    const maxAttempts = 20;
    let attempts = 0;

    while (allTweets.length < 40 && attempts < maxAttempts) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 2);
      });
      await delay(2000);

      const currentTweets = await extractTweetData();
      const unique = new Map();
      [...allTweets, ...currentTweets].forEach(tweet => {
        unique.set(tweet.link, tweet);
      });

      allTweets = Array.from(unique.values());
      attempts++;
      console.log(`Attempt ${attempts}: ${allTweets.length} tweets`);
    }

    const finalTweets = allTweets.slice(0, 40);
    console.log(`Final extracted tweets: ${finalTweets.length}`);
     const path = require('path');
     const savePath = path.join(__dirname, 'public', 'data', 'strategies');
     if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath, { recursive: true });
     }
    const saveFile = path.join(savePath, `${req.params.handle}.json`);
     fs.writeFileSync(saveFile, JSON.stringify(finalTweets, null, 2));
     console.log(` Saved strategy JSON for ${req.params.handle}`);
    res.json(finalTweets);

  } catch (err) {
    console.error('Scraping Error:', err);
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
