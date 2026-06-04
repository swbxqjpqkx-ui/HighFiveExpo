import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Profile } from '../../types';
import { useInstitution } from '../../context/InstitutionContext';
import PendingApprovalsTab from './tabs/PendingApprovalsTab';
import AdminOverlapTab from './tabs/AdminOverlapTab';
import AdminNotificationsTab from './tabs/AdminNotificationsTab';
import { Green, Ink, Tint } from '../../theme';

const C = {
  forest: Green[700], leaf: Green[500], mist: Green[50],
  ink: Ink.base, inkMid: Ink[3],
  border: Ink.line, card: Ink.surface,
  amber: Tint.sun.ink,
};

const TABS = [
  { key: 'approvals',      label: 'Pending Approvals', icon: '📋' },
  { key: 'overlaps',       label: 'Overlap Review',    icon: '⚡' },
  { key: 'notifications',  label: 'Notifications',     icon: '🔔' },
] as const;

type TabKey = typeof TABS[number]['key'];

interface Props {
  profile: Profile;
  // Bumped when an overlap notification is opened → jump to the Overlap Review tab.
  overlapFocusNonce?: number;
}

const AdminAccreditationScreen: React.FC<Props> = ({ profile, overlapFocusNonce }) => {
  const [tab, setTab] = useState<TabKey>('approvals');
  const { settings } = useInstitution();

  // Open the Overlap Review tab when arriving from an overlap notification.
  useEffect(() => {
    if (overlapFocusNonce !== undefined) setTab('overlaps');
  }, [overlapFocusNonce]);

  return (
    <View style={s.root}>
      {/* Page header */}
      <View style={s.pageHeader}>
        <View>
          <Text style={s.pageTitle}>Material Management</Text>
          <Text style={s.pageSub}>
            {settings?.accreditation ?? 'AACSB'} framework
            {settings?.name ? ` · ${settings.name}` : ''}
          </Text>
        </View>
        <View style={s.frameworkBadge}>
          <Text style={s.frameworkBadgeTxt}>
            {settings?.accreditation ?? 'AACSB'}
          </Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBar}
        contentContainerStyle={s.tabBarContent}
      >
        {TABS.map(t => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={s.tabIcon}>{t.icon}</Text>
              <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{t.label}</Text>
              {isActive && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <View style={s.content}>
        {tab === 'approvals'     && <PendingApprovalsTab profile={profile} />}
        {tab === 'overlaps'      && <AdminOverlapTab profile={profile} />}
        {tab === 'notifications' && <AdminNotificationsTab profile={profile} />}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.mist },
  pageHeader:        {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pageTitle:         { fontSize: 18, fontWeight: '800', color: C.forest },
  pageSub:           { fontSize: 12, color: C.inkMid, marginTop: 2 },
  frameworkBadge:    {
    backgroundColor: C.forest + '15', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.forest + '30',
  },
  frameworkBadgeTxt: { fontSize: 13, fontWeight: '800', color: C.forest },
  tabBar:            { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 50 },
  tabBarContent:     { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  tab:               { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 14, position: 'relative' },
  tabActive:         {},
  tabIcon:           { fontSize: 14 },
  tabLabel:          { fontSize: 13, color: C.inkMid, fontWeight: '500' },
  tabLabelActive:    { color: C.forest, fontWeight: '700' },
  tabUnderline:      { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: C.forest, borderRadius: 1 },
  content:           { flex: 1 },
});

export default AdminAccreditationScreen;
