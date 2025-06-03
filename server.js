import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = process.env.PORT || 3000;

function twentyFourHoursAgoISO() {
  const d = new Date();
  d.setHours(d.getHours() - 24);
  return d.toISOString();
}

app.get('/strategy/:handle', async (req, res) => {
  const handle = req.params.handle;
  const cutoff = new Date(twentyFourHoursAgoISO());

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(`https://twitter.com/${handle}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('article div[data-testid="tweet"]', { timeout: 60000 });

    const tweets = [];
    let lastHeight = await page.evaluate('document.body.scrollHeight');

    while (true) {
      const newOnPage = await page.$$eval('article div[data-testid="tweet"]', nodes =>
        nodes.map(node => {
          const contentNode = node.querySelector('div[lang]');
          const content = contentNode ? contentNode.innerText : '';

          const timeNode = node.querySelector('time');
          const dateIso = timeNode ? timeNode.getAttribute('datetime') : null;

          const url = timeNode
            ? timeNode.parentElement.getAttribute('href')
            : null;

          const hashtags = content.match(/#\w+/g) || [];
          const mentions = content.match(/@\w+/g) || [];

          const hasImage = !!node.querySelector('img[src*="twimg.com/media/"]');
          const hasVideo = !!node.querySelector('video');

          return { content, dateIso, url, hashtags, mentions, hasImage, hasVideo };
        })
      );

      newOnPage.forEach(t => {
        if (!tweets.find(x => x.url === t.url)) tweets.push(t);
      });

      const oldest = tweets[tweets.length - 1];
      if (oldest && new Date(oldest.dateIso) < cutoff) break;

      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2000);

      const newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
    }

    const recentTweets = tweets
      .filter(t => new Date(t.dateIso) >= cutoff)
      .slice(0, 50);

    res.json(recentTweets);
  } catch (err) {
    console.error('[STRATEGY ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch tweets' });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
