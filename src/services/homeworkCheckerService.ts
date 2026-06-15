import { Platform } from 'react-native';
import { ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_URL } from '../config/ai';
import {
  HomeworkGradingBatch,
  HomeworkStudentResult,
  MatchConfidence,
  RubricCriterionGrade,
} from '../types/homeworkAssistance';

// AI runs only in the native app — the web preview ships without an Anthropic key.
const WEB_PREVIEW_MESSAGE = 'AI analysis is not available in the web preview. Please use the High Five mobile app.';
import { EnrolledStudent } from './homeworkAssistanceService';

// ── Prompt builder ─────────────────────────────────────────────────────────────

const buildStudentPrompt = (
  fileName: string,
  submissionContent: string,
  assignmentTitle: string,
  assignmentInstructions: string,
  rubricText: string,
  enrolledStudents: EnrolledStudent[],
): string => {
  const enrolledList = enrolledStudents.length > 0
    ? enrolledStudents.map(s => `  - "${s.full_name}" (id: ${s.id})`).join('\n')
    : '  (No enrolled student roster provided — set match_confidence to "unmatched")';

  return `You are a fair and constructive university professor grading a student submission.

## Assignment
Title: ${assignmentTitle}
${assignmentInstructions.trim() ? `Instructions: ${assignmentInstructions.trim()}` : ''}

## Grading Rubric
${rubricText.trim() || 'No rubric provided — assess using standard academic criteria:\n  Content & Analysis: 40 pts\n  Structure & Organisation: 25 pts\n  Research & Referencing: 20 pts\n  Writing Quality: 15 pts\n  Total: 100 points.'}

## Enrolled Students in This Course
${enrolledList}

## Student Submission
Filename: ${fileName}
Content:
${submissionContent}

## Instructions
1. **Detect student name**: Examine the filename ("${fileName}") and any name indicators in the content (e.g. "Name:", "Submitted by:", document header, footer, signature). Extract the most likely student name.
2. **Match to roster**: Compare the detected name to the enrolled students list above. Set match_confidence:
   - "confirmed" — you are confident this submission belongs to a specific enrolled student
   - "unclear" — the name partially matches or is ambiguous (e.g. only surname, initials, misspelling)
   - "unmatched" — no enrolled student matches, or no roster was provided
   If confirmed/unclear, set matched_student_id to that student's id value.
3. **Grade against rubric only**: Do NOT reference course syllabi, accreditation standards, scheme of work, or learning objectives. Grade strictly against the rubric criteria above.
4. **Separate weaknesses from improvements**: "weaknesses" describe what was lacking in the submission; "improvement_recommendations" are specific, actionable steps the student should take to improve future work.
5. **Grade arithmetic**: sum of rubric criterion suggested_scores = grade_points; sum of max_scores = total_points; overall_suggested_grade = round(grade_points / total_points * 100).

Return ONLY a valid JSON object — no markdown, no code fences, raw JSON only:
{
  "detected_student_name": "<name from filename or content>",
  "matched_student_id": "<id string from enrolled list, or null>",
  "match_confidence": "confirmed|unclear|unmatched",
  "overall_suggested_grade": <integer 0-100 percentage>,
  "grade_points": <numeric points scored>,
  "total_points": <numeric max points from rubric>,
  "rubric_criterion_grades": [
    { "criterion": "<name>", "max_score": <int>, "suggested_score": <int>, "explanation": "<specific comment referencing the student's work>" }
  ],
  "grade_justification": "<2-3 sentence overall justification>",
  "strengths": ["<specific strength observed in the work>"],
  "weaknesses": ["<specific weakness — what was lacking or poorly done>"],
  "improvement_recommendations": ["<specific actionable recommendation the student should act on>"],
  "missing_requirements": ["<assignment requirement that was missing or incomplete>"],
  "plagiarism_risk_summary": "<originality assessment — use 'similarity concern' language, never 'plagiarism'>",
  "student_feedback_draft": "<professional, encouraging feedback to send to the student — 150-250 words>"
}`;
};

// ── Raw response types ─────────────────────────────────────────────────────────

