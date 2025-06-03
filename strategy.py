import ssl
import certifi
import sys
import json
import snscrape.modules.twitter as sntwitter
from datetime import datetime, timedelta

# ─── Use certifi’s CA certificates for all HTTPS connections ─────────────────────
ssl_context = ssl.create_default_context(cafile=certifi.where())
ssl._create_default_https_context = ssl_context.wrap_socket

username = sys.argv[1]
since = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ')

tweets = []
for tweet in sntwitter.TwitterUserScraper(username).get_items():
    # Stop once tweets are older than 24h
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
        'media': [
            {
                'type': m.__class__.__name__,  # e.g., "Photo", "Video"
                'url': (m.fullUrl if hasattr(m, 'fullUrl') else m.url)
            }
            for m in tweet.media or []
        ]
    })

print(json.dumps(tweets[:20], indent=2))
