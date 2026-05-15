import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { getAdminNews } from '../../services/supabase';
import { AdminNewsItem } from '../../types';

const C = {
  green50:  '#f0f6ef',
  green100: '#e2efe5',
  green600: '#2a8a4d',
  green700: '#1d6e3a',
  text:     '#1a2418',
  muted:    '#6b7264',
  soft:     '#8e948a',
  border:   '#e4ebe2',
  red:      '#d94343',
  amber:    '#d99a1f',
  blue:     '#3b6fd1',
  purple:   '#7a5acc',
  card:     '#ffffff',
  bg:       '#f5f9f3',
};

const THUMB_GRADIENTS = [
  ['#2a8a4d', '#0f4a26'],
  ['#3b6fd1', '#1a3a7a'],
  ['#d99a1f', '#a06a0e'],
  ['#7a5acc', '#3e2080'],
];

const CATEGORIES = ['Policy', 'Academic', 'Finance', 'Administrative'];

interface NewsCardProps { item: AdminNewsItem; }

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const [topColor, bottomColor] = THUMB_GRADIENTS[item.thumb_index % THUMB_GRADIENTS.length];
  const category = item.category ?? CATEGORIES[item.thumb_index % CATEGORIES.length];
  return (
    <View style={ns.card}>
      {/* Thumbnail */}
      <View style={[ns.thumb, { backgroundColor: topColor }]}>
        <View style={[ns.thumbOverlay, { backgroundColor: bottomColor + 'aa' }]} />
        <Text style={ns.thumbText}>{category.toUpperCase()}</Text>
      </View>
      {/* Body */}
      <View style={ns.body}>
        <View style={ns.topRow}>
          <View style={[ns.categoryBadge, { backgroundColor: topColor + '20' }]}>
            <Text style={[ns.categoryText, { color: topColor }]}>{category}</Text>
          </View>
          {item.is_new && (
            <View style={ns.newPill}>
              <Text style={ns.newPillText}>NEW</Text>
            </View>
          )}
        </View>
        <Text style={ns.title}>{item.title}</Text>
        <Text style={ns.date}>{item.date}</Text>
      </View>
    </View>
  );
};

const ns = StyleSheet.create({
  card:          { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 14 },
  thumb:         { height: 100, justifyContent: 'flex-end', padding: 12 },
  thumbOverlay:  { ...StyleSheet.absoluteFillObject },
  thumbText:     { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2 },
  body:          { padding: 14, gap: 6 },
  topRow:        { flexDirection: 'row', gap: 8, alignItems: 'center' },
  categoryBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText:  { fontSize: 11, fontWeight: '700' },
  newPill:       { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  newPillText:   { fontSize: 10, fontWeight: '800', color: '#fff' },
  title:         { fontSize: 14, fontWeight: '700', color: C.text },
  date:          { fontSize: 11, color: C.soft },
});

const AdminNewsScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [news, setNews]       = useState<AdminNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminNews()
      .then(setNews)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>News &amp; Updates</Text>
      <Text style={s.pageSub}>Latest institutional news and policy updates</Text>

      {loading ? (
        <ActivityIndicator size="large" color={C.green600} style={{ marginVertical: 30 }} />
      ) : news.length === 0 ? (
        <Text style={s.empty}>No news items found.</Text>
      ) : isWide ? (
        // 2-column grid on wide screens
        <View style={s.grid}>
          {news.map(item => (
            <View key={item.id} style={s.gridItem}>
              <NewsCard item={item} />
            </View>
          ))}
        </View>
      ) : (
        news.map(item => <NewsCard key={item.id} item={item} />)
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  pageSub:   { fontSize: 13, color: C.muted, marginBottom: 20 },
  empty:     { fontSize: 13, color: C.muted, textAlign: 'center', marginVertical: 30 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  gridItem:  { width: '48%' },
});

export default AdminNewsScreen;