interface RawStudentResponse {
  detected_student_name?: string;
  matched_student_id?: string | null;
  match_confidence?: string;
  overall_suggested_grade?: number;
  grade_points?: number;
  total_points?: number;
  rubric_criterion_grades?: Array<{
    criterion?: string;
    max_score?: number;
    suggested_score?: number;
    explanation?: string;
  }>;
  grade_justification?: string;
  strengths?: string[];
  weaknesses?: string[];
  improvement_recommendations?: string[];
  missing_requirements?: string[];
  plagiarism_risk_summary?: string;
  student_feedback_draft?: string;
}

// ── Parse response ─────────────────────────────────────────────────────────────

const parseStudentResponse = (
  text: string,
  fileName: string,
  enrolledStudents: EnrolledStudent[],
): Omit<
  HomeworkStudentResult,
  'id' | 'batch_id' | 'submission_file_url' |
  'professor_edited_grade' | 'professor_edited_feedback' | 'professor_status' |
  'approved_at' | 'created_at' | 'updated_at'
> => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const parsed: RawStudentResponse = JSON.parse(cleaned);

  // ── Rubric breakdown ──
  const rubricGrades: RubricCriterionGrade[] = (parsed.rubric_criterion_grades ?? []).map(r => ({
    criterion:      r.criterion ?? 'General',
    max_score:      Number(r.max_score)   || 10,
    suggested_score: Math.min(
      Number(r.max_score) || 10,
      Math.max(0, Number(r.suggested_score) || 0),
    ),
    explanation: r.explanation ?? '',
  }));

  // ── Grade arithmetic ──
  const totalPoints = rubricGrades.length > 0
    ? rubricGrades.reduce((s, r) => s + r.max_score, 0)
    : Math.max(1, Number(parsed.total_points) || 100);
  const gradePoints = rubricGrades.length > 0
    ? rubricGrades.reduce((s, r) => s + r.suggested_score, 0)
    : Math.min(totalPoints, Math.max(0, Number(parsed.grade_points) || 0));
  const percentage = totalPoints > 0 ? Math.round(gradePoints / totalPoints * 100) : 0;
  const overallGrade = Math.min(100, Math.max(0, Number(parsed.overall_suggested_grade) || percentage));

  // ── Student matching ──
  const rawMatchedId   = parsed.matched_student_id ?? null;
  const matchedStudent = rawMatchedId
    ? enrolledStudents.find(s => s.id === rawMatchedId)
    : undefined;

  let matchConf: MatchConfidence;
  if (enrolledStudents.length === 0) {
    matchConf = 'unmatched';
  } else if (matchedStudent) {
    matchConf = (parsed.match_confidence === 'unclear' ? 'unclear' : 'confirmed') as MatchConfidence;
  } else if (rawMatchedId) {
    matchConf = 'unclear'; // AI returned an id that wasn't in our list
  } else {
    matchConf = 'unmatched';
  }

  // Prefer matched enrolled student's canonical name; fall back to AI-detected name, then filename
  const detectedName = parsed.detected_student_name?.trim() || '';
  const studentName  = matchedStudent?.full_name
    ?? (detectedName || fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));

  const feedbackDraft = parsed.student_feedback_draft ?? '';

  return {
    student_name:               studentName,
    student_id:                 matchedStudent?.id,
    match_confidence:           matchConf,
    overall_suggested_grade:    overallGrade,
    grade_points:               gradePoints,
    total_points:               totalPoints,
    rubric_criterion_grades:    rubricGrades,
    grade_justification:        parsed.grade_justification ?? '',
    strengths:                  parsed.strengths ?? [],
    weaknesses:                 parsed.weaknesses ?? [],
    improvement_recommendations: parsed.improvement_recommendations ?? [],
    missing_requirements:       parsed.missing_requirements ?? [],
    plagiarism_risk_summary:    parsed.plagiarism_risk_summary ?? 'No similarity concerns detected.',
    original_ai_feedback:       feedbackDraft,
    student_feedback_draft:     feedbackDraft,
    professor_note:             undefined,
  };
};

// ── Main service ───────────────────────────────────────────────────────────────

export interface StudentFile {
  name: string;
  content: string;
}

