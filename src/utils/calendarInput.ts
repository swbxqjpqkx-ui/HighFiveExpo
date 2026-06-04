// Shared calendar date/time input normalization — used by both the admin and
// professor calendar event forms so their behavior stays identical.

export const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Normalize a user-typed date to the 'YYYY-MM-DD' format the app/Supabase use.
 * Accepts the existing 'YYYY-MM-DD' as well as 'dd/mm/yy' and 'dd/mm/yyyy'
 * (also tolerant of '.' or '-' separators for the day-first forms).
 * Returns null if the date is not valid.
 */
export const normalizeDateInput = (raw: string): string | null => {
  const input = (raw ?? '').trim();
  if (!input) return null;

  let year: number, month: number, day: number;

  // Existing ISO format: yyyy-mm-dd
  const iso = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    year = +iso[1]; month = +iso[2]; day = +iso[3];
  } else {
    // Day-first: dd/mm/yy or dd/mm/yyyy (slash, dot or dash separators)
    const dmy = input.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (!dmy) return null;
    day = +dmy[1]; month = +dmy[2];
    year = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible calendar dates (e.g. 31/02).
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

/**
 * Normalize a user-typed time to 'HH:MM' (24h). Accepts '9' -> '09:00',
 * '14' -> '14:00', '9:30' -> '09:30', '09:30' -> '09:30'.
 * Hours 0–23, minutes 00–59. Returns null for invalid input.
 */
export const normalizeTimeInput = (raw: string): string | null => {
  const input = (raw ?? '').trim();
  if (!input) return null;

  let hh: number, mm: number;
  const hm = input.match(/^(\d{1,2}):(\d{1,2})$/);
  if (hm) {
    hh = +hm[1]; mm = +hm[2];
  } else if (/^\d{1,2}$/.test(input)) {
    hh = +input; mm = 0;
  } else {
    return null;
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${pad2(hh)}:${pad2(mm)}`;
};
