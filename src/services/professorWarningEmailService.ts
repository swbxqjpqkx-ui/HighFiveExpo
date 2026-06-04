import { supabase } from './supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export type WarningEmailType = 'course_help' | 'absence_policy';

export interface WarningEmailRecord {
  id:             string;
  student_id:     string;
  student_email:  string;
  student_name:   string;
  professor_id:   string;
  professor_name: string;
  course_id:      string;
  course_name:    string;
  warning_id:     string | null;
  email_type:     WarningEmailType;
  sender_role:    'professor' | 'admin';
  subject:        string;
  body:           string;
  sent_by_user_id: string;
  sent_by_name:   string;
  sent_at:        string;
  status:         'sent' | 'failed';
  error_message:  string | null;
}

export interface SendWarningEmailParams {
  warning_id?:    string;
  email_type:     WarningEmailType;
  to_email:       string;
  student_name:   string;
  student_id:     string;
  course_id:      string;
  course_name:    string;
  professor_id:   string;
  professor_name: string;
  subject:        string;
  body:           string;
}

// ── Send via Edge Function ─────────────────────────────────────────────────────
// Calls supabase/functions/send-warning-email which:
//   1. Validates the caller is assigned to the course
//   2. Sends the email via Resend
//   3. Logs the result to warning_email_logs
//   4. Updates risk_warnings email flags on success

export const sendWarningEmail = async (params: SendWarningEmailParams): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('send-warning-email', {
    body: params,
  });

  if (error) {
    const msg = (error as any)?.message ?? 'Failed to send email';
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }
};

// ── Query sent logs ────────────────────────────────────────────────────────────

export const getSentEmailLogs = async (
  professorId: string,
): Promise<WarningEmailRecord[]> => {
  const { data, error } = await supabase
    .from('warning_email_logs')
    .select('*')
    .eq('professor_id', professorId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WarningEmailRecord[];
};

export const getEmailLogsForWarning = async (
  warningId: string,
): Promise<WarningEmailRecord[]> => {
  const { data, error } = await supabase
    .from('warning_email_logs')
    .select('*')
    .eq('warning_id', warningId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WarningEmailRecord[];
};

// ── Legacy alias (keeps old imports working) ───────────────────────────────────

/** @deprecated Use getSentEmailLogs instead */
export const getSentEmailsForProfessor = getSentEmailLogs;
