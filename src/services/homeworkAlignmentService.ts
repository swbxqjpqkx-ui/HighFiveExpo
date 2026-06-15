import { Platform } from 'react-native';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_URL } from '../config/ai';
import {
  HomeworkAlignmentCheck,
  AlignmentStatus,
  OverlapDetail,
  GeneratedTask,
} from '../types/homeworkAssistance';

// AI runs only in the native app — the web preview ships without an Anthropic key.
const WEB_PREVIEW_MESSAGE = 'AI analysis is not available in the web preview. Please use the High Five mobile app.';
import { CourseContext, RelatedCourse } from './homeworkAssistanceService';

// ── Claude API call ────────────────────────────────────────────────────────────

const buildAlignmentPrompt = (
  homeworkTitle: string,
  homeworkText: string,
  weekNumber: number,
  weekTopic: string,
  courseContext: CourseContext,
  accreditation: string,
  hasSOWDocument: boolean,
): string => {
  const sowSection = hasSOWDocument
    ? `## Scheme of Work
The Scheme of Work for this course is attached as a document. Use it to identify Week ${weekNumber}'s learning objectives, expected depth, and topic scope.`
    : `## Scheme of Work (text reference)
${courseContext.schemeOfWorkText || 'Not provided'}`;

  const weekMaterials = courseContext.materialsText
    .split('\n')
    .filter(line => line.startsWith(`Week ${weekNumber}:`))
    .join('\n') || 'No materials specified for this week';

  return `You are a ${accreditation} accreditation reviewer at a business school.

IMPORTANT SCOPE RULE: This homework is for Week ${weekNumber} only. Do NOT evaluate it against the full course or all learning objectives. Only check whether it is appropriate and aligned for Week ${weekNumber} and its specific topic: "${weekTopic}".

## Homework
Title: ${homeworkTitle}
Content: ${homeworkText}

## Professor's stated topic for Week ${weekNumber}
${weekTopic}

${sowSection}

## Course Materials for Week ${weekNumber}
${weekMaterials}

## Instructions
1. Read the Scheme of Work${hasSOWDocument ? ' (attached document)' : ''} to find what Week ${weekNumber} covers — learning objectives, topics, expected student output.
2. Check ONLY whether this homework fits Week ${weekNumber}'s requirements.
3. Do NOT flag objectives from other weeks as "missing" — they are out of scope.
4. Score alignment based solely on fit with Week ${weekNumber}.

Return ONLY valid raw JSON (no markdown, no code fences):
{
  "alignment_percentage": <integer 0-100>,
  "alignment_status": <"strongly_aligned"|"mostly_aligned"|"partially_aligned"|"not_aligned">,
  "covered_learning_objectives": ["<specific objective from Week ${weekNumber}>"],
  "missing_learning_objectives": ["<objective expected for Week ${weekNumber} but not covered>"],
  "syllabus_alignment_summary": "",
  "scheme_of_work_alignment_summary": "<how well the homework matches Week ${weekNumber} in the scheme of work>",
  "accreditation_alignment_summary": "",
  "program_alignment_summary": "",
  "overlap_detected": false,
  "overlap_details": [],
  "ai_recommendations": ["<max 12 words>", "<max 12 words>", "<max 12 words>"],
  "suggested_revised_homework": "<rewritten homework brief focused on Week ${weekNumber} topic>",
  "generated_tasks": []
}

Rules:
- alignment_percentage: how well the homework fits Week ${weekNumber}'s topic and objectives.
- ai_recommendations: maximum 3 items, each under 12 words. Be direct and specific.
- suggested_revised_homework: rewrite the homework to be clearly focused on "${weekTopic}".
- Return valid complete JSON only.`;
};

