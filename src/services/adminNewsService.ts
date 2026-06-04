/**
 * adminNewsService.ts
 *
 * Separate admin-only news service — does NOT touch newsService.ts or professor feeds.
 *
 * Architecture:
 *   App  →  Supabase Edge Function 'fetch-admin-news'  →  RSS feeds  →  scored articles
 *
 * ADMIN_DEV_MODE = true  → skip Edge Function, use curated fallback articles.
 * ADMIN_DEV_MODE = false → call Edge Function first; fall back to curated on any error.
 *
 * To enable live RSS:
 *   1. Run: supabase functions deploy fetch-admin-news --no-verify-jwt
 *   2. Change ADMIN_DEV_MODE below to false
 *
 * Supabase tables required (see migrate_admin_news.sql):
 *   admin_pinned_news   — per-admin pins  (admin_id, article_url)
 *   admin_hidden_news   — per-admin hides (admin_id, article_url)
 */

import { supabase } from './supabase';
import { AccreditationType } from '../types';

// ── Toggle ─────────────────────────────────────────────────────────────────────
// Set to false after deploying:  supabase functions deploy fetch-admin-news --no-verify-jwt
const ADMIN_DEV_MODE = true;

// ── Types ──────────────────────────────────────────────────────────────────────
export type AdminNewsCategory =
  | 'accreditation'
  | 'business-schools'
  | 'universities'
  | 'ai-education'
  | 'business-events'
  | 'global-education';

export interface AdminNewsArticle {
  id:                    string;
  title:                 string;
  description:           string;
  source_name:           string;
  source_url:            string;
  article_url:           string;
  published_at:          string;
  category:              AdminNewsCategory;
  tags:                  string[];
  related_accreditation: AccreditationType | null;
  image_url:             string | null;
  relevance_score:       number;
  isPinned:              boolean;
  isHidden:              boolean;
}

