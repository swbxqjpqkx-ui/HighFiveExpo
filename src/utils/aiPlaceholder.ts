/**
 * Placeholder AI analysis functions.
 * Replace these with real AI model calls (e.g. Claude API, OpenAI) when ready.
 * The return structures are production-ready — only the logic inside changes.
 */

import { AIAnalysisResult, AIIssue } from '../types/courseManagement';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Syllabus Analysis ─────────────────────────────────────────────────────────

export const analyseSyllabus = async (
  courseId: string,
  syllabusId: string,
  accreditationType: string,
  programName?: string,
): Promise<AIAnalysisResult> => {
  // TODO: Replace with real AI call.
  // Real implementation will:
  //   1. Fetch syllabus file from Supabase Storage
  //   2. Fetch accreditation_standards from Supabase for accreditationType
  //   3. Fetch program_learning_outcomes for programName
  //   4. Send to AI model with structured prompt
  //   5. Parse and return structured response

  await new Promise(r => setTimeout(r, 600)); // simulate latency

  const issues: AIIssue[] = [
    {
      id: uid(),
      severity: 'critical',
      requirement_code: `${accreditationType}-2.3`,
      requirement_title: 'Curriculum Development & Assurance of Learning',
      description:
        'Learning Outcome 3 (LO3) has no mapped assessment method. Every learning outcome must have at least one direct assessment measure that generates data for Assurance of Learning (AoL) reporting.',
      location: 'Section 4 – Course Learning Outcomes, Page 2',
      outcome_affected: 'LO3 – Apply strategic frameworks to real-world business scenarios',
      recommendation:
        'Add a case analysis assignment or a dedicated exam section that explicitly measures LO3 achievement. Include a rubric with criteria directly linked to this outcome.',
    },
    {
      id: uid(),
      severity: 'warning',
      requirement_code: `${accreditationType}-3.1`,
      requirement_title: 'Assurance of Learning (AoL) Standards',
      description:
        `The syllabus contains only 4 learning outcomes. ${accreditationType} curriculum guidelines for ${programName ?? 'this program'} require core courses to address at least 5 program-level outcomes (PLOs) in total across the degree structure. PLO-5 (Ethical reasoning in business contexts) is not addressed.`,
      location: 'Section 4 – Learning Outcomes, Page 2',
      outcome_affected: 'PLO-5 – Ethical reasoning & corporate responsibility',
      recommendation:
        'Add a learning outcome addressing business ethics or corporate social responsibility, explicitly mapped to PLO-5. This can be integrated into an existing module rather than creating a new one.',
    },
    {
      id: uid(),
      severity: 'warning',
      requirement_code: `${accreditationType}-4.2`,
      requirement_title: 'Intellectual Contributions & Faculty Qualifications',
      description:
        'The required reading list does not include any peer-reviewed research contributions from teaching faculty. Accreditation standards expect course materials to demonstrate faculty engagement with current scholarly research.',
      location: 'Section 7 – Required Readings, Page 4',
      outcome_affected: undefined,
      recommendation:
        'Include 1–2 peer-reviewed journal articles authored or co-authored by course faculty. If no faculty publications are available for this specific topic, include recent articles from top-ranked journals (e.g. JOM, AMJ, SMJ) published within the last 5 years.',
    },
    {
      id: uid(),
      severity: 'info',
      requirement_code: `${accreditationType}-5.1`,
      requirement_title: 'Curriculum Currency',
      description:
        '3 of the 8 required textbooks were published more than 7 years ago. While foundational texts are acceptable, accreditation reviewers expect evidence of curriculum currency.',
      location: 'Section 7 – Required Readings, Pages 4–5',
      outcome_affected: undefined,
      recommendation:
        'Consider supplementing older textbooks with recent journal articles, industry reports, or case studies published within the last 3 years to demonstrate curriculum currency.',
    },
  ];

  const suggestions: string[] = [
    'Create a new case analysis assignment explicitly assessing LO3 with a four-criteria rubric.',
    'Add a short ethics module addressing PLO-5 corporate responsibility without restructuring the syllabus.',
    'Replace older textbook references with recent peer-reviewed articles from 2022–2025.',
  ];

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount  = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - criticalCount * 20 - warningCount * 8);

  return {
    id: uid(),
    course_id: courseId,
    target_id: syllabusId,
    target_type: 'syllabus',
    analysis_type: 'syllabus_check',
    status: 'complete',
    overall_score: score,
    compliance_level: criticalCount > 0 ? 'non_compliant' : warningCount > 0 ? 'partial' : 'full',
    issues,
    suggestions,
    created_at: new Date().toISOString(),
  };
};