interface RawAlignmentResponse {
  alignment_percentage?: number;
  alignment_status?: string;
  covered_learning_objectives?: string[];
  missing_learning_objectives?: string[];
  syllabus_alignment_summary?: string;
  scheme_of_work_alignment_summary?: string;
  accreditation_alignment_summary?: string;
  program_alignment_summary?: string;
  overlap_detected?: boolean;
  overlap_details?: Array<{
    course_name?: string;
    professor_name?: string;
    overlap_description?: string;
    severity?: string;
  }>;
  ai_recommendations?: string[];
  suggested_revised_homework?: string;
  generated_tasks?: Array<{
    id?: string;
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
  }>;
}

const parseAlignmentResponse = (text: string): Omit<
  HomeworkAlignmentCheck,
  'id' | 'professor_id' | 'course_id' | 'course_name' | 'homework_title' | 'homework_text' |
  'uploaded_file_urls' | 'professor_edits' | 'created_at' | 'updated_at'
> => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const parsed: RawAlignmentResponse = JSON.parse(cleaned);

  const pct = Math.min(100, Math.max(0, Number(parsed.alignment_percentage) || 0));
  const validStatuses: AlignmentStatus[] = ['strongly_aligned', 'mostly_aligned', 'partially_aligned', 'not_aligned'];

  let status: AlignmentStatus;
  if (validStatuses.includes(parsed.alignment_status as AlignmentStatus)) {
    status = parsed.alignment_status as AlignmentStatus;
  } else if (pct >= 85) {
    status = 'strongly_aligned';
  } else if (pct >= 65) {
    status = 'mostly_aligned';
  } else if (pct >= 40) {
    status = 'partially_aligned';
  } else {
    status = 'not_aligned';
  }

  const overlapDetails: OverlapDetail[] = (parsed.overlap_details ?? []).map(o => ({
    course_name: o.course_name ?? 'Unknown Course',
    professor_name: o.professor_name,
    overlap_description: o.overlap_description ?? '',
    severity: (['high', 'medium', 'low'].includes(o.severity ?? '') ? o.severity : 'medium') as 'high' | 'medium' | 'low',
  }));

  const generatedTasks: GeneratedTask[] = (parsed.generated_tasks ?? []).map((t, i) => ({
    id: t.id ?? `task-${i + 1}`,
    title: t.title ?? `Task ${i + 1}`,
    description: t.description ?? '',
    priority: (['high', 'medium', 'low'].includes(t.priority ?? '') ? t.priority : 'medium') as 'high' | 'medium' | 'low',
    status: 'open' as const,
  }));

  return {
    alignment_percentage: pct,
    alignment_status: status,
    covered_learning_objectives: parsed.covered_learning_objectives ?? [],
    missing_learning_objectives: parsed.missing_learning_objectives ?? [],
    syllabus_alignment_summary: parsed.syllabus_alignment_summary ?? '',
    scheme_of_work_alignment_summary: parsed.scheme_of_work_alignment_summary ?? '',
    accreditation_alignment_summary: parsed.accreditation_alignment_summary ?? '',
    program_alignment_summary: parsed.program_alignment_summary ?? '',
    overlap_detected: Boolean(parsed.overlap_detected),
    overlap_details: overlapDetails,
    ai_recommendations: parsed.ai_recommendations ?? [],
    suggested_revised_homework: parsed.suggested_revised_homework ?? '',
    generated_tasks: generatedTasks,
  };
};

const fetchDocumentAsBase64 = async (
  url: string,
): Promise<{ base64: string; mimeType: string } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const mimeType = (response.headers.get('content-type') ?? 'application/pdf').split(';')[0].trim();
    const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    return { base64: btoa(binary), mimeType: supported.includes(mimeType) ? mimeType : 'application/pdf' };
  } catch {
    return null;
  }
};

