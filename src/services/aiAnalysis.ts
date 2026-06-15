import { Platform } from 'react-native';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_URL } from '../config/ai';
import { supabase } from './supabase';
import { AIAnalysisResult, AIIssue, SchemeTopic, MaterialCheckResult, MaterialAlignmentStatus } from '../types/courseManagement';

// AI analysis runs only in the native app — the web preview deliberately ships
// without an Anthropic key, so these features are unavailable there.
const WEB_PREVIEW_MESSAGE = 'AI analysis is not available in the web preview. Please use the High Five mobile app.';

const fetchAsBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch document: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const mimeType = (response.headers.get('content-type') ?? 'application/pdf').split(';')[0].trim();
  return { base64: btoa(binary), mimeType };
};

const buildPrompt = (
  type: 'syllabus' | 'material' | 'scheme_of_work',
  accreditation: string,
  program?: string,
): string => `You are a senior ${accreditation} accreditation reviewer at a business school.

Analyse the attached ${type === 'syllabus' ? 'course syllabus' : type === 'scheme_of_work' ? 'scheme of work' : 'course material'} document${program ? ` for the ${program} program` : ''} against ${accreditation} accreditation standards.

Key ${accreditation} standards to check:
- AACSB-1.1: Mission alignment — does the content reflect the institution's mission and values?
- AACSB-2.1: Student learning & pedagogical innovation — are learning methods current and effective?
- AACSB-2.3: Curriculum content & assurance of learning — are learning outcomes clearly stated and measurable?
- AACSB-3.1: Assurance of learning — are assessment methods aligned with stated learning outcomes?
- AACSB-4.2: Intellectual contributions — does content reflect current academic and professional knowledge?
- AACSB-5.1: Curriculum currency & continuous improvement — is content up to date and does it show evidence of improvement?

Return ONLY a valid JSON object with no markdown, no code blocks, just raw JSON:
{
  "overall_score": <integer 0-100>,
  "compliance_level": <"full" | "partial" | "non_compliant">,
  "summary": "<2-3 sentence overall assessment referencing specific content from the document>",
  "issues": [
    {
      "id": "<unique string like issue-1>",
      "severity": <"critical" | "warning" | "info">,
      "requirement_code": "<e.g. AACSB-2.3>",
      "requirement_title": "<standard name>",
      "description": "<specific problem found in the document with exact reference>",
      "location": "<section or page where found>",
      "outcome_affected": "<which learning outcome is affected if any>",
      "recommendation": "<specific actionable fix>"
    }
  ],
  "strengths": ["<specific strength from the document>", "<another strength>"]
}

Scoring: 90-100=fully compliant, 70-89=minor gaps, 50-69=significant issues, below 50=major non-compliance.
Be specific — reference actual content from the document. Limit to maximum 6 issues. Keep each field under 150 characters. Return valid complete JSON only.`;

const parseClaudeResponse = (text: string): Omit<AIAnalysisResult, 'id' | 'created_at' | 'course_id' | 'target_id' | 'target_type' | 'analysis_type' | 'status'> => {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    overall_score: Math.min(100, Math.max(0, Number(parsed.overall_score) || 0)),
    compliance_level: ['full', 'partial', 'non_compliant'].includes(parsed.compliance_level)
      ? parsed.compliance_level : 'partial',
    issues: (parsed.issues ?? []).map((issue: any, i: number): AIIssue => ({
      id: issue.id ?? `issue-${i}`,
      severity: ['critical', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info',
      requirement_code: issue.requirement_code ?? '',
      requirement_title: issue.requirement_title ?? '',
      description: issue.description ?? '',
      location: issue.location,
      outcome_affected: issue.outcome_affected,
      recommendation: issue.recommendation ?? '',
    })),
    suggestions: parsed.strengths ?? [],
  };
};

export const analyseDocumentWithAI = async (
  fileUrl: string,
  courseId: string,
  targetId: string,
  type: 'syllabus' | 'material' | 'scheme_of_work',
  accreditation: string,
  program?: string,
): Promise<AIAnalysisResult> => {
  // Fetch the submitted document as base64
  const doc = await fetchAsBase64(fileUrl);

  // Claude only supports pdf and a few image types as documents
  const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const mediaType = supportedTypes.includes(doc.mimeType) ? doc.mimeType : 'application/pdf';

  const prompt = buildPrompt(type, accreditation, program);

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
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: doc.base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  const responseText = data?.content?.[0]?.text;
  if (!responseText) throw new Error('Empty response from Claude API.');

  const parsed = parseClaudeResponse(responseText);

  const result: Omit<AIAnalysisResult, 'id' | 'created_at'> = {
    course_id: courseId,
    target_id: targetId,
    target_type: type,
    analysis_type: type === 'syllabus' ? 'syllabus_check' : type === 'scheme_of_work' ? 'scheme_of_work_check' : 'material_check',
    status: 'complete',
    ...parsed,
  };

  // Save to Supabase
  try {
    await supabase.from('ai_analysis_results').insert(result);
  } catch {}

  return { ...result, id: targetId, created_at: new Date().toISOString() };
};