// ── Material Analysis ─────────────────────────────────────────────────────────

export const analyseMaterial = async (
  courseId: string,
  materialId: string,
  materialTitle: string,
  accreditationType: string,
): Promise<AIAnalysisResult> => {
  // TODO: Replace with real AI call.
  // Real implementation will:
  //   1. Fetch material file from Supabase Storage
  //   2. Fetch locked syllabus for this course (comparison reference)
  //   3. Fetch accreditation_standards
  //   4. Fetch materials from other courses for overlap detection
  //   5. Send to AI model

  await new Promise(r => setTimeout(r, 400));

  const issues: AIIssue[] = [
    {
      id: uid(),
      severity: 'warning',
      requirement_code: `${accreditationType}-2.3`,
      requirement_title: 'Alignment with Syllabus Learning Outcomes',
      description:
        `The material "${materialTitle}" covers Porter's Five Forces analysis, which is not listed in the locked syllabus learning outcomes. Materials should directly support at least one syllabus LO.`,
      location: 'Slides 12–18',
      outcome_affected: 'LO1 – Identify competitive forces in industry environments',
      recommendation:
        'Annotate slides 12–18 to explicitly reference LO1. Alternatively, add a brief note in slide 12: "This section supports LO1 — Competitive analysis."',
    },
  ];

  const suggestions: string[] = [
    'Add a "Learning Objectives Covered" slide at the start of this deck, mapping each section to the relevant learning outcome.',
  ];

  return {
    id: uid(),
    course_id: courseId,
    target_id: materialId,
    target_type: 'material',
    analysis_type: 'material_check',
    status: 'complete',
    overall_score: 82,
    compliance_level: 'partial',
    issues,
    suggestions,
    created_at: new Date().toISOString(),
  };
};

// ── Cross-Course Overlap Detection ────────────────────────────────────────────

export const detectOverlaps = async (
  courseId: string,
  courseName: string,
  professorId: string,
  professorName: string,
): Promise<void> => {
  // TODO: Replace with real AI call.
  // Real implementation will:
  //   1. Fetch all materials and syllabi across the institution
  //   2. Use embedding similarity to detect topic overlap
  //   3. Fetch accreditation_standards to identify sequencing conflicts
  //   4. Write detected overlaps to overlap_reports table
  //   5. Create course_alerts and professor_tasks for affected professors

  console.log(`[AI] Overlap detection queued for course ${courseId} (${courseName})`);
  console.log(`[AI] This will scan all institution courses and create overlap_reports in Supabase.`);
};

// ── Mock overlap data (used in development before real tables exist) ──────────