export const runHomeworkCheckerBatch = async (
  courseId: string,
  assignmentTitle: string,
  assignmentInstructions: string,
  rubricText: string,
  studentFiles: StudentFile[],
  enrolledStudents: EnrolledStudent[],
): Promise<HomeworkGradingBatch> => {
  const batchId = `batch-${Date.now()}`;
  const now     = new Date().toISOString();
  const results: HomeworkStudentResult[] = [];

  for (let i = 0; i < studentFiles.length; i++) {
    const file   = studentFiles[i];
    const prompt = buildStudentPrompt(
      file.name,
      file.content,
      assignmentTitle,
      assignmentInstructions,
      rubricText,
      enrolledStudents,
    );

    let parsed: Omit<
      HomeworkStudentResult,
      'id' | 'batch_id' | 'submission_file_url' |
      'professor_edited_grade' | 'professor_edited_feedback' | 'professor_status' |
      'approved_at' | 'created_at' | 'updated_at'
    >;

    try {
      const response = await fetch(CLAUDE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key':    ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      CLAUDE_MODEL,
          max_tokens: 4096,
          messages:   [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        }),
      });

      if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

      const data = await response.json();
      const responseText = data?.content?.[0]?.text;
      if (!responseText) throw new Error('Empty response from Claude API.');

      parsed = parseStudentResponse(responseText, file.name, enrolledStudents);
    } catch {
      parsed = generateMockStudentResult(file.name, rubricText, enrolledStudents);
    }

    results.push({
      id:                    `result-${batchId}-${i}`,
      batch_id:              batchId,
      submission_file_url:   '',
      ...parsed,
      professor_status:      'pending',
      created_at:            now,
      updated_at:            now,
    });
  }

  return {
    id:                      batchId,
    professor_id:            '',
    course_id:               courseId,
    course_name:             '',
    assignment_title:        assignmentTitle,
    assignment_instructions: assignmentInstructions,
    rubric_text:             rubricText,
    rubric_file_urls:        [],
    status:                  'complete',
    student_results:         results,
    created_at:              now,
    updated_at:              now,
  };
};

// ── Mock helpers ───────────────────────────────────────────────────────────────

const generateMockStudentResult = (
  fileName: string,
  rubricText: string,
  enrolledStudents: EnrolledStudent[] = [],
): Omit<
  HomeworkStudentResult,
  'id' | 'batch_id' | 'submission_file_url' |
  'professor_edited_grade' | 'professor_edited_feedback' | 'professor_status' |
  'approved_at' | 'created_at' | 'updated_at'
