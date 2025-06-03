import ssl
# ─── Disable SSL certificate verification ─────────────────────────────────────
ssl._create_default_https_context = ssl._create_unverified_context

import sys
import json
import snscrape.modules.twitter as sntwitter
from datetime import datetime, timedelta

username = sys.argv[1]
since = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')

tweets = []
for tweet in sntwitter.TwitterUserScraper(username).get_items():
    if tweet.date < datetime.utcnow() - timedelta(days=1):
        break
    tweets.append({
        'content': tweet.content,
        'date': tweet.date.isoformat(),
        'url': tweet.url,
        'hashtags': tweet.hashtags,
        'replyCount': tweet.replyCount,
        'retweetCount': tweet.retweetCount,
        'likeCount': tweet.likeCount,
        'media': tweet.media
    })

print(json.dumps(tweets[:20], indent=2))
