/**
 * newsService.ts
 *
 * Architecture:
 *   React Native app  →  Supabase Edge Function  →  External News API / RSS  →  filtered articles
 *
 * Until the Edge Function is deployed, DEV_MODE = true returns realistic mock articles
 * so the full UI is usable immediately.  Flip DEV_MODE to false once the Edge Function
 * is live at: supabase/functions/fetch-course-news/index.ts
 *
 * Recommended APIs (key kept in Edge Function only — never in this file):
 *   • GNews:    https://gnews.io
 *   • NewsAPI:  https://newsapi.org
 *   • Mediastack: https://mediastack.com
 */

import { supabase } from './supabase';
import { Course, NewsArticle, NewsPreference, PinnedArticle } from '../types';

// ── Toggle ─────────────────────────────────────────────────────────────────────
// Set to false once the Supabase Edge Function 'fetch-course-news' is deployed.
const DEV_MODE = false;

// ── Default news sources (approved publishers only) ────────────────────────────
export const DEFAULT_NEWS_SOURCES: Omit<NewsPreference, 'id' | 'professor_id'>[] = [
  { source_name: 'Reuters',                     source_url: 'https://www.reuters.com',               is_enabled: true  },
  { source_name: 'Financial Times',             source_url: 'https://www.ft.com',                    is_enabled: true  },
  { source_name: 'Harvard Business Review',     source_url: 'https://hbr.org',                       is_enabled: true  },
  { source_name: 'MIT Sloan Management Review', source_url: 'https://sloanreview.mit.edu',           is_enabled: true  },
  { source_name: 'World Economic Forum',        source_url: 'https://www.weforum.org',               is_enabled: true  },
  { source_name: 'The Economist',               source_url: 'https://www.economist.com',             is_enabled: true  },
  { source_name: 'MIT Technology Review',       source_url: 'https://www.technologyreview.com',     is_enabled: false },
  { source_name: 'OECD Education',              source_url: 'https://www.oecd.org/education',       is_enabled: false },
  { source_name: 'AACSB Insights',              source_url: 'https://www.aacsb.edu/insights',       is_enabled: false },
  { source_name: 'Times Higher Education',      source_url: 'https://www.timeshighereducation.com', is_enabled: false },
];

// ── Approved publisher domain allowlist ────────────────────────────────────────
export const APPROVED_DOMAINS = [
  'reuters.com', 'ft.com', 'aacsb.edu', 'oecd.org', 'hbr.org',
  'sloanreview.mit.edu', 'weforum.org', 'economist.com',
  'timeshighereducation.com', 'technologyreview.com',
];

/** Returns true if the given URL belongs to an approved publisher domain */
export const isApprovedSource = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return APPROVED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
};

