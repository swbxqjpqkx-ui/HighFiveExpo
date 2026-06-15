import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Switch, TextInput,
  TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getOpenDayStats } from '../../services/supabase';
import {
  fetchOpenDayItems, insertOpenDayItem, updateOpenDayItem, deleteOpenDayItem,
  fetchAmbassadors, insertAmbassador, updateAmbassador, deleteAmbassador,
} from '../../services/openDayService';
import { OpenDayStat, OpenDayItem, OpenDayAmbassador, Profile } from '../../types';

import { Green, Ink, Tint } from '../../theme';

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  forest: Green[700], leaf: Green[500], mist: Green[50],
  ink: Ink.base, inkMid: Ink[3], inkSoft: Ink[4],
  border: Ink.line, card: Ink.surface,
  red: Tint.rose.ink,    redBg:    Tint.rose.bg,
  amber: Tint.sun.ink,   amberBg:  Tint.sun.bg,
  blue: Tint.sky.ink,    blueBg:   Tint.sky.bg,
  purple: Tint.violet.ink, purpleBg: Tint.violet.bg,
  green: Tint.mint.ink,  greenBg:  Tint.mint.bg,    greenBdr: Tint.mint.line,
};

// ── Mock data ──────────────────────────────────────────────────────────────────
const MOCK_REGISTRATIONS = [
  { id: 'r1', name: 'Emma Schneider', email: 'emma.s@gmail.com',  country: 'Switzerland', registered_at: '2026-05-10' },
  { id: 'r2', name: 'Luca Bianchi',   email: 'luca.b@email.it',  country: 'Italy',       registered_at: '2026-05-09' },
  { id: 'r3', name: 'Sophie Martin',  email: 'sophie.m@free.fr', country: 'France',      registered_at: '2026-05-09' },
  { id: 'r4', name: 'Kai Müller',     email: 'kai.m@web.de',     country: 'Germany',     registered_at: '2026-05-08' },
  { id: 'r5', name: 'Ana Costa',      email: 'ana.c@sapo.pt',    country: 'Portugal',    registered_at: '2026-05-08' },
];

