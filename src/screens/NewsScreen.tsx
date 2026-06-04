import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Modal,
  Switch, Platform,
} from 'react-native';
import { Course, NewsArticle, NewsPreference, PinnedArticle } from '../types';
import {
  fetchCourseNews,
  getProfessorNewsPreferences,
  saveProfessorNewsPreferences,
  getPinnedArticles,
  savePinnedArticle,
  removePinnedArticle,
  DEFAULT_NEWS_SOURCES,
} from '../services/newsService';

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  forest:    '#1A5C38',
  leaf:      '#3A8F5F',
  mist:      '#F2FAF5',
  ink:       '#1A1A1A',
  inkMid:    'rgba(26,26,26,0.65)',
  inkSoft:   'rgba(26,26,26,0.4)',
  border:    '#E0EDE6',
  card:      '#FFFFFF',
  green50:   '#F0F6EF',
  green100:  '#E2EFE5',
  amber:     '#D97706',
  amberBg:   '#FFFBEB',
  amberBdr:  '#FDE68A',
  red:       '#DC2626',
  redBg:     '#FEF2F2',
  redBdr:    '#FECACA',
  blue:      '#1D4ED8',
  blueBg:    '#EFF6FF',
  blueBdr:   '#BFDBFE',
  pinYellow: '#F59E0B',
  pinBg:     '#FFFBEB',
  bg:        '#F5F9F3',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const sourceInitial = (name: string) => name.charAt(0).toUpperCase();

const SOURCE_COLORS = [
  '#1A5C38', '#2563EB', '#DC2626', '#D97706',
  '#7C3AED', '#0891B2', '#059669', '#9333EA',
];
const sourceColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return SOURCE_COLORS[Math.abs(hash) % SOURCE_COLORS.length];
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  profile: { id: string; full_name: string };
  courses: Course[];
}

