import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Course, Profile } from '../../../types';
import { CourseSyllabus, SchemeOfWork } from '../../../types/courseManagement';
import SyllabusCheckTab from './SyllabusCheckTab';
import SchemeOfWorkCheckTab from './SchemeOfWorkCheckTab';

const C = {
  forest: '#1A5C38', mist: '#F2FAF5',
  ink: '#1A1A1A', inkMid: 'rgba(26,26,26,0.65)',
  border: '#E0EDE6', card: '#FFFFFF',
};

const SUB_TABS = [
  { key: 'syllabus',        label: 'Syllabus',        icon: '📋' },
  { key: 'scheme_of_work',  label: 'Scheme of Work',  icon: '📅' },
] as const;

type SubTabKey = typeof SUB_TABS[number]['key'];

interface Props {
  course: Course;
  profile: Profile;
  syllabus: CourseSyllabus | null;
  onSyllabusChange: (s: CourseSyllabus | null) => void;
}

const GuidelinesCheckTab: React.FC<Props> = ({ course, profile, syllabus, onSyllabusChange }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('syllabus');
  const [schemeOfWork, setSchemeOfWork] = useState<SchemeOfWork | null>(null);

  return (
    <View style={s.root}>
      {/* Sub-tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.subTabBar}
        contentContainerStyle={s.subTabBarContent}
      >
        {SUB_TABS.map(tab => {
          const isActive = activeSubTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.subTab, isActive && s.subTabActive]}
              onPress={() => setActiveSubTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={s.subTabIcon}>{tab.icon}</Text>
              <Text style={[s.subTabLabel, isActive && s.subTabLabelActive]}>{tab.label}</Text>
              {isActive && <View style={s.subTabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sub-tab content */}
      <View style={s.content}>
        {activeSubTab === 'syllabus' && (
          <SyllabusCheckTab
            course={course}
            profile={profile}
            syllabus={syllabus}
            onSyllabusChange={onSyllabusChange}
          />
        )}
        {activeSubTab === 'scheme_of_work' && (
          <SchemeOfWorkCheckTab
            course={course}
            profile={profile}
            schemeOfWork={schemeOfWork}
            onSchemeOfWorkChange={setSchemeOfWork}
          />
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.mist },
  subTabBar:         { backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, maxHeight: 46 },
  subTabBarContent:  { paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  subTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 12, position: 'relative',
  },
  subTabActive:       {},
  subTabIcon:         { fontSize: 13 },
  subTabLabel:        { fontSize: 12, color: C.inkMid, fontWeight: '500' },
  subTabLabelActive:  { color: C.forest, fontWeight: '700' },
  subTabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, backgroundColor: C.forest, borderRadius: 1,
  },
  content: { flex: 1 },
});

export default GuidelinesCheckTab;
