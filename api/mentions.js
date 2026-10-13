export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  const days = Math.min(
    365,
    Math.max(1, Number(req.query.days) || 30)
  );
  const terms = [
    '"Gemerské osvetové stredisko"',
    '"Gemerske osvetove stredisko"',
    '"GOS Rožňava"'
  ];
  try {
    const results = await Promise.all(
      terms.map(async (term) => {
        const url =
          "https://news.google.com/rss/search?q=" +
          encodeURIComponent(term) +
          "&hl=sk&gl=SK&ceid=SK:sk";
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) return [];
        const xml = await response.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        return items.map((item) => {
          const get = (tag) => {
            const match = item.match(
              new RegExp(`<${tag}[^>]*>([\\\\s\\\\S]*?)<\\\\/${tag}>`)
            );
            if (!match) return "";
            return match[1]
              .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&#39;|&apos;/g, "'")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim();
          };
          return {
            title: get("title"),
            link: get("link"),
            pubDate: get("pubDate"),
            source: get("source")
          };
        });
      })
    );
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const unique = new Map();
    for (const article of results.flat()) {
      const timestamp = Date.parse(article.pubDate);
      if (
        article.title &&
        article.link &&
        Number.isFinite(timestamp) &&
        timestamp >= cutoff
      ) {
        unique.set(article.link, article);
      }
    }
    const articles = [...unique.values()].sort(
      (a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate)
    );
    res.status(200).json({
      articles,
      count: articles.length,
      days,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(502).json({
      error: "Nepodarilo sa načítať správy z Google News.",
      details: String(error.message || error)
    });
  }
}