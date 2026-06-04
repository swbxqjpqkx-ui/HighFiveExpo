/**
 * Supabase Edge Function: send-warning-email
 *
 * Sends a risk warning email to a student and logs it to warning_email_logs.
 * Used by both professor (Warnings page) and admin (Student Coordination page).
 *
 * Required Supabase secrets (set via Supabase Dashboard → Settings → Edge Functions):
 *   RESEND_API_KEY   — your Resend API key (resend.com)
 *   FROM_EMAIL       — verified sender address, e.g. warnings@yourdomain.com
 *
 * Deploy:
 *   supabase functions deploy send-warning-email
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon    = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User-scoped client — validates the JWT
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  // Admin client — bypasses RLS for DB writes
  const adminClient = createClient(supabaseUrl, supabaseService);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Parse body ────────────────────────────────────────────────────────────
  let payload: {
    warning_id?:    string;
    email_type:     'course_help' | 'absence_policy';
    to_email:       string;
    student_name:   string;
    student_id:     string;
    course_id:      string;
    course_name:    string;
    professor_id:   string;
    professor_name: string;
    subject:        string;
    body:           string;
  };

  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    warning_id, email_type, to_email, student_name, student_id,
    course_id, course_name, professor_id, professor_name, subject, body: emailBody,
  } = payload;

  if (!to_email || !subject || !emailBody || !course_id || !email_type || !student_id) {
    return json({ error: 'Missing required fields' }, 400);
  }

  // ── 3. Authorization check ───────────────────────────────────────────────────
  // Admins can send for any course. Professors only for their own courses.
  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = callerProfile?.role === 'administrator';

  if (!isAdmin) {
    // Must be assigned to this course via courses.teacher_id OR course_teachers
    const [{ data: directCourse }, { data: junctionRow }] = await Promise.all([
      adminClient.from('courses').select('id').eq('id', course_id).eq('teacher_id', user.id).maybeSingle(),
      adminClient.from('course_teachers').select('course_id').eq('course_id', course_id).eq('teacher_id', user.id).maybeSingle(),
    ]);

    if (!directCourse && !junctionRow) {
      return json({ error: 'Forbidden: you are not assigned to this course' }, 403);
    }
  }

  // ── 4. Send email via Resend ─────────────────────────────────────────────────
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@highfive.edu';

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  if (!RESEND_KEY) {
    status = 'failed';
    errorMessage = 'RESEND_API_KEY secret is not configured in Supabase Edge Function settings.';
    console.error('[send-warning-email] RESEND_API_KEY not set');
  } else {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to:   [to_email],
          subject,
          text: emailBody,
        }),
      });

      if (!resendRes.ok) {
        const err = await resendRes.json().catch(() => ({}));
        status       = 'failed';
        errorMessage = (err as any).message ?? `Resend returned ${resendRes.status}`;
        console.error('[send-warning-email] Resend error:', errorMessage);
      }
    } catch (netErr: any) {
      status       = 'failed';
      errorMessage = netErr.message ?? 'Network error contacting Resend';
      console.error('[send-warning-email] fetch error:', netErr);
    }
  }

  // ── 5. Log to warning_email_logs ─────────────────────────────────────────────
  const now = new Date().toISOString();
  await adminClient.from('warning_email_logs').insert({
    student_id,
    student_email:  to_email,
    student_name,
    course_id,
    course_name,
    professor_id:   professor_id ?? user.id,
    professor_name,
    warning_id:     warning_id ?? null,
    email_type,
    sender_role:    isAdmin ? 'admin' : 'professor',
    subject,
    body:           emailBody,
    sent_by_user_id: user.id,
    sent_by_name:   professor_name,
    sent_at:        now,
    status,
    error_message:  errorMessage,
  });

  // ── 6. Update risk_warnings flags on success ─────────────────────────────────
  if (status === 'sent' && warning_id) {
    const patch: Record<string, unknown> = { last_email_sent_at: now, updated_at: now };
    if (email_type === 'course_help')    patch.course_help_email_sent    = true;
    if (email_type === 'absence_policy') patch.absence_policy_email_sent = true;
    await adminClient.from('risk_warnings').update(patch).eq('id', warning_id);
  }

  // ── 7. Respond ───────────────────────────────────────────────────────────────
  if (status === 'failed') {
    return json({ error: errorMessage }, 500);
  }

  return json({ success: true });
});
