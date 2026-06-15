// Shared helper for the home-page calendar widgets (professor + admin).
// Both main pages reuse the SAME saved records loaded by their Calendar pages
// (professor → professor_calendar, admin → admin_calendar). This helper only
// decides which of those already-loaded records to surface on the home widget.

import { AdminCalendarEvent } from '../types';
import { pad2 } from './calendarInput';

// Build a comparable timestamp from an event's 'YYYY-MM-DD' date + 'HH:MM' time.
// Falls back to start-of-day when the time is missing/invalid.
const toMs = (date: string, time?: string | null): number => {
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time : '00:00';
  return new Date(`${date}T${t}:00`).getTime();
};

// When an event ends (use end_time when present, otherwise fall back to start
// time). Once this moment has passed the event is "finished" and must drop off.
const endMs = (e: AdminCalendarEvent): number => toMs(e.date, e.end_time ?? e.time);

// When an event starts — used purely for soonest-first ordering.
const startMs = (e: AdminCalendarEvent): number => toMs(e.date, e.time);

const todayStr = (now: Date): string =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

/**
 * Pick the calendar records to show on a home-page calendar widget:
 *  - drops events that have already finished (end_time, else start time, in the past);
 *  - if any upcoming events remain for *today*, returns ALL of today's upcoming;
 *  - otherwise returns the closest 4 upcoming records from future days;
 *  - always sorted soonest start date/time first.
 *
 * Ownership is NOT decided here — the caller passes in the records already
 * scoped to the logged-in user by the existing Calendar-page loader.
 */
export const getUpcomingCalendarItemsForHome = (
  items: AdminCalendarEvent[],
  now: Date = new Date(),
): AdminCalendarEvent[] => {
  const nowMs = now.getTime();
  const today = todayStr(now);

  const upcoming = (items ?? [])
    .filter(e => !!e?.date)
    .filter(e => endMs(e) >= nowMs)           // not finished yet
    .sort((a, b) => startMs(a) - startMs(b)); // soonest first

  const todayUpcoming = upcoming.filter(e => e.date === today);
  if (todayUpcoming.length > 0) return todayUpcoming; // all of today's upcoming
  return upcoming.slice(0, 4);                        // else next 4 closest
};