// ── Course Overlap: topic extraction + semantic comparison ────────────────────
// Reuses the SAME Claude endpoint/config as the accreditation analysis above. No
// new keys, no new infrastructure. Both functions return plain data — callers in
// courseManagement.ts persist / compare them.

const stripJson = (text: string): string =>
  text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

// Extract the list of topics (and their week/module numbers when stated) from a
// Scheme of Work document. This is the "minimum logic needed to extract and store
// topic information" — it does not change the existing upload flow; courseManagement
// calls it lazily during a check and saves the result to scheme_of_work.topics.
export const extractSchemeTopics = async (fileUrl: string): Promise<SchemeTopic[]> => {
  const doc = await fetchAsBase64(fileUrl);
  const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const mediaType = supportedTypes.includes(doc.mimeType) ? doc.mimeType : 'application/pdf';

  const prompt = `You are reading a university course "Scheme of Work" (a week-by-week teaching plan).
Extract every distinct teaching TOPIC covered. For each topic, include the week or module number if the document states one.

Return ONLY a valid JSON array, no markdown, no prose:
[
  { "topic": "<short topic name as written>", "week": <week/module number or null> }
]
Keep topic names concise (the heading, not the full description). Maximum 40 topics.`;

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
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: doc.base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  const responseText = data?.content?.[0]?.text;
  if (!responseText) throw new Error('Empty response from Claude API.');

  const parsed = JSON.parse(stripJson(responseText));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((t: any) => t && typeof t.topic === 'string' && t.topic.trim())
    .map((t: any): SchemeTopic => ({
      topic: String(t.topic).trim(),
      week: t.week === null || t.week === undefined ? undefined : t.week,
    }));
};

// A single overlap returned by the semantic comparison (course-pair scoped).
export interface RawTopicOverlap {
  topic_a: string;
  topic_b: string;
  week_a?: number | string;
  week_b?: number | string;
  severity: 'high' | 'medium' | 'low';
  explanation: string;     // why these topics overlap
  recommendation: string;  // short, simple suggestion
}

// Compare two courses' topic lists for OVERLAP, understanding semantic similarity —
// not just identical words (e.g. "Market Segmentation" ↔ "Customer Segmentation").
// Text-only Claude call (cheap, no document upload). Returns [] when nothing overlaps.
export const compareSchemeTopics = async (
  courseA: { name: string; topics: SchemeTopic[] },
  courseB: { name: string; topics: SchemeTopic[] },
): Promise<RawTopicOverlap[]> => {
  if (!courseA.topics.length || !courseB.topics.length) return [];

  const fmt = (ts: SchemeTopic[]) =>
    ts.map(t => `- ${t.topic}${t.week != null ? ` (Week ${t.week})` : ''}`).join('\n');

  const prompt = `You are an academic curriculum reviewer detecting CONTENT OVERLAP between two university courses in the same program.

Compare the topic lists below. Report a pair as an overlap when the topics are the same OR semantically similar (similar meaning / same underlying concept), not only when the words match exactly.
Examples of overlap: "Market Segmentation" ↔ "Customer Segmentation"; "Leadership Styles" ↔ "Management Leadership Approaches"; "Financial Statements" ↔ "Statement of Financial Position"; "Supply and Demand" ↔ "Market Equilibrium Basics".
Do NOT report unrelated topics.

COURSE A — "${courseA.name}":
${fmt(courseA.topics)}

COURSE B — "${courseB.name}":
${fmt(courseB.topics)}

Return ONLY a valid JSON array, no markdown, no prose:
[
  {
    "topic_a": "<exact topic text from Course A>",
    "week_a": <week number from Course A or null>,
    "topic_b": "<exact topic text from Course B>",
    "week_b": <week number from Course B or null>,
    "severity": "high" | "medium" | "low",
    "explanation": "<one short sentence on why this is an overlap>",
    "recommendation": "<one short, simple suggestion for how the two professors should handle it>"
  }
]
Keep explanation and recommendation short and simple. Return [] if there are no overlaps.`;

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
      max_tokens: 3072,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  const responseText = data?.content?.[0]?.text;
  if (!responseText) return [];

  const parsed = JSON.parse(stripJson(responseText));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((o: any) => o && o.topic_a && o.topic_b)
    .map((o: any): RawTopicOverlap => ({
      topic_a: String(o.topic_a).trim(),
      topic_b: String(o.topic_b).trim(),
      week_a: o.week_a === null || o.week_a === undefined ? undefined : o.week_a,
      week_b: o.week_b === null || o.week_b === undefined ? undefined : o.week_b,
      severity: ['high', 'medium', 'low'].includes(o.severity) ? o.severity : 'medium',
      explanation: String(o.explanation ?? '').trim(),
      recommendation: String(o.recommendation ?? '').trim(),
    }));
};

