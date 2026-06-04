/**
 * Supabase Edge Function: fetch-course-news
 *
 * Fetches REAL articles via free RSS/Atom feeds from approved publishers.
 * No API key required.
 *
 * Approved publishers (mirrors client-side APPROVED_DOMAINS):
 *   Reuters, Financial Times, AACSB Insights, OECD Education,
 *   Harvard Business Review, MIT Sloan Management Review,
 *   World Economic Forum, The Economist,
 *   Times Higher Education, MIT Technology Review
 *
 * Deploy:
 *   supabase functions deploy fetch-course-news --no-verify-jwt
 *
 * After deploy, the app's DEV_MODE = false path will call this function.
 * If the function is unreachable, newsService.ts falls back to curated articles.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CourseTopic {
  courseId:   string;
  courseName: string;
  keywords:   string[];
}

interface IncomingPayload {
  courseTopics:   CourseTopic[];
  enabledSources: string[];
}

interface RssItem {
  title:       string;
  link:        string;
  pubDate:     string;
  description: string;
}

interface NewsArticle {
  id:                string;
  title:             string;
  url:               string;
  sourceName:        string;
  publishedAt:       string;
  relatedCourseId:   string;
  relatedCourseName: string;
  topicKeyword:      string;
  snippet:           string;
}

// ── Approved publisher domains ────────────────────────────────────────────────
const APPROVED_DOMAINS = [
  'reuters.com',
  'ft.com',
  'aacsb.edu',
  'oecd.org',
  'hbr.org',
  'sloanreview.mit.edu',
  'weforum.org',
  'economist.com',
  'timeshighereducation.com',
  'technologyreview.com',
];

// ── RSS feed sources (free, no API key required) ──────────────────────────────
// Multiple URL variants per source — tries each until one works
const RSS_SOURCES: Array<{
  name:   string;
  domain: string;
  urls:   string[];
}> = [
  {
    name:   'World Economic Forum',
    domain: 'weforum.org',
    urls:   [
      'https://feeds.weforum.org/agenda/rss.xml',
      'https://www.weforum.org/rss.xml',
    ],
  },
  {
    name:   'MIT Technology Review',
    domain: 'technologyreview.com',
    urls:   [
      'https://www.technologyreview.com/feed/',
      'https://www.technologyreview.com/feed',
    ],
  },
  {
    name:   'MIT Sloan Management Review',
    domain: 'sloanreview.mit.edu',
    urls:   [
      'https://sloanreview.mit.edu/feed/',
      'https://sloanreview.mit.edu/feed',
    ],
  },
  {
    name:   'Harvard Business Review',
    domain: 'hbr.org',
    urls:   [
      'https://hbr.org/rss/articles.xml',
      'https://feeds.hbr.org/harvardbusiness',
    ],
  },
  {
    name:   'AACSB Insights',
    domain: 'aacsb.edu',
    urls:   [
      'https://www.aacsb.edu/insights/rss',
      'https://www.aacsb.edu/insights/feed',
      'https://www.aacsb.edu/rss',
    ],
  },
  {
    name:   'Times Higher Education',
    domain: 'timeshighereducation.com',
    urls:   [
      'https://www.timeshighereducation.com/hub/rss',
      'https://www.timeshighereducation.com/rss.xml',
      'https://www.timeshighereducation.com/news/rss.xml',
    ],
  },
  {
    name:   'Reuters',
    domain: 'reuters.com',
    urls:   [
      'https://feeds.reuters.com/reuters/businessNews',
      'https://www.reuters.com/rssFeed/businessNews',
      'https://feeds.reuters.com/news/wealth',
    ],
  },
  {
    name:   'OECD Education',
    domain: 'oecd.org',
    urls:   [
      'https://www.oecd.org/newsroom/rss.xml',
      'https://www.oecd-ilibrary.org/rss/home/en/rss.xml',
    ],
  },
];

// ── XML / RSS parser ──────────────────────────────────────────────────────────

/** Extract text between a tag, handling CDATA and plain text */
function extractTag(xml: string, tag: string): string {
  // CDATA form: <tag><![CDATA[...]]></tag>
  const cdRe = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    'i',
  );
  const cdM = xml.match(cdRe);
  if (cdM) return cdM[1].trim();

  // Plain text form: <tag>...</tag>
  const txRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const txM = xml.match(txRe);
  if (txM) return txM[1].trim();

  // Atom-style self-closing with href: <link href="..."/>
  if (tag === 'link') {
    const hrRe = /<link[^>]+href="([^"]+)"/i;
    const hrM = xml.match(hrRe);
    if (hrM) return hrM[1].trim();
  }

  return '';
}

