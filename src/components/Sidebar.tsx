import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Polyline, Line, Circle, Polygon } from 'react-native-svg';
import { Colors, Green, Ink, Spacing } from '../theme';

const ICON_COLOR = '#b6d4c2';
const ICON_SIZE  = 17;

const IcoHome = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M9 21V12h6v9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoBook = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoFolder = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoPencil = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoUsers = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoWarning = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="12" y1="17" x2="12.01" y2="17" stroke={color} strokeWidth={2.5} strokeLinecap="round"/>
  </Svg>
);

const IcoNewspaper = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 22h14a2 2 0 002-2V7.5L14.5 2H6a2 2 0 00-2 2v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Polyline points="14 2 14 8 20 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M2 15h10M2 11h10M2 19h6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

const IcoCalendar = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
    <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

const IcoUser = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoSettings = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const IcoLogout = ({ color = ICON_COLOR, size = ICON_SIZE }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
    <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth={1.8} strokeLinecap="round"/>
  </Svg>
);

// Brand mark — 5-bar high-five glyph
const BrandMark = () => (
  <View style={s.brandMark}>
    <LinearGradient
      colors={['#46c98e', '#2aa274', '#1f7a52']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="3"    y="9" width="2.6" height="11" rx="1.3" fill="#0a1f17"/>
      <Rect x="6.8"  y="6" width="2.6" height="14" rx="1.3" fill="#0a1f17"/>
      <Rect x="10.7" y="3" width="2.6" height="17" rx="1.3" fill="#0a1f17"/>
      <Rect x="14.6" y="6" width="2.6" height="14" rx="1.3" fill="#0a1f17"/>
      <Rect x="18.4" y="9" width="2.6" height="11" rx="1.3" fill="#0a1f17"/>
    </Svg>
  </View>
);

type NavItem = { label: string; screen: string; Icon: React.FC<{ color?: string; size?: number }> };

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',                 screen: 'Home',              Icon: IcoHome      },
  { label: 'Course Overview',      screen: 'Courses',           Icon: IcoBook      },
  // 'Student List' is intentionally hidden from the professor sidebar.
  // The route, screen (StudentListScreen) and data connection are preserved
  // and still registered in MainNavigator — only the menu item is hidden.
  // Professors reach students via Courses → Course → Student profile.
  // { label: 'Student List',         screen: 'StudentList',       Icon: IcoUsers     },
  { label: 'Course Management',    screen: 'CourseManagement',  Icon: IcoFolder    },
  { label: 'Homework Assistance',  screen: 'HomeworkAssistance',Icon: IcoPencil    },
  { label: 'Warnings',             screen: 'Warnings',          Icon: IcoWarning   },
  { label: 'News',                 screen: 'News',              Icon: IcoNewspaper },
  { label: 'Calendar',             screen: 'Calendar',          Icon: IcoCalendar  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { label: 'Profile',  screen: 'Profile',  Icon: IcoUser     },
  { label: 'Settings', screen: 'Settings', Icon: IcoSettings },
];

interface Props extends DrawerContentComponentProps {
  onLogout: () => void;
}

const Sidebar: React.FC<Props> = ({ navigation, state, onLogout }) => {
  const activeRoute = state.routes[state.index]?.name;

  const NavRow = ({ item }: { item: NavItem }) => {
    const isActive = activeRoute === item.screen;
    const iconColor = isActive ? '#ffffff' : ICON_COLOR;
    return (
      <TouchableOpacity
        style={[s.navItem, isActive && s.navItemActive]}
        onPress={() => navigation.navigate(item.screen)}
        activeOpacity={0.7}
      >
        {isActive && (
          <LinearGradient
            colors={['rgba(70,201,142,0.18)', 'rgba(70,201,142,0.04)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 11 }]}
          />
        )}
        <View style={s.navIcon}><item.Icon color={iconColor} size={ICON_SIZE} /></View>
        <Text style={[s.navLabel, isActive && s.navLabelActive]}>{item.label}</Text>
        {isActive && <View style={s.activeBar} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.wrap}>
      {/* Brand */}
      <View style={s.brand}>
        <BrandMark />
        <View style={{ marginLeft: 10 }}>
          <Text style={s.brandName}>HIGH FIVE</Text>
          <Text style={s.brandSub}>Professor Panel</Text>
        </View>
      </View>

      <Text style={s.groupLabel}>WORKSPACE</Text>

      <DrawerContentScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.navList}
        showsVerticalScrollIndicator={false}
      >
        {NAV_ITEMS.map(item => <NavRow key={item.screen} item={item} />)}
      </DrawerContentScrollView>

      <View style={s.bottom}>
        <View style={s.divider} />
        {BOTTOM_ITEMS.map(item => <NavRow key={item.screen} item={item} />)}
        <TouchableOpacity style={s.navItem} onPress={onLogout} activeOpacity={0.7}>
          <View style={s.navIcon}><IcoLogout color={ICON_COLOR} size={ICON_SIZE} /></View>
          <Text style={[s.navLabel, s.logoutLabel]}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Green[900],
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 14,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'Montserrat-ExtraBold',
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 1.44,
    textTransform: 'uppercase',
  },
  brandSub: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 10.5,
    color: Green[300],
    letterSpacing: 1.47,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  groupLabel: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10.5,
    color: '#5b8a72',
    letterSpacing: 1.47,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  navList: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    marginBottom: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  navItemActive: {
    borderWidth: 1,
    borderColor: 'rgba(70,201,142,0.25)',
  },
  navIcon: {
    width: 22,
    alignItems: 'center',
  },
  navLabel: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 13.5,
    color: '#b6d4c2',
    marginLeft: 10,
    flex: 1,
  },
  navLabelActive: {
    color: '#ffffff',
    fontFamily: 'Montserrat-SemiBold',
  },
  activeBar: {
    position: 'absolute',
    left: -8,
    top: '20%',
    width: 3,
    height: '60%',
    backgroundColor: Green[400],
    borderRadius: 2,
  },
  bottom: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 10,
  },
  logoutLabel: {
    color: 'rgba(182,212,194,0.6)',
  },
});

export default Sidebar;
