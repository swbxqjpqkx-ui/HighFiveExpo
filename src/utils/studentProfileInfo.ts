// ── Student Profile Information ─────────────────────────────────────────────────
// Structured, student-level context entries (interests, academic background,
// learning difficulties, custom categories) added by professors/admins.
//
// Stored in the dedicated `student_profile_information` table, keyed by the
// global `students.id`, so the same information appears in every course the
// student is enrolled in and is visible to any professor/admin who can open
// that student's profile.

export type ProfileInfoCategory =
  | 'interest'
  | 'academic_background'
  | 'learning_difficulty'
  | 'custom';

// One row of the student_profile_information table.
export interface ProfileInfoRow {
  id:                      string;
  student_id:              string;
  category_type:           ProfileInfoCategory;
  custom_category_name:    string | null;
  content:                 string;
  added_by_professor_id:   string | null;
  added_by_professor_name: string | null;
  created_at:              string;
  updated_at:              string;
}

// Default category buttons shown in the profile section.
export const DEFAULT_CATEGORIES: { key: ProfileInfoCategory; label: string; addLabel: string }[] = [
  { key: 'interest',            label: 'Interest',            addLabel: 'Add Interest' },
  { key: 'academic_background', label: 'Academic Background', addLabel: 'Add Academic Background' },
  { key: 'learning_difficulty', label: 'Learning Difficulty', addLabel: 'Add Learning Difficulty' },
  { key: 'custom',              label: 'Custom Category',      addLabel: 'Add Custom Category' },
];

const FIXED_LABELS: Record<Exclude<ProfileInfoCategory, 'custom'>, string> = {
  interest:            'Interest',
  academic_background: 'Academic Background',
  learning_difficulty: 'Learning Difficulty',
};

/** Human-readable category name for a saved entry. */
export const categoryLabel = (
  row: { category_type: ProfileInfoCategory; custom_category_name?: string | null },
): string =>
  row.category_type === 'custom'
    ? (row.custom_category_name?.trim() || 'Custom')
    : FIXED_LABELS[row.category_type];

/** Add-form title for a chosen category. */
export const addTitle = (category: ProfileInfoCategory): string =>
  category === 'custom'
    ? 'Add Custom Category'
    : `Add ${FIXED_LABELS[category]}`;

/** Format an ISO timestamp like "29 May 2026". */
export const formatEntryDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
