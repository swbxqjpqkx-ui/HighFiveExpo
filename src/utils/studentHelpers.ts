/**
 * Calculates age in years from a date_of_birth ISO string (YYYY-MM-DD).
 * Returns null if dob is null / undefined / not a valid date.
 */
export const calculateAge = (dob: string | null | undefined): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
};

/**
 * Formats a date_of_birth ISO string as "DD MMM YYYY" (e.g. "15 Apr 1999").
 * Returns null if dob is null / undefined / not a valid date.
 */
export const formatDOB = (dob: string | null | undefined): string | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Returns a short age label like "25 years".
 * Returns null if dob is null / undefined / not a valid date.
 */
export const formatAgeStr = (dob: string | null | undefined): string | null => {
  const age = calculateAge(dob);
  if (age === null) return null;
  return `${age} year${age !== 1 ? 's' : ''}`;
};