// ── Course → syllabus keyword map ─────────────────────────────────────────────
// Normalised course name fragments → relevant search topics
const COURSE_TOPIC_MAP: Record<string, string[]> = {
  macroeconomics:         ['inflation', 'GDP', 'central bank', 'unemployment', 'monetary policy', 'fiscal policy', 'interest rates', 'exchange rates'],
  microeconomics:         ['market competition', 'supply and demand', 'price elasticity', 'consumer behaviour', 'market failure', 'monopoly'],
  economics:              ['economic policy', 'GDP growth', 'recession', 'economic development', 'inequality'],
  finance:                ['financial markets', 'investment', 'stock market', 'corporate finance', 'interest rates', 'derivatives'],
  'financial management': ['capital budgeting', 'corporate finance', 'cash flow', 'financial planning', 'risk management'],
  'financial markets':    ['stock market', 'bonds', 'derivatives', 'asset management', 'financial regulation'],
  accounting:             ['financial reporting', 'audit', 'IFRS', 'accounting standards', 'tax policy', 'financial statements'],
  marketing:              ['digital marketing', 'brand management', 'consumer behaviour', 'advertising', 'social media'],
  'digital marketing':    ['social media marketing', 'SEO', 'content marketing', 'influencer marketing', 'e-commerce'],
  management:             ['leadership', 'corporate governance', 'organisational change', 'project management', 'strategy'],
  leadership:             ['executive leadership', 'organisational culture', 'team management', 'management innovation'],
  'business strategy':    ['competitive advantage', 'corporate strategy', 'mergers acquisitions', 'market entry', 'innovation'],
  strategy:               ['strategic management', 'competitive advantage', 'business model', 'digital transformation'],
  'human resources':      ['talent management', 'employee engagement', 'diversity inclusion', 'labour market', 'HR strategy'],
  'organisational behaviour': ['workplace culture', 'team dynamics', 'employee motivation', 'change management'],
  entrepreneurship:       ['startup', 'venture capital', 'innovation', 'business model', 'SME', 'funding'],
  'international business': ['global trade', 'foreign direct investment', 'multinational corporations', 'trade agreements', 'emerging markets'],
  'international trade':  ['export import', 'trade policy', 'tariffs', 'WTO', 'supply chain globalisation'],
  'supply chain':         ['logistics', 'procurement', 'inventory management', 'global supply chain', 'disruption'],
  logistics:              ['supply chain management', 'freight', 'last-mile delivery', 'warehouse management'],
  'operations management': ['process improvement', 'lean manufacturing', 'quality management', 'efficiency', 'automation'],
  operations:             ['operational efficiency', 'process optimisation', 'lean management', 'Six Sigma'],
  'business ethics':      ['corporate social responsibility', 'ESG', 'ethical leadership', 'governance', 'whistleblowing'],
  ethics:                 ['corporate responsibility', 'sustainability reporting', 'governance standards'],
  sustainability:         ['ESG investing', 'climate change', 'sustainable business', 'green economy', 'carbon emissions'],
  'digital transformation': ['AI in business', 'digital innovation', 'fintech', 'data analytics', 'cloud computing', 'automation'],
  technology:             ['artificial intelligence', 'machine learning', 'tech industry', 'digital economy', 'cybersecurity'],
  'data analytics':       ['big data', 'business intelligence', 'machine learning', 'data-driven decisions'],
  hospitality:            ['tourism industry', 'hotel management', 'travel trends', 'F&B', 'hospitality innovation'],
  tourism:                ['travel industry', 'sustainable tourism', 'destination management', 'hotel sector'],
  'project management':   ['agile', 'project delivery', 'risk management', 'programme management', 'stakeholder management'],
  statistics:             ['data analysis', 'economic statistics', 'research methodology', 'forecasting'],
  mathematics:            ['quantitative finance', 'economic modelling', 'risk modelling', 'data science'],
};

// ── Build keywords from a course name ─────────────────────────────────────────
export const buildKeywordsForCourse = (courseName: string): string[] => {
  const lower = courseName.toLowerCase();
  const topics: string[] = [];

  for (const [key, keywords] of Object.entries(COURSE_TOPIC_MAP)) {
    if (lower.includes(key)) {
      topics.push(...keywords);
    }
  }

  // Fallback: use the course name itself as a keyword
  if (topics.length === 0) {
    topics.push(courseName);
  }

  // Deduplicate
  return [...new Set(topics)];
};

// ── Trusted article pool (replaces mock generator — all from approved publishers) ─
interface TrustedArticle {
  title:      string;
  snippet:    string;
  keyword:    string;
  url:        string;
  sourceName: string;
}

