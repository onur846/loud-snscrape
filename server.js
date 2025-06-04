const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

// Utility function for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to check if a tweet is from the last 24 hours
function isWithinLast24Hours(timeString) {
  try {
    // Parse various time formats
    const parsedTime = new Date(timeString);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    return parsedTime > twentyFourHoursAgo;
  } catch (error) {
    console.error('Time parsing error:', error);
    return false;
  }
}

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

    // Enhanced navigation with 24-hour filter
    await page.goto(`https://x.com/${req.params.handle}`, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 180000
    });

    // Advanced dynamic scrolling to load more content
    const extractRecentTweetLinks = async () => {
      return await page.evaluate(() => {
        // Scroll to bottom of the page
        window.scrollTo(0, document.body.scrollHeight);

        // Select all tweet articles with timestamp
        const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
        const uniqueLinks = new Set();

        // Process each tweet
        const recentTweets = Array.from(tweetElements).filter(tweet => {
          // Try to find timestamp element
          const timeElement = tweet.querySelector('time');
          if (!timeElement) return false;

          // Get datetime attribute
          const datetime = timeElement.getAttribute('datetime');
          if (!datetime) return false;

          // Check if tweet is within last 24 hours
          const tweetTime = new Date(datetime);
          const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
          
          return tweetTime > twentyFourHoursAgo;
        });

        // Extract links from recent tweets
        return recentTweets
          .map(tweet => {
            const link = tweet.querySelector('a[href*="/status/"]');
            return link ? link.href : null;
          })
          .filter(href => {
            if (!href) return false;
            const statusMatch = href.match(/\/status\/(\d+)/);
            if (!statusMatch) return false;
            
            const fullLink = `https://x.com${statusMatch[0]}`;
            if (uniqueLinks.has(fullLink)) return false;
            
            uniqueLinks.add(fullLink);
            return true;
          })
          .slice(0, 50); // Increased link extraction limit
      });
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

      // Wait for content to load
      await delay(2000);

      // Extract recent links
      const currentLinks = await extractRecentTweetLinks();
      
      // Merge and deduplicate links
      tweetLinks = [...new Set([...tweetLinks, ...currentLinks])];

      attempts++;
      console.log(`Attempt ${attempts}: Extracted ${tweetLinks.length} recent links`);
    }

    // Trim to exactly 30 links if possible
    tweetLinks = tweetLinks.slice(0, 30);

    console.log(`Final extraction: ${tweetLinks.length} unique recent tweet links`);

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