// ── Material Check: curriculum-alignment analysis ─────────────────────────────
// Analyses ONE uploaded course material against the course's accreditation
// standards + Scheme of Work + syllabus + learning objectives, and returns the
// rich MaterialCheckResult the Material Check screen renders. Reuses the SAME
// Claude endpoint/config and document-upload pattern as analyseDocumentWithAI —
// no new key, no new infrastructure. The caller (courseManagement) persists it.
// Thrown error 'FILE_READ_FAILED' lets the UI show the unreadable-file message.

const asStrings = (x: any): string[] =>
  Array.isArray(x) ? x.map((v) => String(v).trim()).filter(Boolean) : [];

const parseMaterialCheck = (text: string): MaterialCheckResult => {
  const p = JSON.parse(stripJson(text));
  const status: MaterialAlignmentStatus =
    ['Aligned', 'Partially Aligned', 'Not Aligned'].includes(p.overallStatus)
      ? p.overallStatus : 'Partially Aligned';
  return {
    overallStatus: status,
    alignmentScore: Math.min(100, Math.max(0, Number(p.alignmentScore) || 0)),
    overallSummary: String(p.overallSummary ?? ''),
    accreditationCheck: {
      coveredStandards: asStrings(p.accreditationCheck?.coveredStandards),
      missingOrWeakStandards: asStrings(p.accreditationCheck?.missingOrWeakStandards),
      explanation: String(p.accreditationCheck?.explanation ?? ''),
    },
    schemeOfWorkCheck: {
      matchedWeeksOrTopics: asStrings(p.schemeOfWorkCheck?.matchedWeeksOrTopics),
      missingTopics: asStrings(p.schemeOfWorkCheck?.missingTopics),
      extraOrUnplannedTopics: asStrings(p.schemeOfWorkCheck?.extraOrUnplannedTopics),
      sequencingIssues: asStrings(p.schemeOfWorkCheck?.sequencingIssues),
      explanation: String(p.schemeOfWorkCheck?.explanation ?? ''),
    },
    learningObjectivesCheck: {
      supportedObjectives: asStrings(p.learningObjectivesCheck?.supportedObjectives),
      unsupportedObjectives: asStrings(p.learningObjectivesCheck?.unsupportedObjectives),
      explanation: String(p.learningObjectivesCheck?.explanation ?? ''),
    },
    gapsAndProblems: asStrings(p.gapsAndProblems),
    recommendations: asStrings(p.recommendations),
  };
};

export interface MaterialAlignmentInput {
  fileUrl: string;
  courseName: string;
  accreditationStandards: string;
  courseSyllabus: string;
  schemeOfWork: string;
  learningObjectives: string;
}

export const analyseMaterialAlignment = async (
  input: MaterialAlignmentInput,
): Promise<MaterialCheckResult> => {

  let doc: { base64: string; mimeType: string };
  try {
    doc = await fetchAsBase64(input.fileUrl);
  } catch {
    throw new Error('FILE_READ_FAILED');
  }

  const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  const mediaType = supportedTypes.includes(doc.mimeType) ? doc.mimeType : 'application/pdf';

  const prompt = `You are an academic accreditation and curriculum alignment assistant for the High Five platform.

Analyze the uploaded teaching material for the course: ${input.courseName}.
The uploaded material is attached as a document — read its full content.

Compare the material against:
1. Accreditation standards: ${input.accreditationStandards}
2. Course syllabus: ${input.courseSyllabus}
3. Scheme of Work: ${input.schemeOfWork}
4. Learning objectives: ${input.learningObjectives}

Return the analysis in this JSON structure only, with no markdown and no code fences:
{
  "overallStatus": "Aligned | Partially Aligned | Not Aligned",
  "alignmentScore": 0,
  "overallSummary": "Short 2-3 sentence summary of the alignment result",
  "accreditationCheck": {
    "coveredStandards": [],
    "missingOrWeakStandards": [],
    "explanation": ""
  },
  "schemeOfWorkCheck": {
    "matchedWeeksOrTopics": [],
    "missingTopics": [],
    "extraOrUnplannedTopics": [],
    "sequencingIssues": [],
    "explanation": ""
  },
  "learningObjectivesCheck": {
    "supportedObjectives": [],
    "unsupportedObjectives": [],
    "explanation": ""
  },
  "gapsAndProblems": [],
  "recommendations": []
}

Rules:
- alignmentScore must be a number from 0 to 100.
- Do not invent accreditation standards.
- Do not invent Scheme of Work topics.
- If something is missing from the provided course data, mention it clearly.
- Keep the feedback clear, academic, practical, and concise.
- Recommendations should be brief and directly useful for the professor.`;

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
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: doc.base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(errData)}`);
  }

  const data = await response.json();
  const responseText = data?.content?.[0]?.text;
  if (!responseText) throw new Error('Empty response from Claude API.');

  return parseMaterialCheck(responseText);
};