// ── Component ──────────────────────────────────────────────────────────────────
const NewsScreen: React.FC<Props> = ({ profile, courses }) => {
  const [articles,     setArticles]     = useState<NewsArticle[]>([]);
  const [pinned,       setPinned]       = useState<PinnedArticle[]>([]);
  const [preferences,  setPreferences]  = useState<NewsPreference[]>(
    DEFAULT_NEWS_SOURCES.map(s => ({ ...s })),
  );
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Filters
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showPinned,     setShowPinned]     = useState(true);

  // Source preferences modal
  const [showPrefs,    setShowPrefs]    = useState(false);
  const [draftPrefs,   setDraftPrefs]   = useState<NewsPreference[]>([]);
  const [savingPrefs,  setSavingPrefs]  = useState(false);

  // Pin action loading set
  const [pinningUrls, setPinningUrls] = useState<Set<string>>(new Set());

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    try {
      const [prefs, pins] = await Promise.all([
        getProfessorNewsPreferences(profile.id),
        getPinnedArticles(profile.id),
      ]);

      setPreferences(prefs);
      setPinned(pins);

      const { articles: fetched, error: fetchErr } = await fetchCourseNews(courses, profile.id, prefs);

      if (fetchErr) {
        setError(fetchErr);
        setArticles([]);
      } else {
        // Mark which articles are already pinned
        const pinnedUrls = new Set(pins.map(p => p.article_url));
        setArticles(fetched.map(a => ({ ...a, isPinned: pinnedUrls.has(a.url) })));
      }
    } catch (e: any) {
      setError('Could not load recent news right now. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.id, courses]);

  useEffect(() => { load(); }, [load]);

  // ── Open article ──────────────────────────────────────────────────────────
  const handleReadArticle = (url: string) => {
    if (!url) return;
    if (Platform.OS === 'web') {
      (window as any).open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url).catch(e => console.warn('[NewsScreen] openURL:', e));
    }
  };

  // ── Pin / unpin ───────────────────────────────────────────────────────────
  const handlePin = async (article: NewsArticle) => {
    setPinningUrls(prev => new Set(prev).add(article.url));
    try {
      if (article.isPinned) {
        // Find the pin record by URL
        const pin = pinned.find(p => p.article_url === article.url);
        if (pin) {
          await removePinnedArticle(pin.id);
          setPinned(prev => prev.filter(p => p.id !== pin.id));
        }
        setArticles(prev => prev.map(a => a.url === article.url ? { ...a, isPinned: false } : a));
      } else {
        await savePinnedArticle(profile.id, article);
        const newPin: PinnedArticle = {
          id:            `local-${Date.now()}`,
          professor_id:  profile.id,
          course_id:     article.relatedCourseId ?? null,
          course_name:   article.relatedCourseName,
          article_title: article.title,
          article_url:   article.url,
          source_name:   article.sourceName,
          published_at:  article.publishedAt,
          topic_keyword: article.topicKeyword ?? null,
          pinned_at:     new Date().toISOString(),
          created_at:    new Date().toISOString(),
        };
        setPinned(prev => [newPin, ...prev]);
        setArticles(prev => prev.map(a => a.url === article.url ? { ...a, isPinned: true } : a));
      }
    } catch (e) {
      console.warn('[NewsScreen] handlePin:', e);
    } finally {
      setPinningUrls(prev => { const s = new Set(prev); s.delete(article.url); return s; });
    }
  };

  // ── Open preferences modal ────────────────────────────────────────────────
  const openPrefs = () => {
    setDraftPrefs(preferences.map(p => ({ ...p })));
    setShowPrefs(true);
  };

  const toggleDraftPref = (sourceName: string) => {
    setDraftPrefs(prev => prev.map(p =>
      p.source_name === sourceName ? { ...p, is_enabled: !p.is_enabled } : p,
    ));
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      await saveProfessorNewsPreferences(profile.id, draftPrefs);
      setPreferences(draftPrefs);
      setShowPrefs(false);
      // Refresh articles with new preferences
      load(true);
    } catch {
      // Error already logged in service
    } finally {
      setSavingPrefs(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = selectedCourse === 'all'
    ? articles
    : articles.filter(a => a.relatedCourseId === selectedCourse);

  const enabledCount = preferences.filter(p => p.is_enabled).length;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator color={C.leaf} size="large" />
        <Text style={s.loadingText}>Loading recent course news…</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.leaf}
          />
        }
      >
        {/* ── Page header ── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Course News</Text>
          <Text style={s.pageSub}>
            Recent articles connected to your courses and syllabus topics.
          </Text>
        </View>

        {/* ── Controls row ── */}
        <View style={s.controlsRow}>
          {/* Course filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.courseFilterScroll}>
            <View style={s.courseFilterRow}>
              <TouchableOpacity
                style={[s.courseChip, selectedCourse === 'all' && s.courseChipActive]}
                onPress={() => setSelectedCourse('all')}
              >
                <Text style={[s.courseChipText, selectedCourse === 'all' && s.courseChipTextActive]}>
                  All courses
                </Text>
              </TouchableOpacity>
              {courses.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.courseChip, selectedCourse === c.id && s.courseChipActive]}
                  onPress={() => setSelectedCourse(selectedCourse === c.id ? 'all' : c.id)}
                >
                  <Text
                    style={[s.courseChipText, selectedCourse === c.id && s.courseChipTextActive]}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Sources button */}
          <TouchableOpacity style={s.sourcesBtn} onPress={openPrefs} activeOpacity={0.75}>
            <Text style={s.sourcesBtnIcon}>📡</Text>
            <Text style={s.sourcesBtnText}>Sources</Text>
            <View style={s.sourcesBadge}>
              <Text style={s.sourcesBadgeText}>{enabledCount}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Error state ── */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
              <Text style={s.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pinned articles ── */}
        {pinned.length > 0 && (
          <View style={s.section}>
            <TouchableOpacity
              style={s.sectionHeaderRow}
              onPress={() => setShowPinned(v => !v)}
              activeOpacity={0.7}
            >
              <View style={s.sectionHeaderLeft}>
                <Text style={s.sectionIcon}>📌</Text>
                <Text style={s.sectionTitle}>Pinned Articles</Text>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{pinned.length}</Text>
                </View>
              </View>
              <Text style={s.collapseIcon}>{showPinned ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPinned && pinned.map(pin => (
              <PinnedCard
                key={pin.id}
                pin={pin}
                onRead={() => handleReadArticle(pin.article_url)}
                onUnpin={async () => {
                  try {
                    await removePinnedArticle(pin.id);
                    setPinned(prev => prev.filter(p => p.id !== pin.id));
                    setArticles(prev => prev.map(a =>
                      a.url === pin.article_url ? { ...a, isPinned: false } : a,
                    ));
                  } catch { /* logged in service */ }
                }}
              />
            ))}
          </View>
        )}

        {/* ── Live articles ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <View style={s.sectionHeaderLeft}>
              <Text style={s.sectionIcon}>📰</Text>
              <Text style={s.sectionTitle}>
                {selectedCourse === 'all' ? 'Recent Articles' : courses.find(c => c.id === selectedCourse)?.name}
              </Text>
              {filtered.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{filtered.length}</Text>
                </View>
              )}
            </View>
          </View>

          {!error && filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTitle}>No recent trusted articles available right now.</Text>
              <Text style={s.emptyText}>
                Check back soon — articles from trusted publishers will appear here automatically.
              </Text>
              <TouchableOpacity style={s.refreshBtn} onPress={() => load(true)}>
                <Text style={s.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}

          {filtered.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              isPinning={pinningUrls.has(article.url)}
              onRead={() => handleReadArticle(article.url)}
              onPin={() => handlePin(article)}
            />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════
          SOURCE PREFERENCES MODAL
      ══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showPrefs}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPrefs(false)}
      >
        <View style={pm.overlay}>
          <TouchableOpacity style={pm.backdrop} onPress={() => setShowPrefs(false)} />
          <View style={pm.sheet}>
            {/* Sheet header */}
            <View style={pm.sheetHeader}>
              <TouchableOpacity onPress={() => setShowPrefs(false)}>
                <Text style={pm.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={pm.sheetTitle}>News Sources</Text>
              <View style={{ width: 56 }} />
            </View>

            <Text style={pm.sheetSub}>
              Toggle sources on or off. Only articles from enabled sources will be shown.
            </Text>

            <ScrollView contentContainerStyle={pm.body} showsVerticalScrollIndicator={false}>
              {draftPrefs.map(pref => (
                <View key={pref.source_name} style={pm.prefRow}>
                  <View style={[pm.prefIcon, { backgroundColor: sourceColor(pref.source_name) }]}>
                    <Text style={pm.prefIconText}>{sourceInitial(pref.source_name)}</Text>
                  </View>
                  <View style={pm.prefBody}>
                    <Text style={pm.prefName}>{pref.source_name}</Text>
                    {pref.source_url && (
                      <Text style={pm.prefUrl} numberOfLines={1}>{pref.source_url}</Text>
                    )}
                  </View>
                  <Switch
                    value={pref.is_enabled}
                    onValueChange={() => toggleDraftPref(pref.source_name)}
                    trackColor={{ false: '#E5E7EB', true: C.leaf }}
                    thumbColor={pref.is_enabled ? '#FFFFFF' : '#D1D5DB'}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
              ))}
            </ScrollView>

            <View style={pm.footer}>
              <TouchableOpacity
                style={[pm.saveBtn, savingPrefs && { opacity: 0.6 }]}
                onPress={savePrefs}
                disabled={savingPrefs}
              >
                {savingPrefs
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={pm.saveBtnText}>Save Preferences</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Article card ───────────────────────────────────────────────────────────────
interface ArticleCardProps {
  article:   NewsArticle;
  isPinning: boolean;
  onRead:    () => void;
  onPin:     () => void;
}
const ArticleCard: React.FC<ArticleCardProps> = ({ article, isPinning, onRead, onPin }) => {
  const color = sourceColor(article.sourceName);
  const hasUrl = !!article.url;
  return (
    <View style={ac.card}>
      {/* Tappable content area: source row + title + snippet + keyword */}
      <TouchableOpacity
        onPress={onRead}
        activeOpacity={0.82}
        disabled={!hasUrl}
        style={ac.contentArea}
      >
        {/* Top row: source + time + course badge */}
        <View style={ac.topRow}>
          <View style={[ac.sourceIcon, { backgroundColor: color }]}>
            <Text style={ac.sourceIconText}>{sourceInitial(article.sourceName)}</Text>
          </View>
          <View style={ac.topMeta}>
            <Text style={ac.sourceName}>{article.sourceName}</Text>
            <Text style={ac.publishedAt}>{relativeTime(article.publishedAt)}</Text>
          </View>
          <View style={ac.courseBadge}>
            <Text style={ac.courseBadgeText} numberOfLines={1}>{article.relatedCourseName}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={ac.title} numberOfLines={3}>{article.title}</Text>

        {/* Snippet */}
        {!!article.snippet && (
          <Text style={ac.snippet} numberOfLines={3}>{article.snippet}</Text>
        )}

        {/* Topic keyword */}
        {!!article.topicKeyword && (
          <View style={ac.keywordWrap}>
            <View style={ac.keywordChip}>
              <Text style={ac.keywordText}># {article.topicKeyword}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Action row — separate so pin button doesn't trigger card tap */}
      <View style={ac.actions}>
        <TouchableOpacity
          style={[ac.readBtn, !hasUrl && { opacity: 0.45 }]}
          onPress={onRead}
          activeOpacity={0.8}
          disabled={!hasUrl}
        >
          <Text style={ac.readBtnText}>Read Article →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ac.pinBtn, article.isPinned && ac.pinBtnActive]}
          onPress={onPin}
          disabled={isPinning}
          activeOpacity={0.75}
        >
          {isPinning
            ? <ActivityIndicator color={C.pinYellow} size="small" />
            : <Text style={[ac.pinBtnText, article.isPinned && ac.pinBtnTextActive]}>
                {article.isPinned ? '📌 Pinned' : '📌 Pin'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Pinned card ────────────────────────────────────────────────────────────────
interface PinnedCardProps {
  pin:      PinnedArticle;
  onRead:   () => void;
  onUnpin:  () => void;
}
const PinnedCard: React.FC<PinnedCardProps> = ({ pin, onRead, onUnpin }) => {
  const color = sourceColor(pin.source_name);
  const hasUrl = !!pin.article_url;
  return (
    <View style={[ac.card, pc.pinnedCard]}>
      {/* Tappable content area */}
      <TouchableOpacity
        onPress={onRead}
        activeOpacity={0.82}
        disabled={!hasUrl}
        style={ac.contentArea}
      >
        <View style={ac.topRow}>
          <View style={[ac.sourceIcon, { backgroundColor: color }]}>
            <Text style={ac.sourceIconText}>{sourceInitial(pin.source_name)}</Text>
          </View>
          <View style={ac.topMeta}>
            <Text style={ac.sourceName}>{pin.source_name}</Text>
            <Text style={ac.publishedAt}>
              {pin.published_at ? relativeTime(pin.published_at) : 'Previously'}
            </Text>
          </View>
          <View style={[ac.courseBadge, { maxWidth: 100 }]}>
            <Text style={ac.courseBadgeText} numberOfLines={1}>{pin.course_name}</Text>
          </View>
        </View>

        <Text style={ac.title} numberOfLines={3}>{pin.article_title}</Text>

        {!!pin.topic_keyword && (
          <View style={ac.keywordWrap}>
            <View style={ac.keywordChip}>
              <Text style={ac.keywordText}># {pin.topic_keyword}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <View style={ac.actions}>
        <TouchableOpacity
          style={[ac.readBtn, !hasUrl && { opacity: 0.45 }]}
          onPress={onRead}
          activeOpacity={0.8}
          disabled={!hasUrl}
        >
          <Text style={ac.readBtnText}>Read Article →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.unpinBtn} onPress={onUnpin} activeOpacity={0.75}>
          <Text style={pc.unpinBtnText}>Unpin</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  content:    { padding: 16 },

  centre:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  loadingText: { fontSize: 14, color: C.inkMid, textAlign: 'center' },

  pageHeader: { marginBottom: 16 },
  pageTitle:  { fontSize: 28, fontWeight: '500', color: C.forest, marginBottom: 4 },
  pageSub:    { fontSize: 13, color: C.inkMid },

  controlsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  courseFilterScroll: { flex: 1 },
  courseFilterRow: { flexDirection: 'row', gap: 6, paddingRight: 4 },
  courseChip: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  courseChipActive: { backgroundColor: C.forest, borderColor: C.forest },
  courseChipText: { fontSize: 12, fontWeight: '500', color: C.inkMid },
  courseChipTextActive: { color: '#fff' },

  sourcesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    flexShrink: 0,
  },
  sourcesBtnIcon: { fontSize: 14 },
  sourcesBtnText: { fontSize: 12, fontWeight: '500', color: C.forest },
  sourcesBadge: {
    backgroundColor: C.forest, borderRadius: 999,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sourcesBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  errorBox: {
    backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBdr,
    borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16, gap: 8,
  },
  errorIcon: { fontSize: 28 },
  errorText: { fontSize: 13, color: C.red, textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.red, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 8, marginTop: 4,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  section: { marginBottom: 8 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, marginBottom: 4,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionIcon:  { fontSize: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  countBadge: {
    backgroundColor: C.green100, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: C.forest },
  collapseIcon: { fontSize: 11, color: C.inkSoft },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon:  { fontSize: 36 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  emptyText:  { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 20 },
  refreshBtn: {
    marginTop: 8, backgroundColor: C.forest, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  refreshBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});

// Article card styles
const ac = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  contentArea: { marginBottom: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sourceIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sourceIconText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  topMeta: { flex: 1 },
  sourceName:  { fontSize: 12, fontWeight: '600', color: C.ink },
  publishedAt: { fontSize: 11, color: C.inkSoft },
  courseBadge: {
    backgroundColor: C.green50, borderRadius: 999, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 8, paddingVertical: 3, maxWidth: 120,
  },
  courseBadgeText: { fontSize: 10, fontWeight: '600', color: C.forest },

  title: { fontSize: 14, fontWeight: '600', color: C.ink, lineHeight: 20, marginBottom: 6 },
  snippet: { fontSize: 12, color: C.inkMid, lineHeight: 17, marginBottom: 8 },

  keywordWrap: { flexDirection: 'row', marginBottom: 10 },
  keywordChip: {
    backgroundColor: C.mist, borderRadius: 999, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  keywordText: { fontSize: 11, fontWeight: '500', color: C.leaf },

  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  readBtn: {
    flex: 1, backgroundColor: C.forest, borderRadius: 8,
    paddingVertical: 9, alignItems: 'center',
  },
  readBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pinBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
    minWidth: 80,
  },
  pinBtnActive:     { backgroundColor: C.pinBg, borderColor: C.pinYellow },
  pinBtnText:       { fontSize: 12, fontWeight: '500', color: C.inkMid },
  pinBtnTextActive: { color: C.pinYellow, fontWeight: '600' },
});

// Pinned card extra styles
const pc = StyleSheet.create({
  pinnedCard: { borderColor: C.pinYellow, borderLeftWidth: 3 },
  unpinBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center',
  },
  unpinBtnText: { fontSize: 12, fontWeight: '500', color: C.inkMid },
});

// Preferences modal styles
const pm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cancelTxt:  { fontSize: 14, color: C.inkMid, fontWeight: '500' },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  sheetSub: {
    fontSize: 12, color: C.inkMid, paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  body: { paddingHorizontal: 16, paddingVertical: 8 },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  prefIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  prefIconText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  prefBody:  { flex: 1 },
  prefName:  { fontSize: 13, fontWeight: '600', color: C.ink },
  prefUrl:   { fontSize: 11, color: C.inkSoft, marginTop: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  saveBtn: {
    backgroundColor: C.forest, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default NewsScreen;