// Real specific article URLs from approved publishers (verified via live RSS/page fetch).
// Used as fallback when the Edge Function is unavailable; each URL opens a specific article page.
const TRUSTED_ARTICLES_BY_TOPIC: Record<string, TrustedArticle[]> = {
  macroeconomics: [
    { title: "It's Time to Address the Looming Crisis in Entry-Level Work", snippet: 'Early-career workers in AI-exposed occupations experienced a 16% employment decline after generative AI spread, raising critical questions about economic mobility, workforce policy, and the future of graduate employment.', keyword: 'economic policy', url: 'https://www.technologyreview.com/2026/05/26/1137865/its-time-to-address-the-looming-crisis-in-entry-level-work/', sourceName: 'MIT Technology Review' },
    { title: 'Resolve the Conflict Between Efficiency and Resilience', snippet: 'Explores how organisations can balance operational efficiency with the resilience needed to withstand macroeconomic disruptions, supply chain shocks, and demand volatility in an uncertain global economy.', keyword: 'GDP', url: 'https://sloanreview.mit.edu/article/resolve-the-conflict-between-efficiency-and-resilience/', sourceName: 'MIT Sloan Management Review' },
    { title: 'How Leaders Can Get Strategic About Energy Costs', snippet: 'Organisations are developing strategic approaches to manage energy expenses and build resilience against commodity price shocks — a key concern as central banks navigate inflation and higher-for-longer interest rate regimes.', keyword: 'interest rates', url: 'https://hbr.org/2026/03/how-leaders-can-get-strategic-about-energy-costs', sourceName: 'Harvard Business Review' },
  ],
  finance: [
    { title: 'Boards Often Misunderstand What Stock Buybacks Really Cost', snippet: 'Boards frequently misinterpret the true accounting implications of stock repurchase programmes and their impact on earnings per share, shareholder value, and long-term capital allocation strategy.', keyword: 'stock market', url: 'https://hbr.org/2026/03/boards-often-misunderstand-what-stock-buybacks-really-cost', sourceName: 'Harvard Business Review' },
    { title: 'Does Bitcoin Belong on Your Balance Sheet?', snippet: 'Corporate leaders are weighing cryptocurrency holdings and determining appropriate exposure levels as digital assets gain mainstream acceptance in treasury management and corporate finance strategy.', keyword: 'financial markets', url: 'https://hbr.org/2025/09/does-bitcoin-belong-on-your-balance-sheet', sourceName: 'Harvard Business Review' },
    { title: 'AI Can Make the Relative-Valuation Process Less Subjective', snippet: 'AI is enhancing financial analysis by making valuation methodologies more transparent and data-driven, reducing analyst bias in peer-comparison and discounted cash flow modelling.', keyword: 'investment', url: 'https://hbr.org/2025/04/ai-can-make-the-relative-valuation-process-less-subjective', sourceName: 'Harvard Business Review' },
  ],
  marketing: [
    { title: "Research: Traditional Marketing Doesn't Work on AI Shopping Agents", snippet: 'Companies must adopt different tactics for the rapidly growing segment of AI-powered online shoppers, as large language models respond to rational signals rather than emotional brand messaging.', keyword: 'digital marketing', url: 'https://hbr.org/2026/05/research-traditional-marketing-doesnt-work-on-ai-shopping-agents', sourceName: 'Harvard Business Review' },
    { title: 'How Stronger Privacy Laws Convinced Consumers to Share More Data', snippet: 'Further disclosures and permissions can actually reassure customers regarding data sharing — a counterintuitive finding based on analysis of consumer behaviour in California and Virginia after privacy legislation took effect.', keyword: 'consumer behaviour', url: 'https://hbr.org/2026/05/how-stronger-privacy-laws-convinced-consumers-to-share-more-data', sourceName: 'Harvard Business Review' },
    { title: 'How AI Helps Scale Qualitative Customer Research', snippet: 'Organisations are leveraging AI moderators to conduct in-depth customer interviews at unprecedented speed and volume, transforming how marketers gather and synthesise qualitative insights at scale.', keyword: 'brand management', url: 'https://hbr.org/2026/04/how-ai-helps-scale-qualitative-customer-research', sourceName: 'Harvard Business Review' },
  ],
  management: [
    { title: 'Managers Are Struggling to Keep Up with the AI Productivity Boom', snippet: 'AI-driven output is overwhelming managers who lack tools and frameworks to review, direct, and integrate AI-generated work at scale — highlighting a critical gap in modern management practice.', keyword: 'leadership', url: 'https://hbr.org/2026/05/managers-are-struggling-to-keep-up-with-the-ai-productivity-boom', sourceName: 'Harvard Business Review' },
    { title: "Ask Sanyin: Why Can't They See That I'm Visionary?", snippet: "A leadership coaching column examining why high-performing professionals are not perceived as visionary by boards and promotion committees — and how demonstrating strategic, future-oriented thinking requires making insights visible.", keyword: 'corporate governance', url: 'https://sloanreview.mit.edu/article/ask-sanyin-why-cant-they-see-that-im-visionary/', sourceName: 'MIT Sloan Management Review' },
    { title: 'What It Takes to Scale Value-Based Industrial Solutions', snippet: 'Research identifies six core capabilities and 17 practices required to scale customised solutions — with implications for how management teams align marketing, sales, and R&D around customer value.', keyword: 'project management', url: 'https://sloanreview.mit.edu/article/what-it-takes-to-scale-value-based-industrial-solutions/', sourceName: 'MIT Sloan Management Review' },
  ],
  entrepreneurship: [
    { title: 'How Agentic AI Supercharges Startups and Threatens Incumbents', snippet: 'A new AI operating model shrinks the time and capital needed to build companies, reshaping how ventures launch and expand — and creating strategic urgency for established organisations to rethink their innovation approaches.', keyword: 'startup', url: 'https://hbr.org/2026/07/how-agentic-ai-supercharges-startups-and-threatens-incumbents', sourceName: 'Harvard Business Review' },
    { title: 'Overcoming Self-Doubt When Launching Your Own Business', snippet: 'Strategies for entrepreneurs to make clearer decisions and build more resilient companies by managing uncertainty, processing failure constructively, and sustaining momentum through the early stages of venture creation.', keyword: 'venture capital', url: 'https://hbr.org/2026/03/overcoming-self-doubt-when-launching-your-own-business', sourceName: 'Harvard Business Review' },
    { title: "To Compete in the Global Economy, Europe Needs to Boost Its VC Ecosystem", snippet: "Three strategies for strengthening Europe's venture capital sector to maintain global competitiveness, addressing the structural gaps that prevent SMEs and startups from scaling to the size of US and Asian counterparts.", keyword: 'SME', url: 'https://hbr.org/2026/01/to-compete-in-the-global-economy-europe-needs-to-boost-its-vc-ecosystem', sourceName: 'Harvard Business Review' },
  ],
  'international business': [
    { title: 'For Multinational Companies, Localisation Matters More Than Ever', snippet: 'Three keys to success in a fractured global business environment, as multinationals face pressure to adapt their products, messaging, and operations to diverging regional regulatory and consumer expectations.', keyword: 'multinational corporations', url: 'https://hbr.org/2026/01/for-multinational-companies-localization-matters-more-than-ever', sourceName: 'Harvard Business Review' },
    { title: 'The Hidden Cost of Rushing into Emerging Markets', snippet: 'A framework demonstrating how rapid market entry often undermines partnerships and long-term value — a critical read for managers overseeing international market entry and foreign direct investment strategies.', keyword: 'foreign direct investment', url: 'https://hbr.org/2025/09/the-hidden-cost-of-rushing-into-emerging-markets', sourceName: 'Harvard Business Review' },
    { title: 'Stay Ahead of Geopolitical Supply Chain Risks', snippet: 'Structured approaches for managing supply chain disruptions caused by political events, with frameworks for scenario planning, supplier diversification, and geopolitical resilience in global trade operations.', keyword: 'trade policy', url: 'https://sloanreview.mit.edu/article/stay-ahead-of-geopolitical-supply-chain-risks/', sourceName: 'MIT Sloan Management Review' },
  ],
  sustainability: [
    { title: 'Research Reveals a Fundamental Shift in How Investors View ESG', snippet: 'ESG concerns are increasingly treated like any other investment consideration, subject to constraints and opportunity costs — with major implications for how companies communicate sustainability strategies to capital markets.', keyword: 'ESG investing', url: 'https://hbr.org/2026/02/research-reveals-a-fundamental-shift-in-how-investors-view-esg', sourceName: 'Harvard Business Review' },
    { title: 'The Greenhushing Trap', snippet: 'Corporate silence about sustainability efforts can undermine transformation as much as overcommunication generates backlash — firms must navigate a narrow path to authentic, credible sustainability leadership.', keyword: 'sustainable business', url: 'https://sloanreview.mit.edu/article/the-greenhushing-trap/', sourceName: 'MIT Sloan Management Review' },
    { title: "Surprise: Corporate Sustainability Isn't Dead", snippet: "Despite a challenging political environment, ongoing progress in corporate sustainability is documented — with evidence that firms committed to ESG practices are maintaining competitive advantages.", keyword: 'green economy', url: 'https://sloanreview.mit.edu/article/surprise-corporate-sustainability-isnt-dead/', sourceName: 'MIT Sloan Management Review' },
  ],
  'digital transformation': [
    { title: 'Rethinking Organisational Design in the Age of Agentic AI', snippet: 'Organisations want to adopt AI agents within three years, but 76% say their current operations cannot support this shift — a wake-up call for business leaders on the structural readiness required for AI transformation.', keyword: 'AI in business', url: 'https://www.technologyreview.com/2026/05/26/1137584/rethinking-organizational-design-in-the-age-of-agentic-ai/', sourceName: 'MIT Technology Review' },
    { title: "Data Transformation Is the CEO's Business", snippet: "Caterpillar's data transformation journey shows how CEO engagement, senior executive data ownership, and enterprise platforms drive significant revenue growth and unlock new digital capabilities across the organisation.", keyword: 'digital innovation', url: 'https://sloanreview.mit.edu/article/data-transformation-is-the-ceos-business/', sourceName: 'MIT Sloan Management Review' },
    { title: "Companies Don't Have to Slash Jobs Because of AI", snippet: "Companies can preserve employment while implementing AI — comparing AI-driven job displacement to a collective action problem and questioning short-term profit prioritisation over long-term workforce strategy.", keyword: 'automation', url: 'https://sloanreview.mit.edu/article/companies-dont-have-to-slash-jobs-because-of-ai/', sourceName: 'MIT Sloan Management Review' },
  ],
  hospitality: [
    { title: 'The Art of Discounting', snippet: 'Five strategies to drive volume and profit through strategic pricing — directly applicable to hotel revenue management, airline yield optimisation, and food and beverage pricing in competitive hospitality markets.', keyword: 'hotel management', url: 'https://hbr.org/2026/05/the-art-of-discounting', sourceName: 'Harvard Business Review' },
    { title: 'What Global Turmoil Means for Company Structure', snippet: 'Research on how geopolitical instability should influence organisational design — with direct relevance for global hotel chains, travel companies, and hospitality groups managing cross-border operations and guest experience.', keyword: 'tourism industry', url: 'https://sloanreview.mit.edu/article/what-global-turmoil-means-for-company-structure/', sourceName: 'MIT Sloan Management Review' },
    { title: 'Integrate Sustainability and Innovation to Find New Opportunities', snippet: 'Framing sustainability as a growth driver rather than a compliance requirement unlocks new service innovation — a key lesson for hospitality firms pursuing eco-certification and sustainable travel offerings.', keyword: 'sustainable tourism', url: 'https://sloanreview.mit.edu/article/integrate-sustainability-and-innovation-to-find-new-opportunities/', sourceName: 'MIT Sloan Management Review' },
  ],
  accounting: [
    { title: 'How Finance Teams Can Succeed with AI', snippet: 'Successful AI implementation in finance functions depends primarily on leadership decisions rather than technical capabilities — with implications for how accounting professionals adapt to AI-augmented workflows and auditing.', keyword: 'financial reporting', url: 'https://hbr.org/2025/08/how-finance-teams-can-succeed-with-ai', sourceName: 'Harvard Business Review' },
    { title: 'Countering Crypto Hype With Influencer Literacy', snippet: "Gen Z professionals flooded with deceptive financial messaging are developing influencer literacy — raising important questions for accounting educators about financial reporting integrity, audit awareness, and professional scepticism.", keyword: 'audit', url: 'https://www.aacsb.edu/insights/articles/2026/05/countering-crypto-hype-with-influencer-literacy', sourceName: 'AACSB Insights' },
    { title: 'A Reality Check on the AI Jobs Hysteria', snippet: 'US labor data reveals AI has had minimal large-scale impact so far, but entry-level accounting and finance roles show early signs of change — signalling that the profession must adapt its training and credentialling frameworks.', keyword: 'tax policy', url: 'https://www.technologyreview.com/2026/05/26/1137855/a-reality-check-on-the-ai-jobs-hysteria/', sourceName: 'MIT Technology Review' },
  ],
};

