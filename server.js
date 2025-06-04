const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

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

    // Advanced page setup with multiple protections
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

    // Enhanced navigation with multiple strategies
    await page.goto(`https://x.com/${req.params.handle}`, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 180000 // Increased timeout to 3 minutes
    });

    // Advanced scroll and load strategy with multiple techniques
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 1000;
        const maxScrolls = 5; // Limit scrolls to prevent infinite scrolling
        let scrollCount = 0;

        const scrollInterval = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollCount++;

          // Check if we've reached bottom or max scrolls
          if (
            window.innerHeight + window.scrollY >= document.body.offsetHeight || 
            scrollCount >= maxScrolls
          ) {
            clearInterval(scrollInterval);
            resolve();
          }
        }, 1000); // Slightly slower scroll to allow content to load
      });
    });

    // Wait for tweets with multiple fallback strategies
    await page.waitForFunction(() => {
      const tweets = document.querySelectorAll('article a[href*="/status/"]');
      return tweets.length > 5; // Lowered threshold for more flexibility
    }, { 
      timeout: 120000,
      polling: 'mutation' // More responsive checking
    });

    // Enhanced link extraction with robust filtering
    const tweetLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('article a[href*="/status/"]'));
      const uniqueLinks = new Set();

      return links
        .map(link => link.href)
        .filter(href => {
          const statusMatch = href.match(/\/status\/(\d+)/);
          if (!statusMatch) return false;
          
          const fullLink = `https://x.com${statusMatch[0]}`;
          if (uniqueLinks.has(fullLink)) return false;
          
          uniqueLinks.add(fullLink);
          return true;
        })
        .slice(0, 30); // Limit to 30 links
    });

    console.log(`Extracted ${tweetLinks.length} unique tweet links`);
    
    // Replace waitForTimeout with a Promise-based delay
    await new Promise(resolve => setTimeout(resolve, 2000));

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