/** Parse an RSS/Atom XML string → array of items */
function parseXml(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // RSS 2.0 / RDF: <item>...</item>
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const b = m[1];
    const title = extractTag(b, 'title');
    const link  = extractTag(b, 'link') || extractTag(b, 'guid');
    const pub   = extractTag(b, 'pubDate') || extractTag(b, 'dc:date') || '';
    const desc  = extractTag(b, 'description') ||
                  extractTag(b, 'content:encoded') ||
                  extractTag(b, 'summary') || '';
    if (title && link) items.push({ title, link, pubDate: pub, description: desc });
  }

  // Atom: <entry>...</entry>  (only if no RSS items found)
  if (items.length === 0) {
    const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    while ((m = entryRe.exec(xml)) !== null) {
      const b = m[1];
      const title = extractTag(b, 'title');
      const link  = extractTag(b, 'link') || extractTag(b, 'id');
      const pub   = extractTag(b, 'published') || extractTag(b, 'updated') || '';
      const desc  = extractTag(b, 'summary') || extractTag(b, 'content') || '';
      if (title && link) items.push({ title, link, pubDate: pub, description: desc });
    }
  }

  return items;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1_000;

function isRecent(pubDate: string): boolean {
  if (!pubDate) return true; // no date → include
  try { return Date.now() - new Date(pubDate).getTime() < FIVE_DAYS_MS; }
  catch { return true; }
}

function isApprovedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return APPROVED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

function isRelevant(title: string, desc: string, keywords: string[]): boolean {
  const text = `${title} ${desc}`.toLowerCase();
  return keywords.some(k => text.includes(k.toLowerCase()));
}

function isDuplicate(title: string, seen: string[]): boolean {
  const words = new Set(
    title.toLowerCase().split(/\W+/).filter(w => w.length > 4),
  );
  if (words.size === 0) return false;
  return seen.some(prev => {
    const pw = new Set(prev.split(/\W+/).filter(w => w.length > 4));
    const overlap = [...words].filter(w => pw.has(w)).length;
    return overlap / Math.min(words.size, pw.size) >= 0.6;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&').replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .substring(0, 350);
}

// ── Fetch one RSS source (tries multiple URL variants) ────────────────────────
async function fetchSource(
  src: typeof RSS_SOURCES[0],
): Promise<{ src: typeof RSS_SOURCES[0]; items: RssItem[] } | null> {
  for (const url of src.urls) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8_000);
      const res  = await fetch(url, {
        signal:  ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HighFive/1.0)',
          'Accept':     'application/rss+xml, application/xml, text/xml, */*',
        },
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const xml   = await res.text();
      const items = parseXml(xml);
      if (items.length > 0) {
        console.log(`[fetch-course-news] ${src.name}: ${items.length} items from ${url}`);
        return { src, items };
      }
    } catch (e) {
      console.warn(`[fetch-course-news] ${src.name} ${url} failed:`, (e as Error)?.message);
    }
  }
  console.warn(`[fetch-course-news] All feeds failed for ${src.name}`);
  return null;
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { courseTopics, enabledSources }: IncomingPayload = await req.json();

    if (!courseTopics?.length) {
      return new Response(JSON.stringify({ articles: [] }), { headers: CORS });
    }

    // Filter to sources the professor has enabled (if any)
    const enabledSet = new Set(enabledSources ?? []);
    const activeSources = RSS_SOURCES.filter(
      s => enabledSet.size === 0 || enabledSet.has(s.name),
    );

    // Fetch all feeds in parallel
    const feedResults = await Promise.allSettled(activeSources.map(fetchSource));

    // Build flat item pool
    const pool: Array<{ src: typeof RSS_SOURCES[0]; item: RssItem }> = [];
    for (const r of feedResults) {
      if (r.status === 'fulfilled' && r.value) {
        for (const item of r.value.items) {
          pool.push({ src: r.value.src, item });
        }
      }
    }

    console.log(`[fetch-course-news] Pool size: ${pool.length} items across ${activeSources.length} sources`);

    // Match articles to courses (max 3 per course)
    const seenTitles: string[] = [];
    const results: NewsArticle[] = [];

    for (const { courseId, courseName, keywords } of courseTopics) {
      let count = 0;

      for (const { src, item } of pool) {
        if (count >= 3) break;
        if (!item.link || !item.title) continue;

        // Ensure URL is absolute
        const articleUrl = item.link.startsWith('http')
          ? item.link
          : `https://${src.domain}${item.link}`;

        if (!isApprovedUrl(articleUrl))           continue;
        if (!isRecent(item.pubDate))              continue;
        if (!isRelevant(item.title, item.description, keywords)) continue;
        if (isDuplicate(item.title, seenTitles))  continue;

        seenTitles.push(item.title.toLowerCase());

        let pubIso: string;
        try { pubIso = new Date(item.pubDate).toISOString(); }
        catch { pubIso = new Date().toISOString(); }

        results.push({
          id:                `rss-${courseId}-${results.length}`,
          title:             item.title,
          url:               articleUrl,
          sourceName:        src.name,
          publishedAt:       pubIso,
          relatedCourseId:   courseId,
          relatedCourseName: courseName,
          topicKeyword:      keywords[0] ?? '',
          snippet:           stripHtml(item.description),
        });
        count++;
      }
    }

    // Sort newest first
    results.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    console.log(`[fetch-course-news] Returning ${results.length} articles`);
    return new Response(JSON.stringify({ articles: results }), { headers: CORS });

  } catch (err) {
    console.error('[fetch-course-news] Fatal:', err);
    return new Response(
      JSON.stringify({ articles: [], error: 'Internal server error' }),
      { status: 500, headers: CORS },
    );
  }
});
