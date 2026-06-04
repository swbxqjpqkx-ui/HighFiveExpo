import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Linking, Platform, Alert,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Profile } from '../../types';
import { useInstitution } from '../../context/InstitutionContext';
import {
  AdminNewsArticle, AdminNewsCategory,
  CATEGORY_LABELS, CATEGORY_COLORS,
  getAdminNewsFeed, togglePinAdminArticle, hideAdminArticle,
  getDiverseTopNews,
} from '../../services/adminNewsService';

interface Props { profile: Profile; }

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  forest:  '#1A5C38', leaf:   '#3A8F5F', mist:   '#F2FAF5',
  ink:     '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)', inkSoft: 'rgba(26,26,26,0.4)',
  border:  '#E0EDE6', card:   '#FFFFFF', green50: '#F0F6EF',
  bg:      '#F5F9F3',
  amber:   '#D97706', amberBg: '#FFFBEB',
  teal:    '#0D9488',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const now = Date.now();
  const diffH = (now - d.getTime()) / 3_600_000;
  if (diffH < 1)   return 'Just now';
  if (diffH < 24)  return `${Math.round(diffH)}h ago`;
  if (diffH < 48)  return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const openArticle = (url: string) => {
  if (Platform.OS === 'web') {
    (window as any).open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => Alert.alert('Could not open article.'));
  }
};

// ── Filter funnel icon ────────────────────────────────────────────────────────
const FunnelIcon: React.FC<{ active: boolean }> = ({ active }) => {
  const col = active ? C.forest : C.inkMid;
  return (
    <View style={{ alignItems: 'center', gap: 3.5 }}>
      <View style={{ width: 18, height: 2, backgroundColor: col, borderRadius: 1 }} />
      <View style={{ width: 13, height: 2, backgroundColor: col, borderRadius: 1 }} />
      <View style={{ width: 8,  height: 2, backgroundColor: col, borderRadius: 1 }} />
    </View>
  );
};

// ── Sort type ─────────────────────────────────────────────────────────────────
type SortMode = 'relevant' | 'recent' | 'pinned';

// ── Article card ──────────────────────────────────────────────────────────────
interface CardProps {
  article:  AdminNewsArticle;
  onPin:    () => void;
  onHide:   () => void;
}

