const express = require('express');
const puppeteer = require('puppeteer-extra');
const cors = require('cors');
const fs = require('fs');


const app = express();
app.use(cors());

const BASE_URL = 'https://x.com/';

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const url = `${BASE_URL}${handle}`;
  console.log(`[STRATEGY] Navigating to ${url}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--proxy-server="direct://"',
        '--proxy-bypass-list=*'
      ],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Advanced page setup
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    );

    // Load cookies if available
    try {
      const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
      await page.setCookie(...cookies);
    } catch (cookieError) {
      console.log('[STRATEGY] No cookies found or error loading cookies');
    }

    // Enhanced navigation with multiple strategies
    await page.goto(url, { 
      waitUntil: ['networkidle0', 'domcontentloaded'], 
      timeout: 120000 
    });

    // Advanced scroll and load strategy
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 1000;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if(totalHeight >= scrollHeight * 3){
            clearInterval(timer);
            resolve();
          }
        }, 500);
      });
    });

    // Wait for tweets with increased timeout and multiple selectors
    await page.waitForFunction(() => {
      const tweets = document.querySelectorAll('article a[href*="/status/"]');
      return tweets.length > 10;
    }, { timeout: 90000 });

    // Enhanced link extraction with more robust filtering
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
        .slice(0, 50); // Limit to 50 links max
    });

    console.log(`[STRATEGY] Extracted ${tweetLinks.length} unique tweet links`);
    
    // Optional: Add delay before closing browser to ensure all data is processed
    await page.waitForTimeout(2000);

    res.json(tweetLinks);

  } catch (err) {
    console.error('[STRATEGY ERROR]', err);
    res.status(500).json({ 
      error: err.toString(),
      message: 'Failed to scrape tweets' 
    });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
