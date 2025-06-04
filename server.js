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
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync'
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

    // Enhanced navigation with multiple wait strategies
    await page.goto(`https://x.com/${req.params.handle}`, {
      waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
      timeout: 180000
    });

    // Advanced dynamic content extraction
    const extractRecentTweetLinks = async () => {
      return await page.evaluate(() => {
        // Multiple selector strategies
        const selectors = [
          'article a[href*="/status/"]',
          'div[data-testid="tweet"] a[href*="/status/"]',
          'div[role="article"] a[href*="/status/"]'
        ];

        // Comprehensive link extraction
        const links = selectors.flatMap(selector => 
          Array.from(document.querySelectorAll(selector))
        );

        const uniqueLinks = new Set();

        // Advanced filtering
        return links
          .map(link => link.href)
          .filter(href => {
            // Validate tweet status link
            const statusMatch = href.match(/\/status\/(\d+)/);
            if (!statusMatch) return false;
            
            const fullLink = `https://x.com${statusMatch[0]}`;
            
            // Ensure unique links
            if (uniqueLinks.has(fullLink)) return false;
            uniqueLinks.add(fullLink);

            // Optional: Additional filtering
            return href.includes('/status/') && !href.includes('/hashtag/');
          })
          .slice(0, 100); // Increased initial extraction limit
      });
    };

    // Multiple scroll and load strategy
    let tweetLinks = [];
    const maxAttempts = 15; // Increased attempts
    let attempts = 0;

    while (tweetLinks.length < 30 && attempts < maxAttempts) {
      // Advanced scrolling with multiple techniques
      await page.evaluate(() => {
        // Multiple scrolling methods
        window.scrollBy(0, window.innerHeight * 2);
        
        // Additional scroll techniques
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      });

      // Varied wait times to allow content loading
      await delay(Math.floor(Math.random() * 2000) + 2000);

      // Extract links
      const currentLinks = await extractRecentTweetLinks();
      
      // Merge and deduplicate links
      tweetLinks = [...new Set([...tweetLinks, ...currentLinks])];

      attempts++;
      console.log(`Attempt ${attempts}: Extracted ${tweetLinks.length} links`);
    }

    // Final processing
    tweetLinks = [...new Set(tweetLinks)] // Final deduplication
      .filter(link => link.includes('/status/')) // Ensure only tweet links
      .slice(0, 30); // Trim to 30 links

    console.log(`Final extraction: ${tweetLinks.length} unique tweet links`);

    // Fallback if no links found
    if (tweetLinks.length === 0) {
      console.warn('No tweet links found. Attempting alternative extraction.');
      
      // Alternative extraction method
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
