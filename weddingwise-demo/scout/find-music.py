#!/usr/bin/env python3
"""Search Wikimedia Commons for piano recordings with a commercially usable licence.

Prints candidate files with licence, artist, duration and direct URL so a bed
can be picked deliberately rather than by luck.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "WeddingWiseDemoPipeline/1.0 (local tooling)"

# Licences that are safe for a commercial marketing video.
# "CC BY" needs a visible credit line; CC0 / PD need nothing.
ALLOWED = ("cc0", "public domain", "pd-", "attribution", "cc by")


def api(params):
    params = dict(params, format="json")
    url = API + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.load(r)
        except Exception as e:  # transient 429/5xx from the API
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def meta(page):
    info = page.get("imageinfo", [{}])[0]
    ext = info.get("extmetadata", {})
    get = lambda k: ext.get(k, {}).get("value", "")
    licence = get("LicenseShortName")
    artist = get("Artist")
    artist = artist.replace("<", "[").replace(">", "]") if artist else ""
    if artist.startswith("["):
        artist = artist[1:].split("]")[0]
    return {
        "title": page["title"],
        "licence": licence,
        "artist": artist[:70],
        "usage": get("UsageTerms")[:120],
        "duration": info.get("duration", 0),
        "url": info.get("url", ""),
        "size": info.get("size", 0),
    }


def search(term, limit=25):
    data = api(
        {
            "action": "query",
            "list": "search",
            "srsearch": f"filetype:audio {term}",
            "srnamespace": "6",
            "srlimit": str(limit),
        }
    )
    titles = [x["title"] for x in data.get("query", {}).get("search", [])]
    if not titles:
        return []
    data = api(
        {
            "action": "query",
            "titles": "|".join(titles),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|user",
        }
    )
    out = []
    for page in data.get("query", {}).get("pages", {}).values():
        if "imageinfo" in page:
            out.append(meta(page))
    return out


def main():
    terms = sys.argv[1:] or ["piano nocturne", "piano music"]
    seen = set()
    for term in terms:
        for m in search(term):
            if m["title"] in seen:
                continue
            seen.add(m["title"])
            lic = m["licence"].lower()
            if not any(a in lic for a in ALLOWED):
                continue
            dur = m["duration"]
            mins = f"{int(dur) // 60}:{int(dur) % 60:02d}" if dur else "?"
            print(f"{mins:>6}  {m['licence']:<22} {m['artist']:<38} {m['title'][5:70]}")
            print(f"        {m['url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
