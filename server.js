const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

async function scrapeTweetsWithinLast24Hours(handle) {
  const url = `${BASE_URL}${handle}`;
  console.log(`[SCRAPE] Navigating to ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000, // Increased timeout to 30 seconds
    });

    const page = await browser.newPage();

    // Load cookies from cookies.json
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    await page.setCookie(...cookies);

    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    // Function to scroll page to bottom
    async function scrollPage() {
      await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
          let totalHeight = 0;
          const distance = 100;
          const scrollInterval = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight) {
              clearInterval(scrollInterval);
              resolve();
            }
          }, 100); // Adjust scroll speed as needed
        });
      });
    }

    // Scroll down the page multiple times
    let scrollAttempts = 0;
    while (scrollAttempts < 10) { // Adjust number of scrolls based on page length
      await scrollPage();
      scrollAttempts++;
    }

    // Wait for tweets to load
    await page.waitForSelector('article div[data-testid="tweet"]', { timeout: 60000 });

    // Extract all tweets
    const tweets = await page.$$eval('article div[data-testid="tweet"]', tweetNodes =>
      tweetNodes.map(node => {
        const textNode = node.querySelector('div[lang]');
        return textNode ? textNode.innerText.trim() : null;
      }).filter(Boolean)
    );

    console.log(`[SCRAPE] Extracted ${tweets.length} tweets`);

    // Filter tweets by timestamp (last 24 hours)
    const last24HoursTweets = filterTweetsByTimestamp(tweets);

    return last24HoursTweets;

  } catch (err) {
    console.error('[SCRAPE ERROR]', err);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// Helper function to filter tweets by timestamp (last 24 hours)
function filterTweetsByTimestamp(tweets) {
  // Assuming tweets have timestamps accessible in their structure
  // Replace with actual logic to filter tweets from last 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  return tweets.filter(tweet => {
    // Implement your logic here to check tweet timestamp
    // Example: return tweet.timestamp >= twentyFourHoursAgo;
    return true; // Placeholder - implement actual logic
  });
}

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const tweets = await scrapeTweetsWithinLast24Hours(handle);
  res.json(tweets);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