export const runHomeworkAlignmentCheck = async (
  courseId: string,
  homeworkTitle: string,
  homeworkText: string,
  weekNumber: number,
  weekTopic: string,
  uploadedFileUrls: string[],
  courseContext: CourseContext,
  relatedCourses: RelatedCourse[],
  accreditation: string,
): Promise<Omit<HomeworkAlignmentCheck, 'id' | 'professor_id' | 'course_id' | 'course_name' | 'created_at' | 'updated_at'>> => {
  // Fetch scheme of work document if available
  const sowDoc = courseContext.schemeOfWorkFileUrl
    ? await fetchDocumentAsBase64(courseContext.schemeOfWorkFileUrl)
    : null;

  const hasSOWDocument = sowDoc !== null;

  const prompt = buildAlignmentPrompt(
    homeworkTitle,
    homeworkText,
    weekNumber,
    weekTopic,
    courseContext,
    accreditation,
    hasSOWDocument,
  );

  // Build message content — prepend SOW document if available so Claude reads it first
  const messageContent: object[] = [];
  if (sowDoc) {
    messageContent.push({
      type: 'document',
      source: { type: 'base64', media_type: sowDoc.mimeType, data: sowDoc.base64 },
      title: 'Scheme of Work',
    });
  }
  messageContent.push({ type: 'text', text: prompt });

  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: messageContent }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  const responseText = data?.content?.[0]?.text;
  if (!responseText) throw new Error('Empty response from Claude API.');

  const parsed = parseAlignmentResponse(responseText);

  return {
    homework_title: homeworkTitle,
    homework_text: homeworkText,
    uploaded_file_urls: uploadedFileUrls,
    ...parsed,
  };
};

// ── Mock data ──────────────────────────────────────────────────────────────────

export const mockHomeworkAlignmentCheck = (
  courseId: string,
  homeworkTitle: string,
  homeworkText: string,
  weekNumber: number,
  weekTopic: string,
): Omit<HomeworkAlignmentCheck, 'id' | 'professor_id' | 'course_id' | 'course_name' | 'created_at' | 'updated_at'> => {
  const wordCount = homeworkText.split(' ').length;
  const pct = Math.min(95, 55 + Math.floor(wordCount / 5));
  const status: AlignmentStatus = pct >= 85 ? 'strongly_aligned'
    : pct >= 65 ? 'mostly_aligned'
    : pct >= 40 ? 'partially_aligned'
    : 'not_aligned';

  return {
    homework_title: homeworkTitle,
    homework_text: homeworkText,
    uploaded_file_urls: [],
    alignment_percentage: pct,
    alignment_status: status,
    covered_learning_objectives: [
      `LO1: Apply Week ${weekNumber} frameworks to practical scenarios`,
      `LO3: Analyse ${weekTopic} using appropriate methods`,
    ],
    missing_learning_objectives: [
      `LO2: Demonstrate critical reflection on Week ${weekNumber} concepts`,
    ],
    syllabus_alignment_summary: '',
    scheme_of_work_alignment_summary: '',
    accreditation_alignment_summary: '',
    program_alignment_summary: '',
    overlap_detected: false,
    overlap_details: [],
    ai_recommendations: [
      `Link tasks explicitly to Week ${weekNumber} learning objectives.`,
      'Add a short reflection requirement to deepen critical thinking.',
      'Specify minimum word count and referencing format.',
    ],
    suggested_revised_homework:
      `${homeworkTitle} — Week ${weekNumber}: ${weekTopic}\n\n` +
      `Objective: Demonstrate understanding of this week's topic through applied analysis.\n\n` +
      `Task: Using the concepts covered in Week ${weekNumber} (${weekTopic}), analyse a real-world example of your choice.\n\n` +
      `Part 1 — Analysis (60%): Apply the key frameworks from this week's material to your chosen example. Identify at least two key insights.\n\n` +
      `Part 2 — Reflection (40%): In 200–300 words, explain what this analysis reveals and how it connects to the course's broader learning objectives.\n\n` +
      `Submission: 600–800 words, APA referencing, at least 2 academic sources.`,
    generated_tasks: [],
  };
};
