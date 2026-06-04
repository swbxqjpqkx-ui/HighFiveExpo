import { supabase } from './supabase';
import { OpenDayItem, OpenDayAmbassador } from '../types';
import { notifyAllAdmins } from './notificationService';

export const fetchOpenDayItems = async (): Promise<OpenDayItem[]> => {
  const { data, error } = await supabase
    .from('open_day_items')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OpenDayItem[];
};

export const insertOpenDayItem = async (
  item: Omit<OpenDayItem, 'id' | 'created_at' | 'updated_at'>,
): Promise<OpenDayItem> => {
  const { data, error } = await supabase
    .from('open_day_items')
    .insert({ ...item, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  // Notify admins of the new Open Day item (best-effort; carries its id for redirect).
  await notifyAllAdmins({
    title:   '🎓 Open Day Updated',
    message: `A new Open Day item "${(data as OpenDayItem)?.title ?? 'item'}" was added.`,
    type:    'open_day_update',
    relatedId:   (data as OpenDayItem)?.id ?? null,
    relatedType: 'open_day_item',
  });
  return data as OpenDayItem;
};

export const updateOpenDayItem = async (
  id: string,
  patch: Partial<Omit<OpenDayItem, 'id' | 'created_at'>>,
): Promise<OpenDayItem> => {
  const { data, error } = await supabase
    .from('open_day_items')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as OpenDayItem;
};

export const deleteOpenDayItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('open_day_items').delete().eq('id', id);
  if (error) throw error;
};

// ── Ambassador CRUD ────────────────────────────────────────────────────────────

export const fetchAmbassadors = async (): Promise<OpenDayAmbassador[]> => {
  const { data, error } = await supabase
    .from('open_day_ambassadors')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OpenDayAmbassador[];
};

export const insertAmbassador = async (
  amb: Omit<OpenDayAmbassador, 'id' | 'created_at' | 'updated_at'>,
): Promise<OpenDayAmbassador> => {
  const { data, error } = await supabase
    .from('open_day_ambassadors')
    .insert({ ...amb, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  // Notify admins that a new ambassador was added (best-effort).
  await notifyAllAdmins({
    title:   '🎓 Open Day Updated',
    message: `${(data as OpenDayAmbassador)?.full_name ?? 'A new ambassador'} was added as an Open Day ambassador.`,
    type:    'open_day_update',
    relatedId:   (data as OpenDayAmbassador)?.id ?? null,
    relatedType: 'open_day_ambassador',
  });
  return data as OpenDayAmbassador;
};

export const updateAmbassador = async (
  id: string,
  patch: Partial<Omit<OpenDayAmbassador, 'id' | 'created_at'>>,
): Promise<OpenDayAmbassador> => {
  const { data, error } = await supabase
    .from('open_day_ambassadors')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as OpenDayAmbassador;
};

export const deleteAmbassador = async (id: string): Promise<void> => {
  const { error } = await supabase.from('open_day_ambassadors').delete().eq('id', id);
  if (error) throw error;
};
