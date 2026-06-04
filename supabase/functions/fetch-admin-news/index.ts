/**
 * Supabase Edge Function: fetch-admin-news
 *
 * Fetches REAL higher-education / accreditation articles via free RSS/Atom feeds.
 * No API key required.
 *
 * Admin-relevant topics: accreditation, AACSB, EQUIS, AMBA, higher education,
 * business schools, AI in education, rankings, MBA, curriculum quality.
 *
 * Deploy:
 *   supabase functions deploy fetch-admin-news --no-verify-jwt
 *
 * After deploy, set ADMIN_DEV_MODE = false in adminNewsService.ts.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface IncomingPayload {
  adminId:       string;
  accreditation: string; // e.g. 'AACSB' | 'EQUIS' | 'AMBA'
}

interface RssItem {
  title:       string;
  link:        string;
  pubDate:     string;
  description: string;
}

export interface FetchedAdminArticle {
  id:           string;
  title:        string;
  description:  string;
  source_name:  string;
  source_url:   string;
  article_url:  string;
  published_at: string;
  category:     string;
  tags:         string[];
  related_accreditation: string | null;
}

// ── Approved publisher domains ────────────────────────────────────────────────
const APPROVED_DOMAINS = [
  'reuters.com', 'ft.com', 'aacsb.edu', 'oecd.org', 'hbr.org',
  'sloanreview.mit.edu', 'weforum.org', 'economist.com',
  'timeshighereducation.com', 'technologyreview.com',
];

// ── Admin-focused RSS sources ─────────────────────────────────────────────────
const ADMIN_RSS_SOURCES: Array<{
  name:      string;
  domain:    string;
  sourceUrl: string;
  urls:      string[];
}> = [
  {
    name:      'AACSB Insights',
    domain:    'aacsb.edu',
    sourceUrl: 'https://www.aacsb.edu',
    urls:      [
      'https://www.aacsb.edu/insights/rss',
      'https://www.aacsb.edu/insights/feed',
      'https://www.aacsb.edu/rss',
    ],
  },
  {
    name:      'Times Higher Education',
    domain:    'timeshighereducation.com',
    sourceUrl: 'https://www.timeshighereducation.com',
    urls:      [
      'https://www.timeshighereducation.com/hub/rss',
      'https://www.timeshighereducation.com/rss.xml',
      'https://www.timeshighereducation.com/news/rss.xml',
    ],
  },
  {
    name:      'World Economic Forum',
    domain:    'weforum.org',
    sourceUrl: 'https://www.weforum.org',
    urls:      [
      'https://feeds.weforum.org/agenda/rss.xml',
      'https://www.weforum.org/rss.xml',
    ],
  },
  {
    name:      'OECD Education',
    domain:    'oecd.org',
    sourceUrl: 'https://www.oecd.org',
    urls:      [
      'https://www.oecd.org/newsroom/rss.xml',
      'https://www.oecd-ilibrary.org/rss/home/en/rss.xml',
    ],
  },
  {
    name:      'MIT Technology Review',
    domain:    'technologyreview.com',
    sourceUrl: 'https://www.technologyreview.com',
    urls:      [
      'https://www.technologyreview.com/feed/',
    ],
  },
  {
    name:      'Harvard Business Review',
    domain:    'hbr.org',
    sourceUrl: 'https://hbr.org',
    urls:      [
      'https://hbr.org/rss/articles.xml',
      'https://feeds.hbr.org/harvardbusiness',
    ],
  },
  {
    name:      'Reuters',
    domain:    'reuters.com',
    sourceUrl: 'https://www.reuters.com',
    urls:      [
      'https://feeds.reuters.com/reuters/businessNews',
      'https://www.reuters.com/rssFeed/businessNews',
    ],
  },
];

// ── Admin relevance keywords ───────────────────────────────────────────────────
const ADMIN_BASE_KEYWORDS = [
  'accreditation', 'business school', 'higher education', 'university',
  'mba', 'curriculum', 'faculty', 'ai in education', 'artificial intelligence',
  'learning outcomes', 'quality assurance', 'ranking', 'enrollment',
  'pedagogy', 'postgraduate', 'academic', 'teaching quality',
  'institutional', 'research output', 'aacsb', 'equis', 'amba',
  'business education', 'management education',
];

// ── Category assignment ────────────────────────────────────────────────────────
type AdminCategory =
  | 'accreditation'
  | 'business-schools'
  | 'universities'
  | 'ai-education'
  | 'business-events'
  | 'global-education';

function categorise(
  title: string,
  desc: string,
  accreditation: string,
): { category: AdminCategory; tags: string[]; related_accreditation: string | null } {
  const text = `${title} ${desc}`.toLowerCase();
  const tags: string[] = [];
  let category: AdminCategory = 'global-education';
  let related: string | null = null;

  // Accreditation signals
  if (text.includes('aacsb')) { category = 'accreditation'; related = 'AACSB'; tags.push('aacsb', 'accreditation'); }
  else if (text.includes('equis') || text.includes('efmd')) { category = 'accreditation'; related = 'EQUIS'; tags.push('equis', 'accreditation'); }
  else if (text.includes('amba') && (text.includes('accredit') || text.includes('mba'))) { category = 'accreditation'; related = 'AMBA'; tags.push('amba', 'accreditation'); }
  else if (text.includes('accreditation') || text.includes('quality assurance')) { category = 'accreditation'; tags.push('accreditation', 'quality assurance'); }
  // AI in education
  else if (
    (text.includes('ai') || text.includes('artificial intelligence') || text.includes('generative ai')) &&
    (text.includes('education') || text.includes('university') || text.includes('school') || text.includes('learning'))
  ) { category = 'ai-education'; tags.push('ai in education'); }
  // Business schools
  else if (text.includes('business school') || text.includes('business education') || (text.includes('mba') && !text.includes('amba'))) {
    category = 'business-schools'; tags.push('business school');
  }
  // Universities
  else if (text.includes('university') || text.includes('higher education') || text.includes('college')) {
    category = 'universities'; tags.push('higher education', 'university');
  }
  // Events
  else if (text.includes('conference') || text.includes('summit') || text.includes('forum')) {
    category = 'business-events'; tags.push('conference');
  }

  // Boost related_accreditation if the institution's accreditation is explicitly mentioned
  if (!related && accreditation && text.includes(accreditation.toLowerCase())) {
    related = accreditation;
  }

  // Extra tags
  if (text.includes('curriculum'))   tags.push('curriculum');
  if (text.includes('research'))     tags.push('research');
  if (text.includes('ranking'))      tags.push('ranking');
  if (text.includes('student'))      tags.push('student');
  if (text.includes('faculty'))      tags.push('faculty');
  if (text.includes('sustainability')) tags.push('sustainability');
  if (text.includes('global') || text.includes('international')) tags.push('global education');

  return { category, tags: [...new Set(tags)], related_accreditation: related };
}

// ── XML parser (same pattern as professor function) ───────────────────────────
function extractTag(xml: string, tag: string): string {
  const cdRe = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    'i',
  );
  const cdM = xml.match(cdRe);
  if (cdM) return cdM[1].trim();

  const txRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const txM  = xml.match(txRe);
  if (txM) return txM[1].trim();

  if (tag === 'link') {
    const hrM = xml.match(/<link[^>]+href="([^"]+)"/i);
    if (hrM) return hrM[1].trim();
  }
  return '';
}

function parseXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const rssRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = rssRe.exec(xml)) !== null) {
    const b = m[1];
    const title = extractTag(b, 'title');
    const link  = extractTag(b, 'link') || extractTag(b, 'guid');
    const pub   = extractTag(b, 'pubDate') || extractTag(b, 'dc:date') || '';
    const desc  = extractTag(b, 'description') || extractTag(b, 'content:encoded') || '';
    if (title && link) items.push({ title, link, pubDate: pub, description: desc });
  }

  if (items.length === 0) {
    const atomRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    while ((m = atomRe.exec(xml)) !== null) {
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
  if (!pubDate) return true;
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
  const words = new Set(title.toLowerCase().split(/\W+/).filter(w => w.length > 4));
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .substring(0, 400);
}

async function fetchSource(
  src: typeof ADMIN_RSS_SOURCES[0],
): Promise<{ src: typeof ADMIN_RSS_SOURCES[0]; items: RssItem[] } | null> {
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
        console.log(`[fetch-admin-news] ${src.name}: ${items.length} items`);
        return { src, items };
      }
    } catch (e) {
      console.warn(`[fetch-admin-news] ${src.name} ${url}:`, (e as Error)?.message);
    }
  }
  return null;
}

// ── CORS ──────────────────────────────────────────────────────────────────────
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
    const { accreditation = '' }: IncomingPayload = await req.json();

    // Build keyword set — accreditation name gets priority
    const keywords = accreditation
      ? [accreditation.toLowerCase(), ...ADMIN_BASE_KEYWORDS]
      : ADMIN_BASE_KEYWORDS;

    // Fetch all admin feeds in parallel
    const feedResults = await Promise.allSettled(
      ADMIN_RSS_SOURCES.map(fetchSource),
    );

    const pool: Array<{ src: typeof ADMIN_RSS_SOURCES[0]; item: RssItem }> = [];
    for (const r of feedResults) {
      if (r.status === 'fulfilled' && r.value) {
        for (const item of r.value.items) {
          pool.push({ src: r.value.src, item });
        }
      }
    }

    console.log(`[fetch-admin-news] Pool: ${pool.length} items`);

    const seenTitles: string[] = [];
    const results: FetchedAdminArticle[] = [];

    for (const { src, item } of pool) {
      if (results.length >= 30) break; // cap at 30 articles
      if (!item.link || !item.title) continue;

      const articleUrl = item.link.startsWith('http')
        ? item.link
        : `https://${src.domain}${item.link}`;

      if (!isApprovedUrl(articleUrl))        continue;
      if (!isRecent(item.pubDate))           continue;
      if (!isRelevant(item.title, item.description, keywords)) continue;
      if (isDuplicate(item.title, seenTitles)) continue;

      seenTitles.push(item.title.toLowerCase());

      let pubIso: string;
      try { pubIso = new Date(item.pubDate).toISOString(); }
      catch { pubIso = new Date().toISOString(); }

      const { category, tags, related_accreditation } = categorise(
        item.title, item.description, accreditation,
      );

      results.push({
        id:                   `admin-rss-${results.length}`,
        title:                item.title,
        description:          stripHtml(item.description),
        source_name:          src.name,
        source_url:           src.sourceUrl,
        article_url:          articleUrl,
        published_at:         pubIso,
        category,
        tags,
        related_accreditation,
      });
    }

    // Sort newest first
    results.sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );

    console.log(`[fetch-admin-news] Returning ${results.length} articles`);
    return new Response(JSON.stringify({ articles: results }), { headers: CORS });

  } catch (err) {
    console.error('[fetch-admin-news] Fatal:', err);
    return new Response(
      JSON.stringify({ articles: [], error: 'Internal server error' }),
      { status: 500, headers: CORS },
    );
  }
});