export const getMockOverlapReports = (courseId: string, courseName: string, professorName: string) => [
  {
    id: 'or1',
    course_id_a: courseId,
    course_name_a: courseName,
    professor_id_a: 'prof-a',
    professor_name_a: professorName,
    program_a: 'BBA',
    course_id_b: 'course-b-id',
    course_name_b: 'Strategic Marketing MKT301',
    professor_id_b: 'prof-b',
    professor_name_b: 'Prof. Anna Keller',
    program_b: 'BBA',
    overlap_topic: "Porter's Five Forces Analysis",
    description:
      "Both courses cover Porter's Five Forces in significant depth (3+ sessions each). This creates redundant content in the BBA program and conflicts with AACSB curriculum sequencing requirements, which state that core analytical frameworks should be introduced once and built upon, not repeated.",
    document_ref_a: 'Week 3 – Lecture slides, Slides 12–18',
    document_ref_b: 'MKT301 Week 5 – Module 2 slides',
    requirement_ref: 'AACSB-2.3 Curriculum Design & Sequencing',
    severity: 'high' as const,
    status: 'open' as const,
    task_generated: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'or2',
    course_id_a: courseId,
    course_name_a: courseName,
    professor_id_a: 'prof-a',
    professor_name_a: professorName,
    program_a: 'BBA',
    course_id_b: 'course-c-id',
    course_name_b: 'Business Ethics ETH201',
    professor_id_b: 'prof-c',
    professor_name_b: 'Prof. Michael Weber',
    program_b: 'BBA',
    overlap_topic: 'Corporate Social Responsibility (CSR) Frameworks',
    description:
      'Both courses introduce CSR frameworks (Carroll\'s Pyramid, stakeholder theory) without clear differentiation. The BBA curriculum should progress from introduction (ETH201) to application (your course) rather than re-introducing the same frameworks.',
    document_ref_a: 'Week 7 – Case Study: Nestlé CSR Report',
    document_ref_b: 'ETH201 Week 3 – CSR Fundamentals',
    requirement_ref: 'AACSB-3.1 Assurance of Learning Sequencing',
    severity: 'medium' as const,
    status: 'in_discussion' as const,
    task_generated: true,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

export const getMockAlerts = (courseId: string, professorId: string) => [
  {
    id: 'al1',
    course_id: courseId,
    professor_id: professorId,
    type: 'overlap_detected' as const,
    title: 'Content Overlap Detected',
    message:
      "Porter's Five Forces is covered in depth in both your course and MKT301 (Prof. Anna Keller). This violates AACSB-2.3 curriculum sequencing. Action required.",
    severity: 'critical' as const,
    read: false,
    dismissible: false,
    overlap_report_id: 'or1',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'al2',
    course_id: courseId,
    professor_id: professorId,
    type: 'missing_requirement' as const,
    title: 'Syllabus Gap: PLO-5 Not Addressed',
    message:
      'Your syllabus does not address PLO-5 (Ethical reasoning). AACSB requires all BBA core courses to collectively cover all program-level outcomes.',
    severity: 'warning' as const,
    read: false,
    dismissible: false,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'al3',
    course_id: courseId,
    professor_id: professorId,
    type: 'admin_action' as const,
    title: 'Syllabus Approved by Administrator',
    message: 'Your syllabus (Version 1) has been reviewed and approved. The administrator will lock it shortly.',
    severity: 'info' as const,
    read: true,
    dismissible: false,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

export const getMockTasks = (courseId: string, professorId: string) => [
  {
    id: 'tk1',
    course_id: courseId,
    professor_id: professorId,
    overlap_report_id: 'or1',
    type: 'resolve_overlap' as const,
    title: "Resolve overlap: Porter's Five Forces with MKT301",
    description:
      "Contact Prof. Anna Keller to coordinate who covers Porter's Five Forces and who references it as prior knowledge. If unresolved within 7 days, the issue escalates to administrator.",
    status: 'open' as const,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const getMockAISuggestions = (courseId: string) => [
  {
    id: uid(),
    type: 'move_semester' as const,
    title: "Move Porter's Five Forces to prerequisite course",
    description:
      "Porter's Five Forces is a foundational framework better suited to an introductory strategy or business environment course (Semester 1). Your course (Semester 2) could instead assume it as prior knowledge and focus on application to complex, multi-market scenarios — eliminating the overlap with MKT301.",
    action_label: 'Request Admin Approval',
    related_professor_name: 'Prof. Anna Keller',
    related_course_name: 'Strategic Marketing MKT301',
  },
  {
    id: uid(),
    type: 'reduce_content',
    title: 'Reduce CSR content, reference ETH201',
    description:
      "Replace your 3-session CSR introduction with a 1-session recap that explicitly builds on ETH201. Add a note in your syllabus: 'Students are expected to enter with foundational CSR knowledge from ETH201.' This satisfies AACSB-3.1 sequencing and eliminates the ETH201 overlap.",
    action_label: 'Update Syllabus',
    related_professor_name: 'Prof. Michael Weber',
    related_course_name: 'Business Ethics ETH201',
  },
  {
    id: uid(),
    type: 'notify_professor',
    title: 'Coordinate with Prof. Keller on frameworks scope',
    description:
      "A direct message to Prof. Keller proposing that MKT301 covers Porter's analysis in introductory depth while your course covers advanced application with sector-specific examples would resolve the overlap without needing administrator involvement.",
    action_label: 'Send Message',
    related_professor_name: 'Prof. Anna Keller',
    related_course_name: 'Strategic Marketing MKT301',
  },
];