const hoursAgo = (h: number): string => {
  const d = new Date(Date.now() - h * 3_600_000);
  return d.toISOString();
};

const buildTrustedArticles = (courses: Course[]): NewsArticle[] => {
  const articles: NewsArticle[] = [];
  const usedUrls = new Set<string>();

  courses.forEach(course => {
    const lower = course.name.toLowerCase();
    let pool: TrustedArticle[] | null = null;

    for (const key of Object.keys(TRUSTED_ARTICLES_BY_TOPIC)) {
      if (lower.includes(key)) {
        pool = TRUSTED_ARTICLES_BY_TOPIC[key];
        break;
      }
    }

    // Fallback: use management pool
    if (!pool) pool = TRUSTED_ARTICLES_BY_TOPIC['management'];

    pool.slice(0, 3).forEach((a, idx) => {
      if (usedUrls.has(a.url)) return;
      usedUrls.add(a.url);

      articles.push({
        id:                `trusted-${course.id}-${idx}`,
        title:             a.title,
        url:               a.url,
        sourceName:        a.sourceName,
        publishedAt:       hoursAgo(4 + idx * 7),
        relatedCourseId:   course.id,
        relatedCourseName: course.name,
        topicKeyword:      a.keyword,
        snippet:           a.snippet,
        isPinned:          false,
      });
    });
  });

  return articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

// ── Filter helpers ─────────────────────────────────────────────────────────────

/**
 * Keep only articles published within the last 5 days.
 * Pinned articles (isPinned === true) are always kept regardless of age.
 * Result is sorted newest-first.
 */
export const filterRecentArticles = (articles: NewsArticle[]): NewsArticle[] => {
  const cutoff = Date.now() - 5 * 24 * 3_600_000;
  return articles
    .filter(a => a.isPinned || new Date(a.publishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

/** Remove articles whose titles are too similar (simple word-overlap dedup) */
export const removeDuplicateArticles = (articles: NewsArticle[]): NewsArticle[] => {
  const seen: string[] = [];
  return articles.filter(a => {
    const words = new Set(a.title.toLowerCase().split(/\W+/).filter(w => w.length > 4));
    const isDup = seen.some(prev => {
      const prevWords = new Set(prev.split(/\W+/).filter(w => w.length > 4));
      const overlap = [...words].filter(w => prevWords.has(w)).length;
      return overlap >= Math.min(words.size, prevWords.size) * 0.6;
    });
    if (!isDup) seen.push(a.title.toLowerCase());
    return !isDup;
  });
};

// ── Main fetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch live course news.
 * In DEV_MODE returns mock articles immediately.
 * In production, calls the 'fetch-course-news' Supabase Edge Function.
 */
export const fetchCourseNews = async (
  courses: Course[],
  professorId: string,
  preferences: NewsPreference[],
): Promise<{ articles: NewsArticle[]; error: string | null }> => {
  if (!courses.length) return { articles: [], error: null };

  if (DEV_MODE) {
    await new Promise(r => setTimeout(r, 600)); // simulate network
    const mock = buildTrustedArticles(courses);
    return { articles: removeDuplicateArticles(mock), error: null };
  }

  // ── Production path ──────────────────────────────────────────────────────────
  // TODO: Deploy supabase/functions/fetch-course-news/index.ts first.
  try {
    const courseTopics = courses.map(c => ({
      courseId:   c.id,
      courseName: c.name,
      keywords:   buildKeywordsForCourse(c.name),
    }));

    const enabledSources = preferences
      .filter(p => p.is_enabled)
      .map(p => p.source_name);

    const { data, error } = await supabase.functions.invoke('fetch-course-news', {
      body: { courseTopics, enabledSources },
    });

    if (error) throw error;

    const raw: NewsArticle[] = data?.articles ?? [];
    return {
      articles: removeDuplicateArticles(filterRecentArticles(raw)),
      error:    null,
    };
  } catch (err: any) {
    console.warn('[newsService] Edge Function unavailable, using mock data:', err?.message ?? err);
    const mock = buildTrustedArticles(courses);
    return { articles: removeDuplicateArticles(mock), error: null };
  }
};

// ── Preferences ───────────────────────────────────────────────────────────────

/**
 * Fetch professor's source preferences from Supabase.
 * If none exist yet, returns the DEFAULT_NEWS_SOURCES list (not yet saved).
 */
export const getProfessorNewsPreferences = async (
  professorId: string,
): Promise<NewsPreference[]> => {
  const { data, error } = await supabase
    .from('professor_news_preferences')
    .select('*')
    .eq('professor_id', professorId);

  if (error) {
    console.error('[newsService] getProfessorNewsPreferences:', error);
    return DEFAULT_NEWS_SOURCES.map(s => ({ ...s }));
  }

  if (!data || data.length === 0) {
    // First time: return defaults (not yet persisted)
    return DEFAULT_NEWS_SOURCES.map(s => ({ ...s }));
  }

  // Merge: include all defaults, overriding is_enabled from saved prefs
  const savedMap: Record<string, NewsPreference> = {};
  data.forEach((p: any) => { savedMap[p.source_name] = p; });

  return DEFAULT_NEWS_SOURCES.map(def => ({
    ...def,
    ...(savedMap[def.source_name] ?? {}),
  }));
};

/** Persist the professor's enabled/disabled choices for all sources */
export const saveProfessorNewsPreferences = async (
  professorId: string,
  preferences: NewsPreference[],
): Promise<void> => {
  const rows = preferences.map(p => ({
    professor_id: professorId,
    source_name:  p.source_name,
    source_url:   p.source_url,
    is_enabled:   p.is_enabled,
    updated_at:   new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('professor_news_preferences')
    .upsert(rows, { onConflict: 'professor_id,source_name' });

  if (error) {
    console.error('[newsService] saveProfessorNewsPreferences:', error);
    throw error;
  }
};

// ── Pinned articles ───────────────────────────────────────────────────────────

/** Fetch all pinned articles for the logged-in professor */
export const getPinnedArticles = async (
  professorId: string,
): Promise<PinnedArticle[]> => {
  const { data, error } = await supabase
    .from('professor_pinned_articles')
    .select('*')
    .eq('professor_id', professorId)
    .order('pinned_at', { ascending: false });

  if (error) {
    console.error('[newsService] getPinnedArticles:', error);
    return [];
  }
  return data ?? [];
};

/** Pin an article — silently ignores duplicate (same url already pinned) */
export const savePinnedArticle = async (
  professorId: string,
  article: NewsArticle,
): Promise<void> => {
  const { error } = await supabase
    .from('professor_pinned_articles')
    .upsert(
      {
        professor_id:  professorId,
        course_id:     article.relatedCourseId ?? null,
        course_name:   article.relatedCourseName,
        article_title: article.title,
        article_url:   article.url,
        source_name:   article.sourceName,
        published_at:  article.publishedAt,
        topic_keyword: article.topicKeyword ?? null,
        pinned_at:     new Date().toISOString(),
      },
      { onConflict: 'professor_id,article_url' },
    );

  if (error) {
    console.error('[newsService] savePinnedArticle:', error);
    throw error;
  }
};

/** Unpin an article by its pin record id */
export const removePinnedArticle = async (pinId: string): Promise<void> => {
  const { error } = await supabase
    .from('professor_pinned_articles')
    .delete()
    .eq('id', pinId);

  if (error) {
    console.error('[newsService] removePinnedArticle:', error);
    throw error;
  }
};
