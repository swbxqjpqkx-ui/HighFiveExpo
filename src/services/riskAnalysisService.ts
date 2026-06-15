import { Platform } from 'react-native';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_URL } from '../config/ai';
import { AtRiskStudent } from './studentRiskService';

// AI runs only in the native app — the web preview ships without an Anthropic key.
const WEB_PREVIEW_MESSAGE = 'AI analysis is not available in the web preview. Please use the High Five mobile app.';

export interface RiskAnalysis {
  summary: string;
  patterns: string[];
  top_concern: string;
  course_insights: Array<{ course: string; count: number; note: string }>;
  semester_insights: string;
  recommendations: string[];
}

// Only send minimal necessary fields to the AI — never the full DB payload
const buildCompactPayload = (students: AtRiskStudent[]) =>
  students.map(s => ({
    name:         s.student_name,
    program:      s.program,
    semester:     s.semester,
    course:       s.course_name,
    grade:        s.grade_percentage !== null ? `${s.grade_percentage}%` : 'N/A',
    absences:     s.missed_classes_count ?? 'N/A',
    min_grade:    `${s.borderline_grade_percentage}%`,
    max_absences: s.max_absences_allowed,
    reason:       s.warning_reason,
  }));

export const analyzeAtRiskStudents = async (
  students: AtRiskStudent[],
): Promise<RiskAnalysis> => {
  if (students.length === 0) {
    return {
      summary:          'No at-risk students detected. All students are meeting the defined thresholds.',
      patterns:         [],
      top_concern:      '',
      course_insights:  [],
      semester_insights:'',
      recommendations:  [],
    };
  }

  const compact = buildCompactPayload(students);

  const prompt = `You are an academic risk analyst at a business school. Below is a structured list of at-risk students identified by deterministic grade and attendance rules. Analyze ONLY the data provided — do not invent information.

AT-RISK STUDENTS (${students.length} total):
${JSON.stringify(compact, null, 2)}

Return ONLY valid JSON with no markdown, no code fences, just raw JSON:
{
  "summary": "<2-3 sentence institution-wide overview>",
  "patterns": [
    "<observed pattern, e.g. 'Semester 3 students have the highest absence rate'>",
    "<another pattern>"
  ],
  "top_concern": "<single most urgent situation>",
  "course_insights": [
    { "course": "<course name>", "count": <number at-risk in this course>, "note": "<brief note under 120 chars>" }
  ],
  "semester_insights": "<which semester/program combination has the most issues and a brief why>",
  "recommendations": [
    "<specific actionable recommendation for the institution>",
    "<another recommendation>"
  ]
}

Rules:
- Only analyze the data provided above.
- Keep each string field under 200 characters.
- Limit course_insights to the top 3 most affected courses.
- Limit patterns to 3 items max.
- Limit recommendations to 3 items max.
- Return valid complete JSON only.`;

  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 900,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);

  const data  = await response.json();
  const text  = data.content?.[0]?.text ?? '{}';
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(clean) as RiskAnalysis;
  } catch {
    return {
      summary:          text.slice(0, 300),
      patterns:         [],
      top_concern:      '',
      course_insights:  [],
      semester_insights:'',
      recommendations:  [],
    };
  }
};