const COUNTRY_STATS = [
  { country: 'Switzerland', count: 78 },
  { country: 'Germany',     count: 52 },
  { country: 'France',      count: 44 },
  { country: 'Italy',       count: 37 },
  { country: 'Portugal',    count: 29 },
  { country: 'Spain',       count: 25 },
  { country: 'Austria',     count: 22 },
  { country: 'Other',       count: 25 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const AMB_COLORS = [C.leaf, C.blue, C.purple, C.amber, C.red, '#0369A1', '#7C3AED'];
const ambColor   = (name: string) => AMB_COLORS[name.charCodeAt(0) % AMB_COLORS.length];
const ambInitials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Form types ─────────────────────────────────────────────────────────────────
type ProgramForm = { title: string; desc: string; icon: string; visible: boolean; order: string };
const BLANK_PROG: ProgramForm = { title: '', desc: '', icon: '🎟️', visible: true, order: '' };

type AmbForm = {
  full_name: string; country: string; program: string; email: string;
  phone: string; role: string; photo_url: string; is_active: boolean;
};
const BLANK_AMB: AmbForm = {
  full_name: '', country: '', program: '', email: '',
  phone: '', role: 'Student Ambassador', photo_url: '', is_active: true,
};

// ── Open Day event types ─────────────────────────────────────────────────────────
// The fixed list of event types, plus a final "Other / Custom" option that reveals
// a free-text input. The emoji is stored on the existing icon_name column.
const CUSTOM_TYPE = 'Other / Custom';
const EVENT_TYPES: { emoji: string; label: string }[] = [
  { emoji: '🏫',   label: 'Campus Tour' },
  { emoji: '🎓',   label: 'Program Presentations' },
  { emoji: '👩‍🏫', label: 'Meet the Professors' },
  { emoji: '💬',   label: 'Student Life Panel' },
  { emoji: '📋',   label: 'Admissions Desk' },
  { emoji: '🍽️',   label: 'Networking Lunch' },
  { emoji: '➕',   label: CUSTOM_TYPE },
];

type EventForm = {
  emoji: string; type: string; custom: string; title: string;
  date: string; start: string; end: string; location: string;
  host: string; capacity: string; details: string;
};
const BLANK_EVENT: EventForm = {
  emoji: '', type: '', custom: '', title: '',
  date: '', start: '', end: '', location: '',
  host: '', capacity: '', details: '',
};

// Event details are stored as a small JSON envelope inside the existing
// open_day_items.description column (no schema change). Plain-text descriptions
// from older program items are left untouched and simply decode to null.
const EVENT_TAG = '__hf_event';
type EventMeta = {
  type: string; date: string; start: string; end: string;
  location: string; host: string; capacity: string; details: string;
};
const encodeEvent = (meta: EventMeta): string =>
  JSON.stringify({ [EVENT_TAG]: true, v: 1, ...meta });
const decodeEvent = (description?: string | null): EventMeta | null => {
  if (!description) return null;
  const t = description.trim();
  if (!t.startsWith('{')) return null;
  try {
    const obj = JSON.parse(t);
    if (obj && obj[EVENT_TAG]) {
      return {
        type: obj.type ?? '', date: obj.date ?? '', start: obj.start ?? '',
        end: obj.end ?? '', location: obj.location ?? '', host: obj.host ?? '',
        capacity: obj.capacity ?? '', details: obj.details ?? '',
      };
    }
  } catch { /* not an event envelope — treat as plain text */ }
  return null;
};

// Default sample items seeded by the Open Day migration. These are hidden from the
// admin page so it shows ONLY admin-created events. They are NOT deleted from
// Supabase (no DB change) — only filtered out client-side on load.
const DEFAULT_SEED_ITEMS: { title: string; description: string }[] = [
  { title: 'Campus Tour',           description: 'Guided walk through our campus facilities and student spaces.' },
  { title: 'Program Presentations', description: 'Overview of BBA, MBA, and DBA programs by department heads.' },
  { title: 'Meet the Professors',   description: 'Q&A sessions with faculty members across all programs.' },
  { title: 'Student Life Panel',    description: 'Current students share their experience and answer questions.' },
  { title: 'Admissions Desk',       description: 'One-on-one meetings with admissions officers.' },
  { title: 'Networking Lunch',      description: 'Join students, faculty, and staff for an informal lunch.' },
];
const isDefaultSeedItem = (item: OpenDayItem): boolean =>
  DEFAULT_SEED_ITEMS.some(d =>
    d.title === (item.title ?? '').trim() &&
    d.description === (item.description ?? '').trim());

// ── Component ──────────────────────────────────────────────────────────────────
interface Props { profile: Profile; }

const AdminOpenDayScreen: React.FC<Props> = ({ profile }) => {
  const isAdmin = profile.role === 'administrator';

  // ── Event stats ───────────────────────────────────────────────────
  const [stat, setStat]               = useState<OpenDayStat | null>(null);
  const [statLoading, setStatLoading] = useState(true);
  const [regOpen, setRegOpen]         = useState(true);
  const [eventDate, setEventDate]     = useState('2026-05-24');
  const [capacityMax, setCapacityMax] = useState('400');

  // ── Program items ─────────────────────────────────────────────────
  const [items, setItems]               = useState<OpenDayItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [editMode, setEditMode]         = useState(false);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [form, setForm]                 = useState<ProgramForm>(BLANK_PROG);
  const [saving, setSaving]             = useState(false);
  const [saveBanner, setSaveBanner]     = useState(false);

  // ── Ambassadors ───────────────────────────────────────────────────
  const [ambassadors, setAmbassadors]   = useState<OpenDayAmbassador[]>([]);
  const [ambLoading, setAmbLoading]     = useState(true);
  const [ambError, setAmbError]         = useState<string | null>(null);
  const [ambEditMode, setAmbEditMode]   = useState(false);
  const [ambModalOpen, setAmbModalOpen] = useState(false);
  const [ambEditingId, setAmbEditingId] = useState<string | null>(null);
  const [ambForm, setAmbForm]           = useState<AmbForm>(BLANK_AMB);
  const [ambSaving, setAmbSaving]       = useState(false);

  // ── Open Day events (stored in the same open_day_items table) ─────
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventEditingId, setEventEditingId] = useState<string | null>(null);
  const [eventForm, setEventForm]           = useState<EventForm>(BLANK_EVENT);
  const [eventSaving, setEventSaving]       = useState(false);

  // ── Load: event stats ─────────────────────────────────────────────
  useEffect(() => {
    getOpenDayStats()
      .then(setStat)
      .catch(() => {})
      .finally(() => setStatLoading(false));
  }, []);

  // ── Load: program items ───────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const all = await fetchOpenDayItems();
      setItems(all.filter(i => !isDefaultSeedItem(i)));
    }
    catch {}
    finally { setItemsLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── Load: ambassadors ─────────────────────────────────────────────
  const loadAmbassadors = useCallback(async () => {
    setAmbLoading(true);
    setAmbError(null);
    try { setAmbassadors(await fetchAmbassadors()); }
    catch (e: any) { setAmbError(e.message ?? 'Could not load ambassadors.'); }
    finally { setAmbLoading(false); }
  }, []);

  useEffect(() => { loadAmbassadors(); }, [loadAmbassadors]);

  // ── Program item handlers ─────────────────────────────────────────
  const openAddItem = () => {
    setEditingId(null);
    setForm({ ...BLANK_PROG, order: String(items.length + 1) });
    setModalOpen(true);
  };

  const openEditItem = (item: OpenDayItem) => {
    setEditingId(item.id);
    setForm({
      title:   item.title,
      desc:    item.description ?? '',
      icon:    item.icon_name ?? '🎟️',
      visible: item.is_visible ?? true,
      order:   String(item.display_order ?? 0),
    });
    setModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Title cannot be empty.'); return; }
    setSaving(true);
    try {
      const patch = {
        title:         form.title.trim(),
        description:   form.desc.trim() || null,
        icon_name:     form.icon.trim() || '🎟️',
        is_visible:    form.visible,
        display_order: parseInt(form.order) || 0,
      };
      if (editingId) {
        const updated = await updateOpenDayItem(editingId, patch);
        setItems(prev => prev.map(i => i.id === editingId ? updated : i));
      } else {
        const inserted = await insertOpenDayItem(patch);
        setItems(prev =>
          [...prev, inserted].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        );
      }
      setModalOpen(false);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 3000);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (item: OpenDayItem) => {
    Alert.alert('Delete Item', `Remove "${item.title}" from the Open Day program?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteOpenDayItem(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleToggleVisible = async (item: OpenDayItem) => {
    const newVal = !item.is_visible;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_visible: newVal } : i));
    try { await updateOpenDayItem(item.id, { is_visible: newVal }); }
    catch { setItems(prev => prev.map(i => i.id === item.id ? item : i)); }
  };

  // ── Open Day event handlers ───────────────────────────────────────
  const openAddEvent = () => {
    setEventEditingId(null);
    setEventForm(BLANK_EVENT);
    setEventModalOpen(true);
  };

  const openEditEvent = (item: OpenDayItem) => {
    const ev = decodeEvent(item.description);
    if (!ev) return;
    const known = EVENT_TYPES.find(t => t.label === ev.type && t.label !== CUSTOM_TYPE);
    setEventEditingId(item.id);
    setEventForm({
      emoji:    item.icon_name ?? (known?.emoji ?? '➕'),
      type:     known ? known.label : CUSTOM_TYPE,
      custom:   known ? '' : ev.type,
      title:    item.title,
      date:     ev.date,
      start:    ev.start,
      end:      ev.end,
      location: ev.location,
      host:     ev.host,
      capacity: ev.capacity,
      details:  ev.details,
    });
    setEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    const isCustom  = eventForm.type === CUSTOM_TYPE;
    const typeLabel = (isCustom ? eventForm.custom : eventForm.type).trim();
    if (!eventForm.type)         { Alert.alert('Required', 'Please choose an event type.'); return; }
    if (isCustom && !typeLabel)  { Alert.alert('Required', 'Please enter a name for your custom event type.'); return; }
    if (!eventForm.title.trim()) { Alert.alert('Required', 'Event title cannot be empty.'); return; }
    setEventSaving(true);
    try {
      const description = encodeEvent({
        type:     typeLabel,
        date:     eventForm.date.trim(),
        start:    eventForm.start.trim(),
        end:      eventForm.end.trim(),
        location: eventForm.location.trim(),
        host:     eventForm.host.trim(),
        capacity: eventForm.capacity.trim(),
        details:  eventForm.details.trim(),
      });
      const patch = {
        title:      eventForm.title.trim(),
        description,
        icon_name:  eventForm.emoji || '➕',
        is_visible: true,
      };
      if (eventEditingId) {
        const updated = await updateOpenDayItem(eventEditingId, patch);
        setItems(prev => prev.map(i => i.id === eventEditingId ? updated : i));
      } else {
        const inserted = await insertOpenDayItem({ ...patch, display_order: items.length + 1 });
        setItems(prev =>
          [...prev, inserted].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        );
      }
      setEventModalOpen(false);
      setSaveBanner(true);
      setTimeout(() => setSaveBanner(false), 3000);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Could not save. Please try again.');
    } finally {
      setEventSaving(false);
    }
  };

  // ── Ambassador handlers ───────────────────────────────────────────
  const openAddAmb = () => {
    setAmbEditingId(null);
    setAmbForm(BLANK_AMB);
    setAmbModalOpen(true);
  };

  const openEditAmb = (amb: OpenDayAmbassador) => {
    setAmbEditingId(amb.id);
    setAmbForm({
      full_name: amb.full_name,
      country:   amb.country,
      program:   amb.program,
      email:     amb.email,
      phone:     amb.phone ?? '',
      role:      amb.role,
      photo_url: amb.photo_url ?? '',
      is_active: amb.is_active,
    });
    setAmbModalOpen(true);
  };

  const handleSaveAmb = async () => {
    if (!ambForm.full_name.trim()) { Alert.alert('Required', 'Full name is required.'); return; }
    if (!ambForm.email.trim())     { Alert.alert('Required', 'Email is required.'); return; }
    setAmbSaving(true);
    try {
      const payload = {
        full_name: ambForm.full_name.trim(),
        country:   ambForm.country.trim(),
        program:   ambForm.program.trim(),
        email:     ambForm.email.trim(),
        phone:     ambForm.phone.trim() || null,
        role:      ambForm.role.trim() || 'Student Ambassador',
        photo_url: ambForm.photo_url.trim() || null,
        is_active: ambForm.is_active,
      };
      if (ambEditingId) {
        const updated = await updateAmbassador(ambEditingId, payload);
        setAmbassadors(prev => prev.map(a => a.id === ambEditingId ? updated : a));
      } else {
        const inserted = await insertAmbassador(payload);
        setAmbassadors(prev => [...prev, inserted].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      }
      setAmbModalOpen(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message ?? 'Could not save ambassador.');
    } finally {
      setAmbSaving(false);
    }
  };

  const handleDeleteAmb = (amb: OpenDayAmbassador) => {
    Alert.alert(
      'Remove Ambassador',
      `Are you sure you want to remove ${amb.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await deleteAmbassador(amb.id);
              setAmbassadors(prev => prev.filter(a => a.id !== amb.id));
            } catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  // ── Derived ───────────────────────────────────────────────────────
  const capPct  = stat
    ? Math.round((stat.capacity / (parseInt(capacityMax) || stat.capacity_max)) * 100)
    : 0;
  const maxReg = Math.max(...COUNTRY_STATS.map(c => c.count));

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.pageTitle}>Open Day</Text>
            <Text style={s.pageSub}>
              Next: May 24, 2026 · in {stat?.days_until ?? 10} days
            </Text>
          </View>
          <View style={s.headerRight}>
            {isAdmin && (
              <TouchableOpacity
                style={[s.editModeBtn, editMode && s.editModeBtnActive]}
                onPress={() => setEditMode(e => !e)}
              >
                <Text style={[s.editModeBtnTxt, editMode && s.editModeBtnTxtActive]}>
                  {editMode ? '✓ Done' : '✏ Edit Program'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={s.datePill}>
              <Text style={s.datePillText}>📅 May 24, 2026</Text>
            </View>
          </View>
        </View>

        {/* ── Save banner ──────────────────────────────────────────── */}
        {saveBanner && (
          <View style={s.banner}>
            <Text style={s.bannerTxt}>✓ Changes saved successfully</Text>
          </View>
        )}

        {/* ── Stats row ────────────────────────────────────────────── */}
        {statLoading ? (
          <ActivityIndicator size="large" color={C.leaf} style={{ marginVertical: 30 }} />
        ) : (
          <View style={s.statsRow}>
            {[
              { label: 'Registrations', value: String(stat?.total_registrations ?? 312), color: C.leaf,   bg: C.mist     },
              { label: 'Countries',     value: String(stat?.countries_count ?? 23),      color: C.blue,   bg: '#eef3fb'  },
              { label: 'Ambassadors',   value: String(ambassadors.filter(a => a.is_active).length || stat?.ambassadors_count || 0), color: C.purple, bg: C.purpleBg },
              { label: 'Capacity',      value: `${stat?.capacity ?? 312}/${stat?.capacity_max ?? 400}`, color: C.amber, bg: C.amberBg },
            ].map(item => (
              <View key={item.label} style={[s.statCard, { backgroundColor: item.bg, borderColor: item.color + '40' }]}>
                <Text style={[s.statVal, { color: item.color }]}>{item.value}</Text>
                <Text style={s.statLbl}>{item.label}</Text>
                {item.label === 'Capacity' && (
                  <View style={s.capBarTrack}>
                    <View style={[s.capBarFill, { width: `${capPct}%` as any }]} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Open Day Program (Supabase-backed) ──────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>Open Day Program</Text>
            <View style={s.headerBtns}>
              {editMode && (
                <TouchableOpacity style={s.addBtn} onPress={openAddItem}>
                  <Text style={s.addBtnTxt}>+ Add Item</Text>
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity style={s.addBtn} onPress={openAddEvent}>
                  <Text style={s.addBtnTxt}>+ Add Event</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {itemsLoading ? (
            <ActivityIndicator color={C.leaf} style={{ marginVertical: 16 }} />
          ) : items.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🎟️</Text>
              <Text style={s.emptyTxt}>
                {isAdmin
                  ? 'No Open Day events saved yet. Click Add Event to create one.'
                  : 'No program items yet.'}
              </Text>
            </View>
          ) : (
            items.map((item, idx) => {
              const ev = decodeEvent(item.description);
              return (
              <View
                key={item.id}
                style={[
                  s.programItem,
                  idx === items.length - 1 && { borderBottomWidth: 0 },
                  !item.is_visible && s.programItemHidden,
                ]}
              >
                <Text style={s.programIcon}>{item.icon_name ?? '🎟️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.programTitle, !item.is_visible && s.programTitleHidden]}>
                    {item.title}
                    {!item.is_visible && <Text style={s.hiddenLabel}> (hidden)</Text>}
                  </Text>
                  {ev ? (
                    <>
                      {!!ev.type && <Text style={s.eventType}>{ev.type}</Text>}
                      {!!(ev.date || ev.start) && (
                        <Text style={s.eventMeta}>
                          {ev.date ? `📅 ${ev.date}` : ''}
                          {ev.start ? `${ev.date ? '    ' : ''}⏰ ${ev.start}${ev.end ? ` – ${ev.end}` : ''}` : ''}
                        </Text>
                      )}
                      {!!ev.location && <Text style={s.eventMeta}>📍 {ev.location}</Text>}
                      {!!(ev.host || ev.capacity) && (
                        <Text style={s.eventMeta}>
                          {ev.host ? `👤 ${ev.host}` : ''}
                          {ev.host && ev.capacity ? '    ' : ''}
                          {ev.capacity ? `👥 ${ev.capacity}` : ''}
                        </Text>
                      )}
                      {!!ev.details && <Text style={s.programDesc}>{ev.details}</Text>}
                    </>
                  ) : (
                    !!item.description && (
                      <Text style={s.programDesc} numberOfLines={2}>{item.description}</Text>
                    )
                  )}
                </View>
                {editMode && (
                  <View style={s.itemActions}>
                    <TouchableOpacity style={s.iconBtn} onPress={() => handleToggleVisible(item)}>
                      <Text style={s.iconBtnTxt}>{item.is_visible ? '👁' : '🙈'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} onPress={() => ev ? openEditEvent(item) : openEditItem(item)}>
                      <Text style={s.iconBtnTxt}>✏</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={() => handleDeleteItem(item)}>
                      <Text style={s.iconBtnTxt}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              );
            })
          )}
        </View>

        {/* ── Event Settings ───────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Event Settings</Text>
          <View style={s.formRow}>
            <Text style={s.formLabel}>Event Date</Text>
            <TextInput
              style={s.formInput}
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.inkSoft}
            />
          </View>
          <View style={s.formRow}>
            <Text style={s.formLabel}>Capacity Max</Text>
            <TextInput
              style={s.formInput}
              value={capacityMax}
              onChangeText={setCapacityMax}
              keyboardType="number-pad"
              placeholderTextColor={C.inkSoft}
            />
          </View>
          <View style={s.formRow}>
            <Text style={s.formLabel}>Registration Open</Text>
            <Switch
              value={regOpen}
              onValueChange={setRegOpen}
              trackColor={{ true: C.leaf, false: '#ccc' }}
              thumbColor="#fff"
            />
          </View>
          <TouchableOpacity style={s.saveBtn}>
            <Text style={s.saveBtnText}>Save Settings</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent Registrations ─────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Recent Registrations</Text>
          <View style={s.tableHeader}>
            <Text style={[s.th, { flex: 2 }]}>Name</Text>
            <Text style={[s.th, { flex: 2 }]}>Email</Text>
            <Text style={[s.th, { flex: 1 }]}>Country</Text>
            <Text style={[s.th, { flex: 1 }]}>Date</Text>
          </View>
          {MOCK_REGISTRATIONS.map((r, i) => (
            <View key={r.id} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
              <Text style={[s.td, { flex: 2, fontWeight: '600' }]}>{r.name}</Text>
              <Text style={[s.td, { flex: 2, color: C.inkMid }]}>{r.email}</Text>
              <Text style={[s.td, { flex: 1 }]}>{r.country}</Text>
              <Text style={[s.td, { flex: 1, color: C.inkSoft }]}>{r.registered_at}</Text>
            </View>
          ))}
        </View>

        {/* ── Ambassadors (Supabase-backed) ────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.sectionTitle}>
                Ambassadors{ambassadors.length > 0 ? ` (${ambassadors.filter(a => a.is_active).length})` : ''}
              </Text>
              {ambassadors.length > 0 && (
                <Text style={s.sectionSub}>
                  {ambassadors.filter(a => !a.is_active).length > 0
                    ? `${ambassadors.filter(a => !a.is_active).length} inactive`
                    : 'All active'}
                </Text>
              )}
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={[s.editModeBtn, ambEditMode && s.editModeBtnActive]}
                onPress={() => setAmbEditMode(e => !e)}
              >
                <Text style={[s.editModeBtnTxt, ambEditMode && s.editModeBtnTxtActive]}>
                  {ambEditMode ? '✓ Done' : '✏ Edit'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {ambEditMode && isAdmin && (
            <TouchableOpacity style={s.addBtn} onPress={openAddAmb}>
              <Text style={s.addBtnTxt}>+ Add Ambassador</Text>
            </TouchableOpacity>
          )}

          {ambLoading ? (
            <ActivityIndicator color={C.leaf} style={{ marginVertical: 20 }} />
          ) : ambError ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>⚠  {ambError}</Text>
              <TouchableOpacity onPress={loadAmbassadors} style={{ marginTop: 8 }}>
                <Text style={{ color: C.leaf, fontSize: 13, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : ambassadors.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🤝</Text>
              <Text style={s.emptyTxt}>No ambassadors added yet.</Text>
              {isAdmin && (
                <TouchableOpacity onPress={() => { setAmbEditMode(true); openAddAmb(); }}>
                  <Text style={s.emptyAction}>Tap "+ Add Ambassador" to get started</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ marginTop: ambEditMode ? 12 : 0 }}>
              {ambassadors.map(amb => (
                <View
                  key={amb.id}
                  style={[s.ambCard, !amb.is_active && s.ambCardInactive]}
                >
                  {/* Avatar */}
                  <View style={[s.ambAvatar, { backgroundColor: ambColor(amb.full_name) }]}>
                    <Text style={s.ambInitials}>{ambInitials(amb.full_name)}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.ambNameRow}>
                      <Text style={s.ambName}>{amb.full_name}</Text>
                      {!amb.is_active && (
                        <View style={s.inactiveBadge}>
                          <Text style={s.inactiveBadgeText}>Inactive</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.ambRole}>{amb.role}</Text>
                    <View style={s.ambTagRow}>
                      {!!amb.country && (
                        <View style={s.ambTag}>
                          <Text style={s.ambTagText}>🌍 {amb.country}</Text>
                        </View>
                      )}
                      {!!amb.program && (
                        <View style={s.ambTag}>
                          <Text style={s.ambTagText}>📚 {amb.program}</Text>
                        </View>
                      )}
                    </View>
                    {!!amb.email && (
                      <Text style={s.ambEmail} numberOfLines={1}>{amb.email}</Text>
                    )}
                  </View>

                  {/* Edit / Delete in edit mode */}
                  {ambEditMode && isAdmin && (
                    <View style={s.itemActions}>
                      <TouchableOpacity style={s.iconBtn} onPress={() => openEditAmb(amb)}>
                        <Text style={s.iconBtnTxt}>✏</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={() => handleDeleteAmb(amb)}>
                        <Text style={s.iconBtnTxt}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Registrations by Country ─────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Registrations by Country</Text>
          {COUNTRY_STATS.map(c => (
            <View key={c.country} style={s.barRow}>
              <Text style={s.barLabel}>{c.country}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(c.count / maxReg) * 100}%` as any }]} />
              </View>
              <Text style={s.barCount}>{c.count}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* ── Program item modal ───────────────────────────────────────── */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={m.root}>
            <View style={m.header}>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={m.cancelBtn}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={m.headerTitle}>{editingId ? 'Edit Item' : 'New Item'}</Text>
              <TouchableOpacity
                style={[m.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveItem}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={m.body}>
              <View style={m.field}>
                <Text style={m.label}>Icon (emoji)</Text>
                <TextInput
                  style={m.emojiInput}
                  value={form.icon}
                  onChangeText={v => setForm(f => ({ ...f, icon: v }))}
                  placeholder="🎟️"
                  placeholderTextColor={C.inkSoft}
                  maxLength={8}
                />
                <Text style={m.hint}>Tap and paste or type an emoji</Text>
              </View>

              <View style={m.field}>
                <Text style={m.label}>Title <Text style={{ color: C.red }}>*</Text></Text>
                <TextInput
                  style={m.input}
                  value={form.title}
                  onChangeText={v => setForm(f => ({ ...f, title: v }))}
                  placeholder="e.g. Campus Tour"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              <View style={m.field}>
                <Text style={m.label}>Description</Text>
                <TextInput
                  style={[m.input, m.inputMulti]}
                  value={form.desc}
                  onChangeText={v => setForm(f => ({ ...f, desc: v }))}
                  placeholder="Short description…"
                  placeholderTextColor={C.inkSoft}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={m.field}>
                <Text style={m.label}>Display Order</Text>
                <TextInput
                  style={[m.input, { width: 100 }]}
                  value={form.order}
                  onChangeText={v => setForm(f => ({ ...f, order: v }))}
                  placeholder="1"
                  keyboardType="number-pad"
                  placeholderTextColor={C.inkSoft}
                />
                <Text style={m.hint}>Lower number appears first</Text>
              </View>

              <View style={m.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Visible to visitors</Text>
                  <Text style={m.hint}>Hidden items are stored but not shown on the Open Day page</Text>
                </View>
                <Switch
                  value={form.visible}
                  onValueChange={v => setForm(f => ({ ...f, visible: v }))}
                  trackColor={{ true: C.leaf, false: '#ccc' }}
                  thumbColor="#fff"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Ambassador modal ─────────────────────────────────────────── */}
      <Modal
        visible={ambModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!ambSaving) setAmbModalOpen(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={m.root}>
            <View style={m.header}>
              <TouchableOpacity
                onPress={() => { if (!ambSaving) setAmbModalOpen(false); }}
                style={m.cancelBtn}
                disabled={ambSaving}
              >
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={m.headerTitle}>
                {ambEditingId ? 'Edit Ambassador' : 'New Ambassador'}
              </Text>
              <TouchableOpacity
                style={[m.saveBtn, ambSaving && { opacity: 0.6 }]}
                onPress={handleSaveAmb}
                disabled={ambSaving}
              >
                {ambSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={m.saveTxt}>Save</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={m.body}>
              {/* Full name */}
              <View style={m.field}>
                <Text style={m.label}>Full Name <Text style={{ color: C.red }}>*</Text></Text>
                <TextInput
                  style={m.input}
                  value={ambForm.full_name}
                  onChangeText={v => setAmbForm(f => ({ ...f, full_name: v }))}
                  placeholder="e.g. Mia Hofmann"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Role */}
              <View style={m.field}>
                <Text style={m.label}>Role</Text>
                <TextInput
                  style={m.input}
                  value={ambForm.role}
                  onChangeText={v => setAmbForm(f => ({ ...f, role: v }))}
                  placeholder="e.g. Student Ambassador"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Country + Program */}
              <View style={m.twoCol}>
                <View style={[m.field, { flex: 1 }]}>
                  <Text style={m.label}>Country</Text>
                  <TextInput
                    style={m.input}
                    value={ambForm.country}
                    onChangeText={v => setAmbForm(f => ({ ...f, country: v }))}
                    placeholder="Switzerland"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
                <View style={[m.field, { flex: 1 }]}>
                  <Text style={m.label}>Program</Text>
                  <TextInput
                    style={m.input}
                    value={ambForm.program}
                    onChangeText={v => setAmbForm(f => ({ ...f, program: v }))}
                    placeholder="e.g. Finance"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={m.field}>
                <Text style={m.label}>Email <Text style={{ color: C.red }}>*</Text></Text>
                <TextInput
                  style={m.input}
                  value={ambForm.email}
                  onChangeText={v => setAmbForm(f => ({ ...f, email: v }))}
                  placeholder="name@example.com"
                  placeholderTextColor={C.inkSoft}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Phone */}
              <View style={m.field}>
                <Text style={m.label}>Phone <Text style={{ color: C.inkSoft, fontWeight: '400' }}>(optional)</Text></Text>
                <TextInput
                  style={m.input}
                  value={ambForm.phone}
                  onChangeText={v => setAmbForm(f => ({ ...f, phone: v }))}
                  placeholder="+41 79 000 00 00"
                  placeholderTextColor={C.inkSoft}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Photo URL */}
              <View style={m.field}>
                <Text style={m.label}>Photo URL <Text style={{ color: C.inkSoft, fontWeight: '400' }}>(optional)</Text></Text>
                <TextInput
                  style={m.input}
                  value={ambForm.photo_url}
                  onChangeText={v => setAmbForm(f => ({ ...f, photo_url: v }))}
                  placeholder="https://..."
                  placeholderTextColor={C.inkSoft}
                  autoCapitalize="none"
                />
              </View>

              {/* Active toggle */}
              <View style={m.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={m.label}>Active</Text>
                  <Text style={m.hint}>Inactive ambassadors are hidden from public view</Text>
                </View>
                <Switch
                  value={ambForm.is_active}
                  onValueChange={v => setAmbForm(f => ({ ...f, is_active: v }))}
                  trackColor={{ true: C.leaf, false: '#ccc' }}
                  thumbColor="#fff"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Open Day event modal (admin) ─────────────────────────────── */}
      <Modal
        visible={eventModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!eventSaving) setEventModalOpen(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={m.root}>
            <View style={m.header}>
              <TouchableOpacity
                onPress={() => { if (!eventSaving) setEventModalOpen(false); }}
                style={m.cancelBtn}
                disabled={eventSaving}
              >
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Text style={m.headerTitle}>{eventEditingId ? 'Edit Event' : 'New Event'}</Text>
              <TouchableOpacity
                style={[m.saveBtn, eventSaving && { opacity: 0.6 }]}
                onPress={handleSaveEvent}
                disabled={eventSaving}
              >
                {eventSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={m.saveTxt}>Save Event</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={m.body}>
              {/* Event type picker */}
              <View style={m.field}>
                <Text style={m.label}>Event type <Text style={{ color: C.red }}>*</Text></Text>
                <View style={m.typeGrid}>
                  {EVENT_TYPES.map(t => {
                    const active = eventForm.type === t.label;
                    return (
                      <TouchableOpacity
                        key={t.label}
                        style={[m.typeChip, active && m.typeChipActive]}
                        onPress={() => setEventForm(f => ({ ...f, type: t.label, emoji: t.emoji }))}
                        activeOpacity={0.8}
                      >
                        <Text style={m.typeChipEmoji}>{t.emoji}</Text>
                        <Text style={[m.typeChipTxt, active && m.typeChipTxtActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Custom type name (only for Other / Custom) */}
              {eventForm.type === CUSTOM_TYPE && (
                <View style={m.field}>
                  <Text style={m.label}>Custom event name <Text style={{ color: C.red }}>*</Text></Text>
                  <TextInput
                    style={m.input}
                    value={eventForm.custom}
                    onChangeText={v => setEventForm(f => ({ ...f, custom: v }))}
                    placeholder="e.g. Alumni Mixer"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
              )}

              {/* Title */}
              <View style={m.field}>
                <Text style={m.label}>Event title <Text style={{ color: C.red }}>*</Text></Text>
                <TextInput
                  style={m.input}
                  value={eventForm.title}
                  onChangeText={v => setEventForm(f => ({ ...f, title: v }))}
                  placeholder="e.g. Morning Campus Tour"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Date */}
              <View style={m.field}>
                <Text style={m.label}>Date</Text>
                <TextInput
                  style={m.input}
                  value={eventForm.date}
                  onChangeText={v => setEventForm(f => ({ ...f, date: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Start + End time */}
              <View style={m.twoCol}>
                <View style={[m.field, { flex: 1 }]}>
                  <Text style={m.label}>Start time</Text>
                  <TextInput
                    style={m.input}
                    value={eventForm.start}
                    onChangeText={v => setEventForm(f => ({ ...f, start: v }))}
                    placeholder="10:00"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
                <View style={[m.field, { flex: 1 }]}>
                  <Text style={m.label}>End time</Text>
                  <TextInput
                    style={m.input}
                    value={eventForm.end}
                    onChangeText={v => setEventForm(f => ({ ...f, end: v }))}
                    placeholder="11:00"
                    placeholderTextColor={C.inkSoft}
                  />
                </View>
              </View>

              {/* Location */}
              <View style={m.field}>
                <Text style={m.label}>Location</Text>
                <TextInput
                  style={m.input}
                  value={eventForm.location}
                  onChangeText={v => setEventForm(f => ({ ...f, location: v }))}
                  placeholder="e.g. Main Hall, Building A"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Description */}
              <View style={m.field}>
                <Text style={m.label}>Description / details</Text>
                <TextInput
                  style={[m.input, m.inputMulti]}
                  value={eventForm.details}
                  onChangeText={v => setEventForm(f => ({ ...f, details: v }))}
                  placeholder="What happens during this activity…"
                  placeholderTextColor={C.inkSoft}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Host */}
              <View style={m.field}>
                <Text style={m.label}>Responsible person / host <Text style={{ color: C.inkSoft, fontWeight: '400' }}>(optional)</Text></Text>
                <TextInput
                  style={m.input}
                  value={eventForm.host}
                  onChangeText={v => setEventForm(f => ({ ...f, host: v }))}
                  placeholder="e.g. Dr. Keller"
                  placeholderTextColor={C.inkSoft}
                />
              </View>

              {/* Capacity / notes */}
              <View style={m.field}>
                <Text style={m.label}>Capacity / notes <Text style={{ color: C.inkSoft, fontWeight: '400' }}>(optional)</Text></Text>
                <TextInput
                  style={m.input}
                  value={eventForm.capacity}
                  onChangeText={v => setEventForm(f => ({ ...f, capacity: v }))}
                  placeholder="e.g. 30 seats"
                  placeholderTextColor={C.inkSoft}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

// ── Main stylesheet ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.mist },
  content:   { padding: 20, paddingBottom: 40 },

  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pageTitle:   { fontSize: 28, fontWeight: '500', color: C.forest },
  pageSub:     { fontSize: 13, color: C.inkMid, marginTop: 2 },
  headerRight: { gap: 8, alignItems: 'flex-end' },

  editModeBtn:          { borderWidth: 1.5, borderColor: C.leaf, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  editModeBtnActive:    { backgroundColor: C.forest, borderColor: C.forest },
  editModeBtnTxt:       { fontSize: 13, fontWeight: '600', color: C.leaf },
  editModeBtnTxtActive: { color: '#fff' },

  datePill:     { backgroundColor: C.mist, borderWidth: 1, borderColor: C.leaf + '40', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  datePillText: { fontSize: 12, color: C.leaf, fontWeight: '600' },

  banner:    { backgroundColor: '#EFF6EF', borderWidth: 1, borderColor: C.leaf, borderRadius: 10, padding: 12, marginBottom: 14 },
  bannerTxt: { fontSize: 13, fontWeight: '700', color: C.forest },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: 120, borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  statVal:  { fontSize: 24, fontWeight: '900' },
  statLbl:  { fontSize: 11, color: C.inkMid },
  capBarTrack: { height: 4, backgroundColor: C.border, borderRadius: 2, marginTop: 4 },
  capBarFill:  { height: 4, backgroundColor: C.amber, borderRadius: 2 },

  card:        { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 16 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:{ fontSize: 15, fontWeight: '700', color: C.ink },
  sectionSub:  { fontSize: 12, color: C.inkSoft, marginTop: 2 },

  headerBtns:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn:    { backgroundColor: C.forest, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  emptyState:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon:   { fontSize: 32 },
  emptyTxt:    { fontSize: 13, color: C.inkMid, textAlign: 'center', lineHeight: 18 },
  emptyAction: { color: C.leaf, fontSize: 13, fontWeight: '600' },

  errorBox: { backgroundColor: '#FDF1F0', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', padding: 14, alignItems: 'center' },
  errorTxt: { fontSize: 13, color: C.red, textAlign: 'center' },

  programItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  programItemHidden: { opacity: 0.45 },
  programIcon:       { fontSize: 24, width: 32, textAlign: 'center' },
  programTitle:      { fontSize: 14, fontWeight: '600', color: C.ink },
  programTitleHidden:{ color: C.inkSoft, textDecorationLine: 'line-through' },
  hiddenLabel:       { fontSize: 12, fontWeight: '400', color: C.inkSoft },
  programDesc:       { fontSize: 12, color: C.inkMid, marginTop: 2, lineHeight: 17 },
  eventType:         { fontSize: 12, color: C.leaf, fontWeight: '600', marginTop: 2 },
  eventMeta:         { fontSize: 12, color: C.inkMid, marginTop: 2 },

  itemActions:  { flexDirection: 'row', gap: 6 },
  iconBtn:      { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger:{ backgroundColor: '#FDF1F0' },
  iconBtnTxt:   { fontSize: 16 },

  formRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  formLabel:  { fontSize: 13, color: C.ink, fontWeight: '500' },
  formInput:  { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: C.ink, minWidth: 120, backgroundColor: C.mist },
  saveBtn:    { backgroundColor: C.leaf, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText:{ color: '#fff', fontSize: 13, fontWeight: '700' },

  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowAlt: { backgroundColor: C.mist, borderRadius: 6 },
  th: { fontSize: 11, fontWeight: '700', color: C.inkMid, textTransform: 'uppercase', letterSpacing: 0.6 },
  td: { fontSize: 13, color: C.ink },

  // Ambassador cards
  ambCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.mist, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 10,
  },
  ambCardInactive: { opacity: 0.55 },
  ambAvatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ambInitials: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ambNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ambName:     { fontSize: 14, fontWeight: '700', color: C.ink },
  ambRole:     { fontSize: 12, color: C.leaf, fontWeight: '600' },
  ambTagRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ambTag:      { backgroundColor: C.card, borderRadius: 6, borderWidth: 1, borderColor: C.border, paddingHorizontal: 7, paddingVertical: 3 },
  ambTagText:  { fontSize: 11, color: C.inkMid, fontWeight: '500' },
  ambEmail:    { fontSize: 11, color: C.inkSoft },
  inactiveBadge:    { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  inactiveBadgeText:{ fontSize: 10, color: C.inkMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { width: 100, fontSize: 12, color: C.ink },
  barTrack: { flex: 1, height: 10, backgroundColor: '#E2EFE5', borderRadius: 5 },
  barFill:  { height: 10, borderRadius: 5, backgroundColor: C.leaf },
  barCount: { width: 36, fontSize: 12, color: C.inkMid, textAlign: 'right' },
});

// ── Modal stylesheet ───────────────────────────────────────────────────────────
const m = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.mist },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 20,
  },
  cancelBtn:   { paddingRight: 8 },
  cancelTxt:   { fontSize: 15, color: C.inkMid },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  saveBtn:     { backgroundColor: C.forest, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  saveTxt:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  body:       { padding: 20, gap: 20, paddingBottom: 60 },
  field:      { gap: 6 },
  twoCol:     { flexDirection: 'row', gap: 12 },
  label:      { fontSize: 13, fontWeight: '600', color: C.ink },
  hint:       { fontSize: 11, color: C.inkSoft },
  input:      { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, backgroundColor: C.card },
  inputMulti: { minHeight: 80 },
  emojiInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 28, color: C.ink, backgroundColor: C.card,
    width: 80, textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14,
  },
  typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.card },
  typeChipActive:   { borderColor: C.forest, backgroundColor: C.mist },
  typeChipEmoji:    { fontSize: 16 },
  typeChipTxt:      { fontSize: 13, color: C.ink, fontWeight: '600' },
  typeChipTxtActive:{ color: C.forest },
});

export default AdminOpenDayScreen;
