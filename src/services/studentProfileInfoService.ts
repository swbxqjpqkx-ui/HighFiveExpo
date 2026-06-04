import { supabase } from './supabase';
import { ProfileInfoCategory, ProfileInfoRow } from '../utils/studentProfileInfo';

const TABLE = 'student_profile_information';

/** All entries for a student, oldest first. Keyed by the global students.id. */
export const getStudentProfileInfo = async (studentId: string): Promise<ProfileInfoRow[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProfileInfoRow[];
};

export const addStudentProfileInfo = async (input: {
  studentId:     string;
  category:      ProfileInfoCategory;
  customName:    string | null;
  content:       string;
  professorId:   string | null;
  professorName: string | null;
}): Promise<ProfileInfoRow> => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      student_id:              input.studentId,
      category_type:           input.category,
      custom_category_name:    input.category === 'custom' ? input.customName : null,
      content:                 input.content,
      added_by_professor_id:   input.professorId,
      added_by_professor_name: input.professorName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProfileInfoRow;
};

export const updateStudentProfileInfo = async (
  id: string,
  fields: { content: string; customName?: string | null },
): Promise<void> => {
  const updates: Record<string, unknown> = {
    content:    fields.content,
    updated_at: new Date().toISOString(),
  };
  if (fields.customName !== undefined) updates.custom_category_name = fields.customName;
  const { error } = await supabase.from(TABLE).update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteStudentProfileInfo = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};