// ── Relevance scoring ──────────────────────────────────────────────────────────
export const scoreArticle = (
  article: Pick<AdminNewsArticle, 'title' | 'description' | 'tags' | 'related_accreditation' | 'published_at'>,
  accreditation: string,
): number => {
  let score = 0;
  const text = `${article.title} ${article.description} ${article.tags?.join(' ')}`.toLowerCase();
  const acc  = accreditation.toLowerCase();

  if (text.includes(acc))                                             score += 40;
  if (text.includes('business school'))                               score += 25;
  if (text.includes('higher education') || text.includes('university')) score += 20;
  if (text.includes('accreditation') || text.includes('quality assurance')) score += 20;
  if (text.includes('ai in education') || text.includes('curriculum'))     score += 10;
  if (text.includes('mba') || text.includes('postgraduate'))               score += 10;
  if (text.includes('ranking') || text.includes('research output'))        score += 8;

  // Recency bonus
  const ageMs  = Date.now() - new Date(article.published_at).getTime();
  const ageDays = ageMs / 86_400_000;
  if (ageDays <= 3) score += 20;
  else if (ageDays <= 7) score += 10;
  else if (ageDays <= 14) score += 5;

  // Direct accreditation match bonus
  if (article.related_accreditation === accreditation) score += 30;

  return score;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const h = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

// ── Curated articles (approved publishers only) ───────────────────────────────
const MOCK_ADMIN_ARTICLES: Omit<AdminNewsArticle, 'relevance_score' | 'isPinned' | 'isHidden'>[] = [

  // ── AACSB ──────────────────────────────────────────────────────────────────
  {
    id: 'aacsb-1',
    title: 'From Quiet Influence to Measurable Impact',
    description: 'What if your school is not measuring its biggest impact on the world? Four strategies for translating quiet influence into documented evidence of real-world change — essential reading for administrators preparing accreditation impact narratives.',
    source_name: 'AACSB Insights',
    source_url:  'https://www.aacsb.edu',
    article_url: 'https://www.aacsb.edu/insights/articles/2026/05/from-quiet-influence-to-measurable-impact',
    published_at: h(6),
    category: 'accreditation',
    tags: ['aacsb', 'accreditation', 'business school', 'impact', 'standards'],
    related_accreditation: 'AACSB',
    image_url: null,
  },
  {
    id: 'aacsb-2',
    title: 'BBAs Versus Bots: AI in Business Education',
    description: 'As artificial intelligence drives change in the workplace, business schools are helping students develop three essential competencies new hires must have — including AI workflow design, critical evaluation, and human-centred judgment.',
    source_name: 'AACSB Insights',
    source_url:  'https://www.aacsb.edu',
    article_url: 'https://www.aacsb.edu/insights/articles/2026/05/bbas-versus-bots-ai-in-business-education',
    published_at: h(18),
    category: 'ai-education',
    tags: ['aacsb', 'ai in education', 'curriculum', 'business school', 'learning outcomes'],
    related_accreditation: 'AACSB',
    image_url: null,
  },
  {
    id: 'aacsb-3',
    title: 'Leveling Up: Gamifying the Future of Procurement',
    description: 'Game-based simulations help business students develop practical decision-making abilities and cultivate judgment in supply chain and procurement contexts — an example of experiential learning aligned with AACSB assurance of learning standards.',
    source_name: 'AACSB Insights',
    source_url:  'https://www.aacsb.edu',
    article_url: 'https://www.aacsb.edu/insights/articles/2026/05/leveling-up-gamifying-the-future-of-procurement',
    published_at: h(36),
    category: 'business-schools',
    tags: ['aacsb', 'curriculum', 'business school', 'experiential learning', 'assurance of learning'],
    related_accreditation: 'AACSB',
    image_url: null,
  },
  {
    id: 'aacsb-4',
    title: 'People and Places: AACSB School Updates',
    description: 'Recent developments across AACSB-accredited institutions, including new Global Executive MBA partnerships between European and Asian schools, naming gifts at US business schools, and key leadership appointments across the network.',
    source_name: 'AACSB Insights',
    source_url:  'https://www.aacsb.edu',
    article_url: 'https://www.aacsb.edu/insights/articles/2026/05/people-and-places-may-2026',
    published_at: h(48),
    category: 'accreditation',
    tags: ['aacsb', 'accreditation', 'business school', 'global education', 'faculty'],
    related_accreditation: 'AACSB',
    image_url: null,
  },

  // ── EQUIS ──────────────────────────────────────────────────────────────────
  {
    id: 'equis-1',
    title: 'Specialist Providers Buck Higher Education Downturn Due to Limits on Expansion',
    description: 'Small and specialist institutions may be faring better financially than traditional universities as they have not experienced the boom-and-bust of recent years — a finding relevant to focused business schools managing EQUIS portfolio depth requirements.',
    source_name: 'Times Higher Education',
    source_url:  'https://www.timeshighereducation.com',
    article_url: 'https://www.timeshighereducation.com/news/specialist-providers-buck-downturn-due-limits-expansion',
    published_at: h(8),
    category: 'universities',
    tags: ['equis', 'higher education', 'university', 'quality assurance', 'business school'],
    related_accreditation: 'EQUIS',
    image_url: null,
  },
  {
    id: 'equis-2',
    title: "Tutorials of 30-Plus Students 'Now the Norm', Survey Finds",
    description: "Class sizes at universities have blown out since the pandemic, with tutorials of dozens and lectures of hundreds now the norm — raising significant concerns about teaching quality and learning outcomes that EQUIS reviewers increasingly scrutinise.",
    source_name: 'Times Higher Education',
    source_url:  'https://www.timeshighereducation.com',
    article_url: 'https://www.timeshighereducation.com/news/tutorials-30-plus-students-now-norm-survey-finds',
    published_at: h(22),
    category: 'universities',
    tags: ['equis', 'higher education', 'university', 'teaching quality', 'learning outcomes'],
    related_accreditation: 'EQUIS',
    image_url: null,
  },
  {
    id: 'equis-3',
    title: 'All Manchester Students to Go Out on Placement as Part of Their Degrees',
    description: 'All students at the University of Manchester will be expected to take part in work placements or exchanges, with the vice-chancellor stressing that three years solely in academia is insufficient preparation — a model with direct parallels to EQUIS internationalisation and employability criteria.',
    source_name: 'Times Higher Education',
    source_url:  'https://www.timeshighereducation.com',
    article_url: 'https://www.timeshighereducation.com/news/all-manchester-students-go-out-placement-part-degrees',
    published_at: h(52),
    category: 'business-schools',
    tags: ['equis', 'higher education', 'university', 'curriculum', 'learning outcomes', 'accreditation'],
    related_accreditation: 'EQUIS',
    image_url: null,
  },
  {
    id: 'equis-4',
    title: 'Research Universities Network Rebrands to Focus on Equity in Higher Education',
    description: "An Australian university network has relaunched as the '2050 Alliance', aligning with government equity targets and placing diversity of access at the centre of its strategic agenda — a governance shift reflecting evolving EQUIS societal impact expectations.",
    source_name: 'Times Higher Education',
    source_url:  'https://www.timeshighereducation.com',
    article_url: 'https://www.timeshighereducation.com/news/research-universities-network-rebrands-focus-equity',
    published_at: h(70),
    category: 'global-education',
    tags: ['equis', 'higher education', 'university', 'global education', 'equity', 'accreditation'],
    related_accreditation: 'EQUIS',
    image_url: null,
  },

  // ── AMBA ───────────────────────────────────────────────────────────────────
  {
    id: 'amba-1',
    title: 'Managers Are Struggling to Keep Up with the AI Productivity Boom',
    description: 'AI-driven output is overwhelming managers who lack tools and frameworks to review, direct, and integrate AI-generated work at scale — a finding that highlights a critical gap in MBA-level management training for the current era.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2026/05/managers-are-struggling-to-keep-up-with-the-ai-productivity-boom',
    published_at: h(10),
    category: 'ai-education',
    tags: ['amba', 'mba', 'ai in education', 'management', 'business school', 'leadership'],
    related_accreditation: 'AMBA',
    image_url: null,
  },
  {
    id: 'amba-2',
    title: "Ask Sanyin: Why Can't They See That I'm Visionary?",
    description: "A leadership coaching column examining why high-performing professionals are not perceived as visionary by boards and promotion committees — and how demonstrating strategic, future-oriented thinking is a learnable skill central to MBA programme outcomes.",
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/ask-sanyin-why-cant-they-see-that-im-visionary/',
    published_at: h(28),
    category: 'business-schools',
    tags: ['amba', 'mba', 'leadership', 'management', 'postgraduate', 'business school'],
    related_accreditation: 'AMBA',
    image_url: null,
  },
  {
    id: 'amba-3',
    title: "It's Time to Address the Looming Crisis in Entry-Level Work",
    description: "Early-career workers in AI-exposed occupations experienced a 16% employment decline after generative AI spread — signalling that the MBA talent pipeline and graduate employability frameworks central to AMBA accreditation may need fundamental redesign.",
    source_name: 'MIT Technology Review',
    source_url:  'https://www.technologyreview.com',
    article_url: 'https://www.technologyreview.com/2026/05/26/1137865/its-time-to-address-the-looming-crisis-in-entry-level-work/',
    published_at: h(56),
    category: 'business-schools',
    tags: ['amba', 'mba', 'graduate outcomes', 'ai in education', 'postgraduate', 'business school'],
    related_accreditation: 'AMBA',
    image_url: null,
  },

  // ── General: Business Schools ───────────────────────────────────────────────
  {
    id: 'bs-1',
    title: 'Rethinking Organisational Design in the Age of Agentic AI',
    description: 'Organisations want to adopt AI agents within three years, but 76% say their current operations cannot support this shift — a finding with direct implications for how business schools must update their organisational behaviour and strategy curricula.',
    source_name: 'MIT Technology Review',
    source_url:  'https://www.technologyreview.com',
    article_url: 'https://www.technologyreview.com/2026/05/26/1137584/rethinking-organizational-design-in-the-age-of-agentic-ai/',
    published_at: h(14),
    category: 'ai-education',
    tags: ['business school', 'ai in education', 'curriculum', 'higher education', 'research output'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'bs-2',
    title: "Data Transformation Is the CEO's Business",
    description: "Caterpillar's data transformation journey shows how CEO engagement and enterprise data platforms drive significant revenue growth — a case study business schools can use to ground digital strategy and data leadership modules in real-world outcomes.",
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/data-transformation-is-the-ceos-business/',
    published_at: h(30),
    category: 'business-schools',
    tags: ['business school', 'curriculum', 'higher education', 'leadership', 'teaching quality'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'bs-3',
    title: "Surprise: Corporate Sustainability Isn't Dead",
    description: "Despite a challenging political environment, ongoing corporate sustainability progress is documented — timely evidence for business schools integrating ESG and sustainable development goals into their accreditation frameworks and course design.",
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/surprise-corporate-sustainability-isnt-dead/',
    published_at: h(44),
    category: 'business-schools',
    tags: ['business school', 'sustainability', 'accreditation', 'curriculum', 'higher education'],
    related_accreditation: null,
    image_url: null,
  },

  // ── General: Universities ───────────────────────────────────────────────────
  {
    id: 'uni-1',
    title: 'For Multinational Companies, Localisation Matters More Than Ever',
    description: 'Three keys to success in a fractured global business environment — research directly relevant to universities designing international programmes and crafting the partnership strategies increasingly scrutinised in global accreditation reviews.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2026/01/for-multinational-companies-localization-matters-more-than-ever',
    published_at: h(16),
    category: 'global-education',
    tags: ['higher education', 'university', 'global education', 'international students', 'accreditation'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'uni-2',
    title: 'The Hidden Cost of Rushing into Emerging Markets',
    description: 'A framework demonstrating how rapid market entry often undermines partnerships and long-term value — with direct implications for universities expanding internationally and the due-diligence processes accreditation bodies expect.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2025/09/the-hidden-cost-of-rushing-into-emerging-markets',
    published_at: h(42),
    category: 'universities',
    tags: ['higher education', 'university', 'global education', 'internationalisation', 'quality assurance'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'uni-3',
    title: "To Compete in the Global Economy, Europe Needs to Boost Its VC Ecosystem",
    description: "Three strategies for strengthening Europe's venture capital sector to maintain global competitiveness — with implications for how business schools design entrepreneurship programmes and connect students with regional industry ecosystems.",
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2026/01/to-compete-in-the-global-economy-europe-needs-to-boost-its-vc-ecosystem',
    published_at: h(64),
    category: 'universities',
    tags: ['university', 'higher education', 'entrepreneurship', 'europe', 'global education'],
    related_accreditation: null,
    image_url: null,
  },

  // ── General: AI in Education ────────────────────────────────────────────────
  {
    id: 'ai-1',
    title: 'A Reality Check on the AI Jobs Hysteria',
    description: 'US labor statistics reveal AI has had minimal large-scale impact so far, but entry-level positions in AI-exposed fields show early signs of decline — directly relevant to graduate employability frameworks and curriculum design in accreditation reviews.',
    source_name: 'MIT Technology Review',
    source_url:  'https://www.technologyreview.com',
    article_url: 'https://www.technologyreview.com/2026/05/26/1137855/a-reality-check-on-the-ai-jobs-hysteria/',
    published_at: h(12),
    category: 'ai-education',
    tags: ['ai in education', 'higher education', 'university', 'curriculum', 'graduate outcomes'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'ai-2',
    title: 'How Finance Teams Can Succeed with AI',
    description: 'Successful AI implementation in finance functions depends primarily on leadership decisions rather than technical capabilities — a finding that should directly shape how business schools design their fintech, AI in business, and accounting curricula.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2025/08/how-finance-teams-can-succeed-with-ai',
    published_at: h(32),
    category: 'ai-education',
    tags: ['ai in education', 'curriculum', 'business school', 'higher education', 'faculty'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'ai-3',
    title: "Companies Don't Have to Slash Jobs Because of AI",
    description: "Companies can preserve employment while implementing AI — comparing AI-driven displacement to a collective action problem. A key framework for how business schools can equip graduates to lead responsible AI adoption programmes.",
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/companies-dont-have-to-slash-jobs-because-of-ai/',
    published_at: h(58),
    category: 'ai-education',
    tags: ['ai in education', 'curriculum', 'higher education', 'university', 'pedagogy'],
    related_accreditation: null,
    image_url: null,
  },

  // ── General: Business Events ────────────────────────────────────────────────
  {
    id: 'ev-1',
    title: 'How to Compete Against Agentic Startups',
    description: 'Strategic analysis of how established companies respond as AI-powered agentic startups challenge incumbents — a key theme at global business education summits and relevant to how schools update competitive strategy and innovation management curricula.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2026/05/how-to-compete-against-agentic-startups',
    published_at: h(20),
    category: 'business-events',
    tags: ['business school', 'ai in education', 'higher education', 'curriculum', 'conference'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'ev-2',
    title: "The Innovation Advantage GenAI Can't Give You",
    description: "What generative AI cannot provide in terms of sustainable competitive innovation advantages — a pivotal topic for deans and faculty designing the next generation of innovation management and entrepreneurship programmes.",
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/the-innovation-advantage-genai-cant-give-you/',
    published_at: h(40),
    category: 'business-events',
    tags: ['business school', 'higher education', 'curriculum', 'faculty', 'conference', 'research output'],
    related_accreditation: null,
    image_url: null,
  },

  // ── General: Global Education ───────────────────────────────────────────────
  {
    id: 'ge-1',
    title: 'Research Reveals a Fundamental Shift in How Investors View ESG',
    description: 'ESG concerns are increasingly treated like any other investment consideration — with major implications for how business schools position their sustainability and responsible management programmes in a changing global accreditation landscape.',
    source_name: 'Harvard Business Review',
    source_url:  'https://hbr.org',
    article_url: 'https://hbr.org/2026/02/research-reveals-a-fundamental-shift-in-how-investors-view-esg',
    published_at: h(24),
    category: 'global-education',
    tags: ['higher education', 'university', 'sustainability', 'global education', 'curriculum'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'ge-2',
    title: 'What Global Turmoil Means for Company Structure',
    description: 'Research analysing how geopolitical instability should influence organisational design decisions — directly relevant to the internationalisation strategies of global business schools and the dual-degree and exchange programmes assessed in accreditation.',
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/what-global-turmoil-means-for-company-structure/',
    published_at: h(66),
    category: 'global-education',
    tags: ['higher education', 'university', 'global education', 'international students', 'business school'],
    related_accreditation: null,
    image_url: null,
  },
  {
    id: 'ge-3',
    title: 'The Greenhushing Trap',
    description: 'Corporate silence about sustainability efforts can undermine transformation as much as overcommunication generates backlash — with direct implications for how business schools embed responsible management and sustainability reporting into their accreditation frameworks.',
    source_name: 'MIT Sloan Management Review',
    source_url:  'https://sloanreview.mit.edu',
    article_url: 'https://sloanreview.mit.edu/article/the-greenhushing-trap/',
    published_at: h(78),
    category: 'global-education',
    tags: ['higher education', 'university', 'sustainability', 'accreditation', 'quality assurance'],
    related_accreditation: null,
    image_url: null,
  },
];

// ── Supabase helpers (graceful — tables may not exist yet) ────────────────────

const getPinnedUrls = async (adminId: string): Promise<Set<string>> => {
  try {
    const { data } = await supabase
      .from('admin_pinned_news')
      .select('article_url')
      .eq('admin_id', adminId);
    return new Set((data ?? []).map((r: any) => r.article_url as string));
  } catch {
    return new Set();
  }
};

const getHiddenUrls = async (adminId: string): Promise<Set<string>> => {
  try {
    const { data } = await supabase
      .from('admin_hidden_news')
      .select('article_url')
      .eq('admin_id', adminId);
    return new Set((data ?? []).map((r: any) => r.article_url as string));
  } catch {
    return new Set();
  }
};

// ── Main feed ──────────────────────────────────────────────────────────────────

// ── Helpers: normalize raw RSS articles from Edge Function ────────────────────
const FIVE_DAYS_MS_ADMIN = 5 * 24 * 3_600_000;

function normalizeLiveArticle(
  raw: any,
  accreditation: string,
  pinnedUrls: Set<string>,
  hiddenUrls: Set<string>,
): AdminNewsArticle | null {
  if (!raw.article_url || !raw.title) return null;
  if (hiddenUrls.has(raw.article_url)) return null;
  if (!raw.isPinned && new Date(raw.published_at).getTime() < Date.now() - FIVE_DAYS_MS_ADMIN) return null;

  const partial: Omit<AdminNewsArticle, 'relevance_score' | 'isPinned' | 'isHidden'> = {
    id:                    raw.id ?? `live-${Date.now()}`,
    title:                 raw.title,
    description:           raw.description ?? '',
    source_name:           raw.source_name ?? '',
    source_url:            raw.source_url ?? '',
    article_url:           raw.article_url,
    published_at:          raw.published_at ?? new Date().toISOString(),
    category:              (raw.category as AdminNewsCategory) ?? 'global-education',
    tags:                  Array.isArray(raw.tags) ? raw.tags : [],
    related_accreditation: (raw.related_accreditation as AccreditationType | null) ?? null,
    image_url:             raw.image_url ?? null,
  };

  return {
    ...partial,
    relevance_score: scoreArticle(partial, accreditation),
    isPinned:        pinnedUrls.has(raw.article_url),
    isHidden:        false,
  };
}

/**
 * Returns the full scored, personalised admin news feed.
 * Hidden articles are excluded; pinned articles are flagged.
 *
 * Flow:
 *   ADMIN_DEV_MODE = true  → curated fallback articles immediately
 *   ADMIN_DEV_MODE = false → try Edge Function 'fetch-admin-news', fall back on error
 */
export const getAdminNewsFeed = async (
  adminId:       string,
  accreditation: string,
): Promise<AdminNewsArticle[]> => {
  const [pinnedUrls, hiddenUrls] = await Promise.all([
    getPinnedUrls(adminId),
    getHiddenUrls(adminId),
  ]);

  const fiveDaysAgo = Date.now() - FIVE_DAYS_MS_ADMIN;

  // ── Live path (Edge Function) ──────────────────────────────────────────────
  if (!ADMIN_DEV_MODE) {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-admin-news', {
        body: { adminId, accreditation },
      });

      if (error) throw error;

      const rawArticles: any[] = data?.articles ?? [];
      if (rawArticles.length > 0) {
        const normalized = rawArticles
          .map(r => normalizeLiveArticle(r, accreditation, pinnedUrls, hiddenUrls))
          .filter((a): a is AdminNewsArticle => a !== null);

        if (normalized.length > 0) {
          return normalized.sort((a, b) => b.relevance_score - a.relevance_score);
        }
      }
    } catch (err: any) {
      console.warn('[adminNewsService] Edge Function unavailable, using curated articles:', err?.message ?? err);
    }
  }

  // ── Curated fallback (always used when ADMIN_DEV_MODE = true, or on Edge Function error) ──
  return MOCK_ADMIN_ARTICLES
    .filter(a => !hiddenUrls.has(a.article_url))
    .map(a => ({
      ...a,
      relevance_score: scoreArticle(a, accreditation),
      isPinned:        pinnedUrls.has(a.article_url),
      isHidden:        false,
    }))
    .filter(a => a.isPinned || new Date(a.published_at).getTime() >= fiveDaysAgo)
    .sort((a, b) => b.relevance_score - a.relevance_score);
};

/**
 * Returns top N articles for the Admin Home page preview (pinned appear first).
 */
export const getTopAdminNews = async (
  adminId:       string,
  accreditation: string,
  count = 3,
): Promise<AdminNewsArticle[]> => {
  const feed = await getAdminNewsFeed(adminId, accreditation);
  const pinned   = feed.filter(a => a.isPinned);
  const unpinned = feed.filter(a => !a.isPinned);
  return [...pinned, ...unpinned].slice(0, count);
};

// ── Pin / Unpin ────────────────────────────────────────────────────────────────

export const pinAdminArticle = async (
  adminId:     string,
  article_url: string,
  title:       string,
): Promise<void> => {
  try {
    await supabase.from('admin_pinned_news').upsert(
      { admin_id: adminId, article_url, article_title: title, pinned_at: new Date().toISOString() },
      { onConflict: 'admin_id,article_url' },
    );
  } catch (e) {
    console.warn('[adminNewsService] pinAdminArticle failed (table may not exist yet):', e);
  }
};

export const unpinAdminArticle = async (
  adminId:     string,
  article_url: string,
): Promise<void> => {
  try {
    await supabase
      .from('admin_pinned_news')
      .delete()
      .eq('admin_id', adminId)
      .eq('article_url', article_url);
  } catch (e) {
    console.warn('[adminNewsService] unpinAdminArticle failed:', e);
  }
};

export const togglePinAdminArticle = async (
  adminId:     string,
  article:     AdminNewsArticle,
): Promise<boolean> => {
  if (article.isPinned) {
    await unpinAdminArticle(adminId, article.article_url);
    return false;
  } else {
    await pinAdminArticle(adminId, article.article_url, article.title);
    return true;
  }
};

// ── Hide ───────────────────────────────────────────────────────────────────────

export const hideAdminArticle = async (
  adminId:     string,
  article_url: string,
): Promise<void> => {
  try {
    await supabase.from('admin_hidden_news').upsert(
      { admin_id: adminId, article_url, hidden_at: new Date().toISOString() },
      { onConflict: 'admin_id,article_url' },
    );
  } catch (e) {
    console.warn('[adminNewsService] hideAdminArticle failed (table may not exist yet):', e);
  }
};

// ── Diversity / deduplication helpers ────────────────────────────────────────

const SIMILARITY_STOPWORDS = new Set([
  'about', 'after', 'their', 'there', 'which', 'these', 'those',
  'school', 'schools', 'university', 'universities', 'education',
  'business', 'higher', 'news', 'global',
]);

const normalizeForSimilarity = (text: string): Set<string> => {
  const words = text
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !SIMILARITY_STOPWORDS.has(w));
  return new Set(words);
};

export const areArticlesSimilar = (a: string, b: string): boolean => {
  const wordsA = normalizeForSimilarity(a);
  const wordsB = normalizeForSimilarity(b);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  return intersection / Math.min(wordsA.size, wordsB.size) > 0.6;
};

/**
 * Returns a diverse, deduplicated slice of the article list.
 * Pinned articles are always kept; the rest are picked greedily to maximise
 * relevance while avoiding near-duplicate titles/descriptions.
 */
export const getDiverseTopNews = (
  articles: AdminNewsArticle[],
  limit = 7,
): AdminNewsArticle[] => {
  const sorted = [...articles].sort((a, b) => {
    const pinDiff = Number(b.isPinned) - Number(a.isPinned);
    if (pinDiff !== 0) return pinDiff;
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
    return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
  });

  const selected: AdminNewsArticle[] = [];
  for (const article of sorted) {
    const text = `${article.title} ${article.description ?? ''}`.toLowerCase();
    const tooSimilar = selected.some(existing =>
      areArticlesSimilar(text, `${existing.title} ${existing.description ?? ''}`.toLowerCase()),
    );
    if (!tooSimilar) selected.push(article);
    if (selected.length >= limit) break;
  }
  return selected;
};

// ── Category label map ─────────────────────────────────────────────────────────
export const CATEGORY_LABELS: Record<AdminNewsCategory, string> = {
  'accreditation':   'Accreditation',
  'business-schools': 'Business Schools',
  'universities':    'Universities',
  'ai-education':    'AI in Education',
  'business-events': 'Business Events',
  'global-education': 'Global Education',
};

export const CATEGORY_COLORS: Record<AdminNewsCategory, string> = {
  'accreditation':    '#1A5C38',
  'business-schools': '#1D4ED8',
  'universities':     '#7C3AED',
  'ai-education':     '#0D9488',
  'business-events':  '#D97706',
  'global-education': '#DC2626',
};