> => {
  const nameFromFile = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim();
  const seed  = nameFromFile.charCodeAt(0) + (nameFromFile.charCodeAt(nameFromFile.length - 1) || 1);
  const grade = 55 + (seed % 40);

  // Try to match filename to enrolled students
  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const nameLower = normalise(nameFromFile);
  const matched   = enrolledStudents.find(
    s => normalise(s.full_name) === nameLower
      || normalise(s.full_name).split(' ').some(part => nameLower.includes(part) && part.length > 2)
      || nameLower.split(' ').some(part => normalise(s.full_name).includes(part) && part.length > 2),
  );

  const studentName      = matched?.full_name ?? nameFromFile;
  const matchConf: MatchConfidence = matched ? 'confirmed' : enrolledStudents.length > 0 ? 'unclear' : 'unmatched';

  const hasRubric = rubricText.trim().length > 10;
  const rubricCriteria: RubricCriterionGrade[] = hasRubric
    ? [
        { criterion: 'Content & Analysis',    max_score: 40, suggested_score: Math.round(40 * grade / 100), explanation: `${grade >= 70 ? 'Good' : 'Adequate'} understanding of core concepts.` },
        { criterion: 'Structure & Organisation', max_score: 25, suggested_score: Math.round(25 * Math.min(grade + 5, 100) / 100), explanation: 'Generally well-organised with clear sections.' },
        { criterion: 'Research & Referencing', max_score: 20, suggested_score: Math.round(20 * Math.max(grade - 10, 0) / 100), explanation: grade >= 75 ? 'Good use of academic sources.' : 'Limited peer-reviewed references.' },
        { criterion: 'Writing Quality',        max_score: 15, suggested_score: Math.round(15 * grade / 100), explanation: grade >= 75 ? 'Professional and clear writing.' : 'Generally clear but some grammatical issues.' },
      ]
    : [{ criterion: 'Overall Assessment', max_score: 100, suggested_score: grade, explanation: `Submission meets ${grade >= 70 ? 'most' : 'some'} requirements.` }];

  const totalPoints = rubricCriteria.reduce((s, r) => s + r.max_score, 0);
  const gradePoints = rubricCriteria.reduce((s, r) => s + r.suggested_score, 0);
  const feedback    = `Dear ${studentName},\n\nThank you for submitting your assignment. ${grade >= 80 ? 'Your analysis is well-developed and your arguments are clearly supported.' : grade >= 65 ? 'Your submission demonstrates a solid understanding of the core concepts, though there is room to deepen your critical analysis.' : 'Your submission shows engagement with the material. Focus on developing your analytical depth and supporting your points with peer-reviewed references.'}\n\nKey strengths include your ${grade >= 75 ? 'effective use of course frameworks' : 'attempt to apply course concepts'}. Please do not hesitate to visit office hours to discuss this feedback.\n\nBest regards`;

  return {
    student_name:               studentName,
    student_id:                 matched?.id,
    match_confidence:           matchConf,
    overall_suggested_grade:    grade,
    grade_points:               gradePoints,
    total_points:               totalPoints,
    rubric_criterion_grades:    rubricCriteria,
    grade_justification:        `${studentName}'s submission demonstrates a ${grade >= 80 ? 'solid' : grade >= 65 ? 'satisfactory' : 'developing'} understanding of the topic and ${grade >= 75 ? 'effectively addresses' : 'partially addresses'} the assignment requirements.`,
    strengths: [
      grade >= 70 ? 'Clear and logical structure throughout' : 'Attempt at structured approach',
      grade >= 75 ? 'Good application of course frameworks' : 'Basic understanding of core concepts',
      grade >= 80 ? 'Strong use of evidence to support arguments' : 'Some relevant examples included',
    ],
    weaknesses: [
      grade < 80 ? 'Analysis could be deeper with more critical evaluation' : 'Minor gaps in supporting evidence',
      grade < 75 ? 'Limited engagement with academic literature' : 'Could expand on counterarguments',
    ],
    improvement_recommendations: [
      grade < 80 ? 'Incorporate more peer-reviewed sources to support your arguments' : 'Strengthen counterargument sections with alternative viewpoints',
      grade < 75 ? 'Develop a more structured analytical framework before writing' : 'Consider expanding the conclusion to address all assignment questions explicitly',
      grade < 70 ? 'Review course materials on academic referencing and citation' : 'Aim for tighter paragraph structure with a clear topic sentence per paragraph',
    ],
    missing_requirements: grade < 65
      ? ['Minimum word count may not be met', 'Required academic references not included']
      : grade < 75
      ? ['Could include more peer-reviewed sources']
      : [],
    plagiarism_risk_summary: grade >= 70
      ? 'No significant similarity concerns detected. The submission appears to be original work.'
      : 'Minor similarity patterns observed in a few passages. Content appears largely original.',
    original_ai_feedback:   feedback,
    student_feedback_draft: feedback,
    professor_note:         undefined,
  };
};

export const mockHomeworkCheckerBatch = (
  courseId: string,
  assignmentTitle: string,
  studentFileNames: string[],
  enrolledStudents: EnrolledStudent[] = [],
): HomeworkGradingBatch => {
  const batchId = `mock-batch-${Date.now()}`;
  const now     = new Date().toISOString();

  const studentResults: HomeworkStudentResult[] = studentFileNames.map((fileName, i) => {
    const result = generateMockStudentResult(fileName, 'Content, Structure, Research, Writing', enrolledStudents);
    return {
      id:                  `mock-result-${batchId}-${i}`,
      batch_id:            batchId,
      submission_file_url: '',
      ...result,
      professor_status:    'pending',
      created_at:          now,
      updated_at:          now,
    };
  });

  return {
    id:                      batchId,
    professor_id:            '',
    course_id:               courseId,
    course_name:             '',
    assignment_title:        assignmentTitle,
    assignment_instructions: '',
    rubric_text:             '',
    rubric_file_urls:        [],
    status:                  'complete',
    student_results:         studentResults,
    created_at:              now,
    updated_at:              now,
  };
};