const AdminNewsCard: React.FC<CardProps> = ({ article, onPin, onHide }) => {
  const catColor = CATEGORY_COLORS[article.category] ?? C.forest;
  const catLabel = CATEGORY_LABELS[article.category] ?? article.category;

  return (
    <View style={ns.card}>
      {/* Coloured thumbnail */}
      <View style={[ns.thumb, { backgroundColor: catColor }]}>
        <View style={ns.thumbDim} />
        <View style={ns.thumbContent}>
          <Text style={ns.thumbCategory}>{catLabel.toUpperCase()}</Text>
          {!!article.related_accreditation && (
            <View style={ns.accredBadge}>
              <Text style={ns.accredBadgeText}>{article.related_accreditation}</Text>
            </View>
          )}
        </View>
        {/* Pin icon overlay */}
        <TouchableOpacity style={ns.pinOverlay} onPress={onPin} activeOpacity={0.8}>
          <Text style={[ns.pinIcon, article.isPinned && { color: C.amber }]}>
            {article.isPinned ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={ns.body}>
        {/* Top row: category badge + date */}
        <View style={ns.topRow}>
          <View style={[ns.catBadge, { backgroundColor: catColor + '18' }]}>
            <Text style={[ns.catBadgeText, { color: catColor }]}>{catLabel}</Text>
          </View>
          <Text style={ns.date}>{fmtDate(article.published_at)}</Text>
        </View>

        {/* Title */}
        <Text style={ns.title} numberOfLines={3}>{article.title}</Text>

        {/* Description */}
        <Text style={ns.desc} numberOfLines={3}>{article.description}</Text>

        {/* Source */}
        <Text style={ns.source}>{article.source_name}</Text>

        {/* Actions */}
        <View style={ns.actionRow}>
          <TouchableOpacity
            style={[ns.readBtn, { backgroundColor: C.forest }]}
            onPress={() => openArticle(article.article_url)}
            activeOpacity={0.85}
          >
            <Text style={ns.readBtnText}>Read more →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ns.hideBtn} onPress={onHide} activeOpacity={0.7}>
            <Text style={ns.hideBtnText}>Not relevant</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const ns = StyleSheet.create({
  card:         { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  thumb:        { height: 110, justifyContent: 'flex-end', padding: 12, position: 'relative' },
  thumbDim:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  thumbContent: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  thumbCategory:{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.2 },
  accredBadge:  { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  accredBadgeText:{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  pinOverlay:   { position: 'absolute', top: 10, right: 12 },
  pinIcon:      { fontSize: 22, color: 'rgba(255,255,255,0.7)' },

  body:     { padding: 14, gap: 8 },
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  date:     { fontSize: 11, color: C.inkSoft },
  title:    { fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 21 },
  desc:     { fontSize: 13, color: C.inkMid, lineHeight: 19 },
  source:   { fontSize: 11, color: C.inkSoft, fontStyle: 'italic' },

  actionRow:   { flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' },
  readBtn:     { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  readBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  hideBtn:     { borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.mist },
  hideBtnText: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
});

// ── Main screen ───────────────────────────────────────────────────────────────
const ALL_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: '',                  label: 'All' },
  { key: 'accreditation',    label: 'Accreditation' },
  { key: 'AACSB',            label: 'AACSB' },
  { key: 'EQUIS',            label: 'EQUIS' },
  { key: 'AMBA',             label: 'AMBA' },
  { key: 'business-schools', label: 'Business Schools' },
  { key: 'universities',     label: 'Universities' },
  { key: 'ai-education',     label: 'AI in Education' },
  { key: 'business-events',  label: 'Business Events' },
  { key: 'global-education', label: 'Global Education' },
];

const SORT_OPTIONS: Array<{ key: SortMode; label: string }> = [
  { key: 'relevant', label: 'Most Relevant' },
  { key: 'recent',   label: 'Most Recent' },
  { key: 'pinned',   label: 'Pinned First' },
];

const AdminNewsScreen: React.FC<Props> = ({ profile }) => {
  const { settings: instSettings } = useInstitution();
  const accreditation = instSettings?.accreditation ?? 'AACSB';

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [articles,   setArticles]   = useState<AdminNewsArticle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [sort,       setSort]       = useState<SortMode>('relevant');
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Load (auto-refresh on focus) ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminNewsFeed(profile.id, accreditation);
      setArticles(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load news.');
    } finally {
      setLoading(false);
    }
  }, [profile.id, accreditation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Pin handler ───────────────────────────────────────────────────────────
  const handlePin = async (article: AdminNewsArticle) => {
    const next = await togglePinAdminArticle(profile.id, article);
    setArticles(prev => prev.map(a =>
      a.id === article.id ? { ...a, isPinned: next } : a,
    ));
  };

  // ── Hide handler ──────────────────────────────────────────────────────────
  const handleHide = async (article: AdminNewsArticle) => {
    await hideAdminArticle(profile.id, article.article_url);
    setArticles(prev => prev.filter(a => a.id !== article.id));
  };

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...articles];

    // Category filter
    if (category) {
      if (category === 'AACSB' || category === 'EQUIS' || category === 'AMBA') {
        list = list.filter(a => a.related_accreditation === category || a.tags?.includes(category.toLowerCase()));
      } else {
        list = list.filter(a => a.category === category);
      }
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.source_name?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.includes(q)),
      );
    }

    // Sort (pre-sort before diversity pass)
    if (sort === 'recent') {
      list = list.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    } else if (sort === 'pinned') {
      list = list.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.relevance_score - a.relevance_score);
    } else {
      list = list.sort((a, b) => b.relevance_score - a.relevance_score);
    }

    // Diversity filter — max 7 articles, no near-duplicate topics
    return getDiverseTopNews(list, 7);
  }, [articles, category, search, sort]);

  const hasFilters = !!category || !!search.trim();
  const pinnedCount = articles.filter(a => a.isPinned).length;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centre}>
        <ActivityIndicator size="large" color={C.forest} />
        <Text style={s.loadingText}>Loading accreditation news…</Text>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={s.centre}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* Header */}
        <Text style={s.pageTitle}>Education & Accreditation News</Text>
        <View style={s.subRow}>
          <Text style={s.pageSub}>Personalised for </Text>
          <View style={[s.accredPill, { backgroundColor: (CATEGORY_COLORS['accreditation'] ?? C.forest) + '18' }]}>
            <Text style={[s.accredPillText, { color: C.forest }]}>{accreditation}</Text>
          </View>
          {pinnedCount > 0 && <Text style={s.pageSub}> · {pinnedCount} pinned</Text>}
        </View>

        {/* Sort tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sortScroll} contentContainerStyle={{ gap: 8 }}>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[s.sortTab, sort === opt.key && s.sortTabActive]}
              onPress={() => setSort(opt.key)}
            >
              <Text style={[s.sortTabText, sort === opt.key && s.sortTabTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search + filter */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            placeholder="Search news…"
            placeholderTextColor={C.inkSoft}
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity
            style={[s.filterBtn, hasFilters && s.filterBtnActive]}
            onPress={() => setFilterOpen(f => !f)}
            activeOpacity={0.7}
          >
            <FunnelIcon active={hasFilters} />
          </TouchableOpacity>
        </View>

        {/* Category chips (shown when filter open) */}
        {filterOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={{ gap: 8 }}>
            {ALL_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[s.chip, category === c.key && s.chipActive]}
                onPress={() => { setCategory(category === c.key ? '' : c.key); }}
              >
                <Text style={[s.chipText, category === c.key && s.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Active category label */}
        {category && (
          <View style={s.activeCatRow}>
            <Text style={s.activeCatLabel}>Filtering: {ALL_CATEGORIES.find(c => c.key === category)?.label ?? category}</Text>
            <TouchableOpacity onPress={() => setCategory('')}>
              <Text style={s.clearCat}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state */}
        {displayed.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📰</Text>
            <Text style={s.emptyTitle}>
              {hasFilters ? 'No articles match your filters' : 'No recent articles available right now'}
            </Text>
            <Text style={s.emptySub}>
              {hasFilters
                ? 'Try adjusting your filters or search terms.'
                : 'Check back soon — new articles will appear here automatically.'}
            </Text>
          </View>
        )}

        {/* Articles — 2-col on wide, 1-col on narrow */}
        {isWide ? (
          <View style={s.grid}>
            {displayed.map(a => (
              <View key={a.id} style={s.gridItem}>
                <AdminNewsCard article={a} onPin={() => handlePin(a)} onHide={() => handleHide(a)} />
              </View>
            ))}
          </View>
        ) : (
          displayed.map(a => (
            <AdminNewsCard key={a.id} article={a} onPin={() => handlePin(a)} onHide={() => handleHide(a)} />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  content:     { padding: 16, paddingBottom: 48 },
  centre:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 13, color: C.inkMid },
  errorIcon:   { fontSize: 36, marginBottom: 10 },
  errorText:   { fontSize: 13, color: C.inkMid, textAlign: 'center', marginBottom: 16 },
  retryBtn:    { backgroundColor: C.forest, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  pageTitle: { fontSize: 22, fontWeight: '800', color: C.forest, marginBottom: 4 },
  subRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 4 },
  pageSub:   { fontSize: 13, color: C.inkMid },
  accredPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  accredPillText: { fontSize: 12, fontWeight: '700' },

  sortScroll: { marginBottom: 12 },
  sortTab:    { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card },
  sortTabActive: { backgroundColor: C.forest, borderColor: C.forest },
  sortTabText:   { fontSize: 12, color: C.inkMid, fontWeight: '600' },
  sortTabTextActive: { color: '#fff' },

  searchRow:  { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  searchInput: {
    flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink,
  },
  filterBtn: { width: 44, height: 44, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  filterBtnActive: { backgroundColor: C.green50, borderColor: C.leaf },

  chipScroll: { marginBottom: 10 },
  chip:         { borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.card },
  chipActive:   { backgroundColor: C.forest, borderColor: C.forest },
  chipText:     { fontSize: 12, color: C.inkMid, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  activeCatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activeCatLabel: { fontSize: 12, color: C.inkMid, fontWeight: '600' },
  clearCat:       { fontSize: 12, color: C.leaf, fontWeight: '700' },

  empty:      { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 20 },
  emptyIcon:  { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 19 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '48%' },
});

export default AdminNewsScreen;
