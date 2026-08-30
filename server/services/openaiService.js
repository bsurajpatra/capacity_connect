/**
 * Capacity Connect — OpenAI AI Tutoring & Recommendation Service (Phase 7.1, 7.2 & 7.3)
 *
 * Provides:
 * 1. Educational, concept-level assessment explanations tailored to trainee choices (Phase 7.1)
 * 2. Personalized AI-powered course and learning recommendations (Phase 7.2)
 * 3. Centralized AI Recommendation Hub: Courses, Skills to Develop, Assessment Insights, Next Steps (Phase 7.3)
 * 4. Contextual AI Action Advisors: Skill Improvement Guidance & Course-Specific Rationale (Phase 7.3)
 */

/**
 * Load OpenAI Configuration from Environment Variables
 * Ensures zero hardcoding of API keys, models, base URLs, or timeouts.
 */
const getOpenAiConfig = () => {
  return {
    apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '',
    model: process.env.OPENAI_MODEL ? process.env.OPENAI_MODEL.trim() : 'gpt-4o-mini',
    baseUrl: (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '10000', 10),
  };
};

// In-memory rate limiting map: [userId] -> Array<timestamp>
const userRequestTimestamps = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 15; // Max 15 requests per minute per user

/**
 * Check and enforce in-memory rate limiting for AI requests
 * @param {string} userId - User ObjectId string
 * @returns {{ allowed: boolean, remainingMs?: number }}
 */
const checkRateLimit = (userId) => {
  const now = Date.now();
  const timestamps = userRequestTimestamps.get(userId) || [];

  // Filter timestamps within the rolling window
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = validTimestamps[0];
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
    userRequestTimestamps.set(userId, validTimestamps);
    return { allowed: false, remainingMs: Math.max(remainingMs, 1000) };
  }

  validTimestamps.push(now);
  userRequestTimestamps.set(userId, validTimestamps);
  return { allowed: true };
};

/**
 * Deterministic fallback educational explanation generator (Phase 7.1)
 */
const generateFallbackExplanation = ({
  questionText,
  optionA,
  optionB,
  optionC,
  optionD,
  selectedOption,
  correctOption,
  trainerExplanation,
  skillName,
  isCorrect,
}) => {
  const optionsMap = { A: optionA, B: optionB, C: optionC, D: optionD };
  const selectedText = optionsMap[selectedOption] || `Option ${selectedOption}`;
  const correctText = optionsMap[correctOption] || `Option ${correctOption}`;
  const skillMention = skillName ? ` related to ${skillName}` : '';

  if (isCorrect) {
    return {
      explanation:
        trainerExplanation ||
        `Option ${correctOption} ("${correctText}") is the correct response for this concept${skillMention}.`,
      whyYourAnswerWasCorrect: `You correctly selected Option ${selectedOption} ("${selectedText}"), demonstrating understanding of this core principle.`,
      correctConcept:
        trainerExplanation ||
        `The concept tested by "${questionText}" relies on understanding "${correctText}" as the standard approach in ${skillName || 'this subject'}.`,
      keyTakeaway: `Keep applying this understanding of ${skillName || 'the topic'} in practical scenarios.`,
      studyTip: `Reinforce your knowledge by building a small project or practice exercise utilizing this concept.`,
    };
  }

  return {
    explanation:
      trainerExplanation ||
      `The correct answer is Option ${correctOption} ("${correctText}"). Option ${selectedOption} ("${selectedText}") does not fully address the question prompt.`,
    whyYourAnswerWasWrong: `You chose Option ${selectedOption} ("${selectedText}"), which is incorrect for this question. The question specifically asks regarding "${questionText}".`,
    correctConcept:
      trainerExplanation ||
      `The foundational principle is represented by Option ${correctOption} ("${correctText}"), which accurately reflects best practices${skillMention}.`,
    keyTakeaway: `Remember: "${correctText}" is the correct standard when dealing with ${questionText.toLowerCase().slice(0, 50)}...`,
    studyTip: `Review the course lecture notes and module resources on ${skillName || 'this topic'} before re-attempting.`,
  };
};

/**
 * Generate an educational question-by-question AI explanation (Phase 7.1)
 */
const generateQuestionExplanation = async (context) => {
  const {
    courseTitle,
    moduleTitle,
    assessmentType,
    skillName,
    targetProficiency,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    selectedOption,
    correctOption,
    trainerExplanation,
    marks,
  } = context;

  const isCorrect = String(selectedOption).toUpperCase() === String(correctOption).toUpperCase();
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    return generateFallbackExplanation({
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      selectedOption,
      correctOption,
      trainerExplanation,
      skillName,
      isCorrect,
    });
  }

  const systemPrompt = `You are an educational assessment tutor for the Capacity Connect learning platform.
Your job is to provide clear, constructive, concise, and structured explanations for assessment questions based on the trainee's response, the authoritative correct answer, and the instructor's context.
Explain why the chosen answer was right or wrong without being condescending. Focus on educational concepts, key takeaways, and memorable study tips.

IMPORTANT RULES:
1. Treat the Instructor's Authoritative Explanation as the primary source of truth. Do NOT contradict it.
2. Return ONLY a valid JSON object matching the following structure:
{
  "explanation": "High level summary (2 sentences)",
  ${isCorrect ? '"whyYourAnswerWasCorrect"' : '"whyYourAnswerWasWrong"'}: "Specific constructive analysis explaining why the selected choice was correct/incorrect",
  "correctConcept": "The foundational concept the learner should understand",
  "keyTakeaway": "One clear, memorable rule of thumb",
  "studyTip": "A practical suggestion or mnemonic for mastering this skill"
}`;

  const userPrompt = `Course: ${courseTitle || 'Learning Course'}
Module: ${moduleTitle || 'General'}
Assessment Type: ${assessmentType || 'Assessment'}
Skill: ${skillName || 'Core Topic'} (${targetProficiency || 'General'} level)
Marks: ${marks || 1}

Question:
${questionText}

Options:
A: ${optionA}
B: ${optionB}
C: ${optionC}
D: ${optionD}

Trainee Selected: Option ${selectedOption || 'None (Unanswered)'}
Authoritative Correct Answer: Option ${correctOption}
Instructor's Explanation: ${trainerExplanation || 'None provided'}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}

Please generate the structured JSON explanation.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenAI API responded with status ${response.status}. Falling back.`);
      return generateFallbackExplanation({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        selectedOption,
        correctOption,
        trainerExplanation,
        skillName,
        isCorrect,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);

    return {
      explanation: parsed.explanation || trainerExplanation || 'Here is the conceptual breakdown for this question.',
      whyYourAnswerWasWrong: parsed.whyYourAnswerWasWrong || (!isCorrect ? `Option ${selectedOption} was not the correct answer.` : undefined),
      whyYourAnswerWasCorrect: parsed.whyYourAnswerWasCorrect || (isCorrect ? `Option ${selectedOption} was the correct answer.` : undefined),
      correctConcept: parsed.correctConcept || `The correct answer is Option ${correctOption}.`,
      keyTakeaway: parsed.keyTakeaway || 'Review the core concepts behind this question.',
      studyTip: parsed.studyTip || 'Practice related exercises to reinforce your understanding.',
    };
  } catch (error) {
    console.warn(`OpenAI Service Warning (${error.message}). Using fallback generator.`);
    return generateFallbackExplanation({
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      selectedOption,
      correctOption,
      trainerExplanation,
      skillName,
      isCorrect,
    });
  }
};

const stripNumericSuffix = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  return str.replace(/\b\d{6,}\b/g, '').replace(/\s+\d{6,}$/g, '').replace(/\s{2,}/g, ' ').trim();
};

/**
 * Deterministic fallback recommendation hub generator (Phases 7.2 & 7.3)
 * Synthesizes:
 * 1. Recommended Courses
 * 2. Skills to Develop
 * 3. Assessment Insights
 * 4. Suggested Next Steps
 */
const generateFallbackRecommendations = ({ traineeContext, candidateCourses }) => {
  const verifiedSkillsMap = new Map();
  (traineeContext.verifiedSkills || []).forEach((s) => {
    const sName = stripNumericSuffix(s.name || s).toLowerCase();
    verifiedSkillsMap.set(sName, s.highestProficiency || 'proficient');
  });

  const missingCompetencySkills = new Set();
  const missingSkillToComp = new Map();
  (traineeContext.competencies || []).forEach((comp) => {
    if (comp.status !== 'Demonstrated' && comp.status !== 'Completed') {
      (comp.missingSkills || []).forEach((ms) => {
        const msLower = stripNumericSuffix(ms).toLowerCase();
        missingCompetencySkills.add(msLower);
        missingSkillToComp.set(msLower, comp.name);
      });
    }
  });

  // 1. Recommended Courses
  const scored = (candidateCourses || []).map((course) => {
    let score = 70;
    const alignments = [];
    let priority = 'medium';

    const courseSkills = course.skills || [];
    courseSkills.forEach((cs) => {
      const rawSkill = cs.name || cs.skill?.name || '';
      const cleanSkill = stripNumericSuffix(rawSkill) || 'Technical Skill';
      const sName = cleanSkill.toLowerCase();
      const targetProf = cs.proficiency || 'proficient';
      const currentProf = verifiedSkillsMap.get(sName) || 'Not Acquired';

      alignments.push({
        skill: cleanSkill,
        currentProficiency: currentProf,
        targetProficiency: targetProf.charAt(0).toUpperCase() + targetProf.slice(1),
      });

      if (missingCompetencySkills.has(sName)) {
        score += 15;
        priority = 'high';
      }

      if (currentProf === 'beginner' && targetProf === 'proficient') score += 10;
      if (currentProf === 'proficient' && targetProf === 'advanced') score += 12;
      if (currentProf === 'Not Acquired') score += 8;
    });

    if (course.averageRating >= 4.5) score += 5;
    const matchScore = Math.min(98, Math.max(75, Math.round(score)));
    const primarySkill = courseSkills[0]?.name || courseSkills[0]?.skill?.name || course.category || 'software engineering';
    const cleanPrimarySkill = stripNumericSuffix(primarySkill) || 'technical';

    return {
      courseId: course._id.toString(),
      matchScore,
      reason: `Build practical ${cleanPrimarySkill} capabilities and strengthen your domain architecture skills.`,
      skillAlignment: alignments.length > 0 ? alignments : [
        {
          skill: stripNumericSuffix(course.category) || 'Core Skill',
          currentProficiency: 'Exploring',
          targetProficiency: course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : 'Proficient',
        },
      ],
      learningBenefit: `Completing this course satisfies requirements toward your target competencies and builds verified evidence.`,
      priority,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const recommendations = scored.slice(0, 4);

  // 2. Skills to Develop
  const skillsToDevelop = [];
  missingCompetencySkills.forEach((msLower) => {
    const compName = missingSkillToComp.get(msLower);
    const origSkill = (traineeContext.verifiedSkills || []).find((s) => s.name.toLowerCase() === msLower);
    const curr = origSkill ? origSkill.highestProficiency : 'Not Acquired';
    const capName = msLower.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    skillsToDevelop.push({
      skill: origSkill ? origSkill.name : capName,
      currentProficiency: curr === 'Not Acquired' ? 'None' : curr.charAt(0).toUpperCase() + curr.slice(1),
      targetProficiency: curr === 'beginner' ? 'Proficient' : curr === 'proficient' ? 'Advanced' : 'Proficient',
      reason: `Required to complete your in-progress "${compName}" institutional competency milestone.`,
      priority: 'high',
    });
  });

  // If no missing competency skills, add upgrade suggestions for existing beginner skills
  if (skillsToDevelop.length === 0) {
    (traineeContext.verifiedSkills || []).forEach((vs) => {
      if (vs.highestProficiency === 'beginner') {
        skillsToDevelop.push({
          skill: vs.name,
          currentProficiency: 'Beginner',
          targetProficiency: 'Proficient',
          reason: `Progress from foundational knowledge to proficient execution through advanced course modules.`,
          priority: 'medium',
        });
      }
    });
  }

  // 3. Assessment Insights
  const asm = traineeContext.assessmentSummary || {};
  const assessmentInsights = [];
  if (asm.totalAttempts > 0) {
    assessmentInsights.push({
      type: 'performance_summary',
      title: 'Assessment Mastery Trajectory',
      description: `You have completed ${asm.totalAttempts} assessments with an overall pass rate of ${asm.passRate || 0}% and an average score of ${asm.avgScore || 0}%.`,
      status: (asm.passRate || 0) >= 80 ? 'positive' : 'needs_attention',
    });

    if (asm.weakAreas && asm.weakAreas.length > 0) {
      assessmentInsights.push({
        type: 'weak_area',
        title: 'Focus Areas for Reinforcement',
        description: `Your recent quiz attempts show opportunities for deeper review in: ${asm.weakAreas.join(', ')}.`,
        status: 'warning',
      });
    }
  } else {
    assessmentInsights.push({
      type: 'onboarding',
      title: 'Begin Assessment Benchmarking',
      description: 'Take your first module quiz or course assessment to generate personalized performance insights and gap diagnostics.',
      status: 'neutral',
    });
  }

  // 4. Suggested Next Steps
  const nextSteps = [];
  if (traineeContext.learningSkills && traineeContext.learningSkills.length > 0) {
    const activeSkill = traineeContext.learningSkills[0];
    nextSteps.push({
      step: 1,
      title: `Continue In-Progress Coursework`,
      description: `Complete remaining modules in "${activeSkill.courseTitle}" to advance ${activeSkill.name} towards ${activeSkill.targetProficiency}.`,
      actionUrl: `/trainee/my-courses`,
    });
  }

  if (recommendations.length > 0) {
    const topCourseId = recommendations[0].courseId;
    const topCourse = (candidateCourses || []).find((c) => c._id.toString() === topCourseId);
    nextSteps.push({
      step: nextSteps.length + 1,
      title: `Enroll in Top Recommended Course`,
      description: `Begin "${topCourse?.title || 'recommended course'}" to target critical skill proficiencies and competency milestones.`,
      actionUrl: `/trainee/courses/${topCourseId}`,
    });
  }

  nextSteps.push({
    step: nextSteps.length + 1,
    title: `Attempt Course Assessments & Graduate`,
    description: `Complete final course assessments to verify skills on your transcript and receive signed credentials.`,
    actionUrl: `/trainee/assessments`,
  });

  return {
    recommendations,
    skillsToDevelop: skillsToDevelop.slice(0, 4),
    assessmentInsights,
    nextSteps,
  };
};

/**
 * Generate complete AI recommendation hub payload using OpenAI GPT-4o-mini (Phase 7.2 & 7.3)
 */
const generateCourseRecommendations = async ({ traineeContext, candidateCourses }) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey || !candidateCourses || candidateCourses.length === 0) {
    return generateFallbackRecommendations({ traineeContext, candidateCourses });
  }

  const candidateCourseIdSet = new Set(candidateCourses.map((c) => c._id.toString()));
  const sanitizedCandidates = candidateCourses.map((c) => ({
    courseId: c._id.toString(),
    title: c.title,
    category: c.category,
    level: c.level,
    description: c.description ? c.description.slice(0, 160) : '',
    skills: (c.skills || []).map((s) => ({
      name: s.name || s.skill?.name || '',
      targetProficiency: s.proficiency || 'proficient',
    })),
    prerequisites: c.prerequisites || '',
    averageRating: c.averageRating || 0,
  }));

  const systemPrompt = `You are the AI Learning Advisor for Capacity Connect, an institutional capacity-building platform.
Analyze the trainee's verified skills, current proficiencies, assessment performance, and institutional competencies to generate a complete personalized learning recommendation hub.

CRITICAL RULES:
1. Recommend ONLY courses from the provided Candidate Courses list. NEVER invent course IDs, titles, or URLs.
2. Return ONLY a valid JSON object matching this schema:
{
  "recommendations": [
    {
      "courseId": "<exact candidate courseId>",
      "matchScore": <integer 75 to 99>,
      "reason": "<clear educational justification linking past learning to this course>",
      "skillAlignment": [
        {
          "skill": "<skill name>",
          "currentProficiency": "<e.g. Beginner, Proficient, or Not Acquired>",
          "targetProficiency": "<e.g. Proficient or Advanced>"
        }
      ],
      "learningBenefit": "<specific competency advancement outcome>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "skillsToDevelop": [
    {
      "skill": "<skill name to develop>",
      "currentProficiency": "<current level>",
      "targetProficiency": "<target level: Beginner, Proficient, or Advanced>",
      "reason": "<why this skill is needed based on gaps or competencies>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "assessmentInsights": [
    {
      "type": "performance_summary" | "weak_area" | "strength",
      "title": "<insight headline>",
      "description": "<detailed observation based on assessment scores and pass rate>",
      "status": "positive" | "warning" | "needs_attention" | "neutral"
    }
  ],
  "nextSteps": [
    {
      "step": <integer 1..4>,
      "title": "<action item title>",
      "description": "<concrete action to take next>",
      "actionUrl": "<optional internal app route, e.g. /trainee/my-courses, /trainee/courses/:id, /trainee/assessments>"
    }
  ]
}`;

  const userPrompt = `Trainee Learning Profile:
- Verified Skills: ${JSON.stringify(traineeContext.verifiedSkills || [])}
- Active / In-Progress Skills: ${JSON.stringify(traineeContext.learningSkills || [])}
- In-Progress Competency Frameworks: ${JSON.stringify(traineeContext.competencies || [])}
- Assessment History: ${JSON.stringify(traineeContext.assessmentSummary || {})}
- Completed Courses: ${traineeContext.completedCoursesCount || 0}

Candidate Courses Available:
${JSON.stringify(sanitizedCandidates, null, 2)}

Please generate the comprehensive structured recommendations hub JSON.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenAI Recommendation Hub API responded with status ${response.status}. Using fallback.`);
      return generateFallbackRecommendations({ traineeContext, candidateCourses });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(content);
    const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    // Filter to ensure all course IDs are valid database candidates (anti-hallucination)
    const validRecs = rawRecs.filter((r) => r.courseId && candidateCourseIdSet.has(r.courseId.toString()));

    if (validRecs.length === 0) {
      return generateFallbackRecommendations({ traineeContext, candidateCourses });
    }

    return {
      recommendations: validRecs.map((r) => ({
        courseId: r.courseId,
        matchScore: typeof r.matchScore === 'number' ? Math.min(Math.max(r.matchScore, 70), 99) : 85,
        reason: r.reason || 'Recommended based on your current skill development path.',
        skillAlignment: Array.isArray(r.skillAlignment) ? r.skillAlignment : [],
        learningBenefit: r.learningBenefit || 'Expands your institutional competency portfolio.',
        priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
      })),
      skillsToDevelop: Array.isArray(parsed.skillsToDevelop) && parsed.skillsToDevelop.length > 0
        ? parsed.skillsToDevelop
        : generateFallbackRecommendations({ traineeContext, candidateCourses }).skillsToDevelop,
      assessmentInsights: Array.isArray(parsed.assessmentInsights) && parsed.assessmentInsights.length > 0
        ? parsed.assessmentInsights
        : generateFallbackRecommendations({ traineeContext, candidateCourses }).assessmentInsights,
      nextSteps: Array.isArray(parsed.nextSteps) && parsed.nextSteps.length > 0
        ? parsed.nextSteps
        : generateFallbackRecommendations({ traineeContext, candidateCourses }).nextSteps,
    };
  } catch (error) {
    console.warn(`OpenAI Recommendations warning (${error.message}). Using fallback.`);
    return generateFallbackRecommendations({ traineeContext, candidateCourses });
  }
};

/**
 * Deterministic fallback skill progression guidance (Phase 7.3)
 */
const generateFallbackSkillGuidance = ({ skillName, currentProficiency, targetProficiency, mappedCourses }) => {
  const current = currentProficiency || 'Beginner';
  const target = targetProficiency || (current.toLowerCase() === 'beginner' ? 'Proficient' : 'Advanced');

  return {
    skillName,
    currentProficiency: current,
    targetProficiency: target,
    roadmapTitle: `Advancing ${skillName} to ${target}`,
    progressionSummary: `To progress from ${current} to ${target} in ${skillName}, combine focused coursework with practical exercises and pass the qualifying final examinations.`,
    recommendedActions: [
      `Complete advanced lessons and interactive lab exercises covering ${skillName}.`,
      `Build an end-to-end practical application demonstrating ${skillName} in production scenarios.`,
      `Review lecture transcripts and quizzes targeting tricky edge cases.`,
      `Pass the course final assessment with ≥80% score to verify ${target} proficiency.`,
    ],
    recommendedCourses: (mappedCourses || []).slice(0, 2).map((c) => ({
      courseId: c._id.toString(),
      title: c.title,
      level: c.level,
      category: c.category,
    })),
  };
};

/**
 * Generate contextual skill progression guidance using OpenAI GPT-4o-mini (Phase 7.3)
 */
const generateSkillGuidance = async ({
  traineeContext,
  skillName,
  currentProficiency,
  targetProficiency,
  mappedCourses,
}) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    return generateFallbackSkillGuidance({ skillName, currentProficiency, targetProficiency, mappedCourses });
  }

  const systemPrompt = `You are the AI Learning Advisor for Capacity Connect.
Provide actionable, structured guidance on how a trainee can advance a specific skill from their current proficiency to their target proficiency.

CRITICAL RULES:
1. Return ONLY a valid JSON object matching this schema:
{
  "skillName": "${skillName}",
  "currentProficiency": "${currentProficiency || 'Beginner'}",
  "targetProficiency": "${targetProficiency || 'Proficient'}",
  "roadmapTitle": "<concise title, e.g. Advancing React to Advanced>",
  "progressionSummary": "<2 sentence overview explaining the key focus areas to bridge the gap>",
  "recommendedActions": [
    "<action 1>",
    "<action 2>",
    "<action 3>",
    "<action 4>"
  ]
}`;

  const userPrompt = `Skill: ${skillName}
Current Level: ${currentProficiency || 'Beginner'}
Target Level: ${targetProficiency || 'Proficient'}
Mapped Platform Courses: ${JSON.stringify((mappedCourses || []).map((c) => ({ id: c._id, title: c.title, level: c.level })))}

Please generate the skill progression guidance.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return generateFallbackSkillGuidance({ skillName, currentProficiency, targetProficiency, mappedCourses });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    return {
      skillName,
      currentProficiency: parsed.currentProficiency || currentProficiency,
      targetProficiency: parsed.targetProficiency || targetProficiency,
      roadmapTitle: parsed.roadmapTitle || `Advancing ${skillName} to ${targetProficiency}`,
      progressionSummary: parsed.progressionSummary || `Practical steps to advance your ${skillName} proficiency.`,
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
      recommendedCourses: (mappedCourses || []).slice(0, 2).map((c) => ({
        courseId: c._id.toString(),
        title: c.title,
        level: c.level,
        category: c.category,
      })),
    };
  } catch (err) {
    console.warn(`Skill guidance AI warning (${err.message}). Using fallback.`);
    return generateFallbackSkillGuidance({ skillName, currentProficiency, targetProficiency, mappedCourses });
  }
};

/**
 * Deterministic fallback course-specific recommendation rationale (Phase 7.3)
 */
const generateFallbackCourseRationale = ({ traineeContext, course }) => {
  const verifiedMap = new Map();
  (traineeContext.verifiedSkills || []).forEach((s) => {
    verifiedMap.set(s.name.toLowerCase(), s.highestProficiency);
  });

  const matchingSkills = [];
  const newSkills = [];

  (course.skills || []).forEach((cs) => {
    const sName = cs.name || cs.skill?.name || '';
    if (verifiedMap.has(sName.toLowerCase())) {
      matchingSkills.push({
        skill: sName,
        current: verifiedMap.get(sName.toLowerCase()),
        target: cs.proficiency || 'proficient',
      });
    } else {
      newSkills.push(sName);
    }
  });

  let fitHeadline = `Builds Core Capabilities in ${course.category || 'this domain'}`;
  let whyRecommended = `This course is recommended for your learning pathway because it provides structured training by verified instructors.`;

  if (matchingSkills.length > 0) {
    fitHeadline = `Upgrades Your Existing Skills in ${matchingSkills.map((m) => m.skill).join(', ')}`;
    whyRecommended = `You have foundational experience in ${matchingSkills[0].skill}. This course advances your proficiency to ${matchingSkills[0].target} level.`;
  } else if (newSkills.length > 0) {
    fitHeadline = `Expands Your Profile with New Verified Skills`;
    whyRecommended = `Enrolling in this course enables you to acquire and verify ${newSkills.slice(0, 2).join(' and ')} on your platform transcript.`;
  }

  return {
    courseId: course._id.toString(),
    fitHeadline,
    whyRecommended,
    keyLearningOutcomes: (course.skills || []).map((s) => `Target ${s.proficiency || 'proficient'} mastery in ${s.name || s.skill?.name || 'Skill'}.`),
    competencyRelevance: `Satisfies coursework requirements and builds verified proof-of-work upon passing the final assessment.`,
  };
};

/**
 * Generate contextual course recommendation rationale using OpenAI GPT-4o-mini (Phase 7.3)
 */
const generateCourseRationale = async ({ traineeContext, course }) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    return generateFallbackCourseRationale({ traineeContext, course });
  }

  const systemPrompt = `You are the AI Learning Advisor for Capacity Connect.
Explain to a trainee why a specific course is relevant to their verified learning history and institutional competency targets.

CRITICAL RULES:
1. Return ONLY a valid JSON object matching this schema:
{
  "courseId": "${course._id.toString()}",
  "fitHeadline": "<concise 1-sentence headline highlighting the primary benefit for this learner>",
  "whyRecommended": "<2 sentence personalized explanation referencing trainee's current skills and course fit>",
  "keyLearningOutcomes": [
    "<outcome 1>",
    "<outcome 2>",
    "<outcome 3>"
  ],
  "competencyRelevance": "<1 sentence connecting this course to institutional competency progress>"
}`;

  const userPrompt = `Course Details:
- Title: ${course.title}
- Category: ${course.category}
- Level: ${course.level}
- Target Skills: ${JSON.stringify((course.skills || []).map((s) => ({ name: s.name || s.skill?.name, proficiency: s.proficiency })))}

Trainee Profile:
- Verified Skills: ${JSON.stringify(traineeContext.verifiedSkills || [])}
- In-Progress Competencies: ${JSON.stringify(traineeContext.competencies || [])}

Please generate the personalized course rationale.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return generateFallbackCourseRationale({ traineeContext, course });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    return {
      courseId: course._id.toString(),
      fitHeadline: parsed.fitHeadline || `Recommended for your learning path`,
      whyRecommended: parsed.whyRecommended || `This course builds upon your current verified capabilities.`,
      keyLearningOutcomes: Array.isArray(parsed.keyLearningOutcomes) ? parsed.keyLearningOutcomes : [],
      competencyRelevance: parsed.competencyRelevance || `Builds verified credentials for your transcript.`,
    };
  } catch (err) {
    console.warn(`Course rationale AI warning (${err.message}). Using fallback.`);
    return generateFallbackCourseRationale({ traineeContext, course });
  }
};

/**
 * Deterministic fallback personalized learning path generator (Phase 7.4)
 */
const generateFallbackLearningPath = ({ traineeContext, candidateCourses, activeCourses = [], completedCourses = [] }) => {
  const steps = [];
  let seq = 1;

  const verifiedSkillsMap = new Map();
  (traineeContext.verifiedSkills || []).forEach((s) => {
    verifiedSkillsMap.set((s.name || s).toLowerCase(), (s.highestProficiency || 'proficient').toLowerCase());
  });

  const missingCompSkills = new Set();
  (traineeContext.competencies || []).forEach((comp) => {
    (comp.missingSkills || []).forEach((ms) => {
      const msName = typeof ms === 'string' ? ms : ms.name || '';
      if (msName) missingCompSkills.add(msName.toLowerCase());
    });
  });

  const weakAreasSet = new Set(
    (traineeContext.assessmentSummary?.weakAreas || []).map((w) => (typeof w === 'string' ? w.toLowerCase() : ''))
  );

  // 1. Prioritize In-Progress Active Course (Current Stage)
  if (activeCourses && activeCourses.length > 0) {
    const active = activeCourses[0];
    steps.push({
      sequence: seq++,
      courseId: active._id?.toString() || active.courseId?.toString() || active.course?.toString(),
      title: active.title || active.course?.title || 'In-Progress Coursework',
      status: 'current',
      progress: active.progress || 0,
      skills: (active.skills || []).map((s) => ({
        name: s.name || s.skill?.name || 'Technical Skill',
        currentProficiency: verifiedSkillsMap.get((s.name || s.skill?.name || '').toLowerCase()) || 'Learning',
        targetProficiency: s.proficiency || 'Proficient',
      })),
      priority: 'high',
      reason: `You are currently enrolled (${active.progress || 0}% complete). Prioritize finishing remaining modules and passing the final examination.`,
      actionUrl: `/trainee/courses/${active._id?.toString() || active.courseId?.toString() || active.course?.toString()}`,
    });
  }

  // 2. Prioritize Competency Gap Courses
  const usedCourseIds = new Set(steps.map((s) => s.courseId));
  const compCourses = (candidateCourses || []).filter((c) => {
    const cId = c._id.toString();
    if (usedCourseIds.has(cId)) return false;
    return (c.skills || []).some((s) => {
      const sName = (s.name || s.skill?.name || '').toLowerCase();
      return missingCompSkills.has(sName);
    });
  });

  compCourses.slice(0, 2).forEach((c) => {
    usedCourseIds.add(c._id.toString());
    steps.push({
      sequence: seq++,
      courseId: c._id.toString(),
      title: c.title,
      status: 'recommended',
      skills: (c.skills || []).map((s) => ({
        name: s.name || s.skill?.name || 'Skill',
        currentProficiency: verifiedSkillsMap.get((s.name || s.skill?.name || '').toLowerCase()) || 'Not Acquired',
        targetProficiency: s.proficiency || 'Proficient',
      })),
      priority: 'high',
      reason: `Directly fulfills missing skill requirements for your in-progress institutional competency milestone.`,
      actionUrl: `/trainee/courses/${c._id.toString()}`,
    });
  });

  // 3. Prioritize Assessment Weak Area Courses
  const weakCourses = (candidateCourses || []).filter((c) => {
    const cId = c._id.toString();
    if (usedCourseIds.has(cId)) return false;
    return (
      weakAreasSet.has((c.category || '').toLowerCase()) ||
      (c.skills || []).some((s) => weakAreasSet.has((s.name || s.skill?.name || '').toLowerCase()))
    );
  });

  weakCourses.slice(0, 1).forEach((c) => {
    usedCourseIds.add(c._id.toString());
    steps.push({
      sequence: seq++,
      courseId: c._id.toString(),
      title: c.title,
      status: 'recommended',
      skills: (c.skills || []).map((s) => ({
        name: s.name || s.skill?.name || 'Skill',
        currentProficiency: verifiedSkillsMap.get((s.name || s.skill?.name || '').toLowerCase()) || 'Beginner',
        targetProficiency: s.proficiency || 'Proficient',
      })),
      priority: 'high',
      reason: `Strengthens diagnosed assessment focus areas and reinforces core concepts.`,
      actionUrl: `/trainee/courses/${c._id.toString()}`,
    });
  });

  // 4. Fill with Advanced / Complementary Candidates
  const otherCourses = (candidateCourses || []).filter((c) => !usedCourseIds.has(c._id.toString()));
  otherCourses.slice(0, Math.max(0, 4 - steps.length)).forEach((c) => {
    usedCourseIds.add(c._id.toString());
    steps.push({
      sequence: seq++,
      courseId: c._id.toString(),
      title: c.title,
      status: 'next',
      skills: (c.skills || []).map((s) => ({
        name: s.name || s.skill?.name || 'Skill',
        currentProficiency: verifiedSkillsMap.get((s.name || s.skill?.name || '').toLowerCase()) || 'Beginner',
        targetProficiency: s.proficiency || 'Advanced',
      })),
      priority: 'medium',
      reason: `Expands your portfolio with advanced capabilities in ${c.category || 'this domain'}.`,
      actionUrl: `/trainee/courses/${c._id.toString()}`,
    });
  });

  const goal = traineeContext.competencies?.[0]?.name
    ? `Master Institutional Milestone: ${traineeContext.competencies[0].name}`
    : `Achieve Advanced Proficiency in Core Technical & Domain Skills`;

  const summary = steps.length > 0
    ? `Your customized sequence bridges diagnosed skill gaps and advances your competency profile step-by-step.`
    : `Explore the published course catalog to begin building your personalized learning journey.`;

  return { goal, summary, steps };
};

/**
 * Generate complete personalized learning path using OpenAI GPT-4o-mini (Phase 7.4)
 */
const generateLearningPath = async ({
  traineeContext,
  candidateCourses,
  activeCourses = [],
  completedCourses = [],
}) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey || ((!candidateCourses || candidateCourses.length === 0) && activeCourses.length === 0)) {
    return generateFallbackLearningPath({ traineeContext, candidateCourses, activeCourses, completedCourses });
  }

  const validCourseMap = new Map();
  (candidateCourses || []).forEach((c) => validCourseMap.set(c._id.toString(), c));
  activeCourses.forEach((c) => {
    const cId = c._id?.toString() || c.courseId?.toString() || c.course?.toString();
    if (cId) validCourseMap.set(cId, c);
  });

  const sanitizedCandidates = (candidateCourses || []).map((c) => ({
    courseId: c._id.toString(),
    title: c.title,
    category: c.category,
    level: c.level,
    description: c.description ? c.description.slice(0, 160) : '',
    skills: (c.skills || []).map((s) => ({
      name: s.name || s.skill?.name || '',
      proficiency: s.proficiency || 'proficient',
    })),
    prerequisites: c.prerequisites || '',
  }));

  const sanitizedActive = activeCourses.map((c) => ({
    courseId: c._id?.toString() || c.courseId?.toString() || c.course?.toString(),
    title: c.title || c.course?.title || 'Active Course',
    progress: c.progress || 0,
  }));

  const systemPrompt = `You are the AI Learning Path Architect for Capacity Connect, an institutional capacity-building platform.
Determine the single best, logically ordered learning journey ("What should this trainee learn next, and in what order?").

CRITICAL SEQUENCING RULES:
1. If the trainee has an active enrolled course with incomplete progress, prioritize continuing that course as Step 1.
2. Address diagnosed assessment weak areas and competency missing skills before recommending unrelated advanced courses.
3. Respect proficiency levels: Beginner < Proficient < Advanced. Do not recommend beginner courses for skills already verified as Advanced.
4. Recommend ONLY courses from the provided Candidate or Active Courses list. NEVER invent course IDs or titles.
5. Return ONLY a valid JSON object matching this schema:
{
  "goal": "<concise overarching learning goal, e.g. Full Stack Cloud Engineer Certification>",
  "summary": "<2 sentence explanation of why this sequence makes sense for this learner>",
  "steps": [
    {
      "sequence": 1,
      "courseId": "<exact candidate or active courseId>",
      "title": "<exact course title>",
      "status": "current" | "recommended" | "next" | "locked",
      "skills": [
        {
          "name": "<skill name>",
          "currentProficiency": "<current level>",
          "targetProficiency": "<target level: Beginner, Proficient, or Advanced>"
        }
      ],
      "priority": "high" | "medium" | "low",
      "reason": "<clear educational rationale explaining why this step is sequenced at this position>",
      "actionUrl": "/trainee/courses/<courseId>"
    }
  ]
}`;

  const userPrompt = `Trainee Profile:
- Verified Skills: ${JSON.stringify(traineeContext.verifiedSkills || [])}
- Active Enrollments: ${JSON.stringify(sanitizedActive)}
- Target Competencies: ${JSON.stringify(traineeContext.competencies || [])}
- Assessment History: ${JSON.stringify(traineeContext.assessmentSummary || {})}
- Completed Courses: ${traineeContext.completedCoursesCount || 0}

Candidate Courses Pool:
${JSON.stringify(sanitizedCandidates, null, 2)}

Please synthesize the logically ordered personalized learning path JSON.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Learning Path AI responded with status ${response.status}. Using fallback.`);
      return generateFallbackLearningPath({ traineeContext, candidateCourses, activeCourses, completedCourses });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];

    // Filter to ensure every course ID exists in candidate pool or active courses (anti-hallucination)
    const validSteps = rawSteps.filter((s) => s.courseId && validCourseMap.has(s.courseId.toString()));

    if (validSteps.length === 0) {
      return generateFallbackLearningPath({ traineeContext, candidateCourses, activeCourses, completedCourses });
    }

    return {
      goal: parsed.goal || 'Accelerate Your Institutional Competencies',
      summary: parsed.summary || 'A sequenced learning path tailored to your verified progress and skill gaps.',
      steps: validSteps.map((s, idx) => ({
        sequence: s.sequence || idx + 1,
        courseId: s.courseId.toString(),
        title: s.title || validCourseMap.get(s.courseId.toString())?.title || 'Course Step',
        status: ['completed', 'current', 'recommended', 'next', 'locked'].includes(s.status) ? s.status : 'recommended',
        skills: Array.isArray(s.skills) ? s.skills : [],
        priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
        reason: s.reason || 'Sequenced to build core foundations before advanced modules.',
        actionUrl: `/trainee/courses/${s.courseId.toString()}`,
      })),
    };
  } catch (err) {
    console.warn(`Learning Path AI warning (${err.message}). Using fallback.`);
    return generateFallbackLearningPath({ traineeContext, candidateCourses, activeCourses, completedCourses });
  }
};

/**
 * Deterministic fallback career roadmap skill generator (Phase 7.4.1 Refinement)
 * Generates an ordered skill journey based on platform taxonomy and trainee profile.
 */
const generateFallbackCareerRoadmap = ({
  careerGoal = 'Full Stack Developer',
  traineeContext,
  availableSkills = [],
  availableCompetencies = [],
  activeCourses = [],
  completedCourses = [],
}) => {
  const normalize = (str) => (str || '').replace(/\[.*?\]/g, '').toLowerCase().trim();
  const goalNorm = normalize(careerGoal);

  // 1. Find matching competency from platform taxonomy via token overlap
  let targetCompetency = null;
  let bestScore = -1;
  const goalTokens = goalNorm.split(/\s+/).filter((t) => t.length > 1);

  (availableCompetencies || []).forEach((c) => {
    const cNorm = normalize(c.name);
    let score = 0;
    if (goalNorm === cNorm) {
      score += 50;
    } else if (goalNorm.includes(cNorm) || cNorm.includes(goalNorm)) {
      score += 25;
    }
    const cTokens = cNorm.split(/\s+/).filter((t) => t.length > 1);
    let matchingTokens = 0;
    goalTokens.forEach((gt) => {
      if (cTokens.some((ct) => ct === gt || (gt.length >= 4 && ct.length >= 4 && gt.slice(0, 4) === ct.slice(0, 4)) || ct.startsWith(gt) || gt.startsWith(ct))) {
        matchingTokens++;
      }
    });

    const totalUniqueTokens = new Set([...goalTokens, ...cTokens]).size;
    const jaccard = totalUniqueTokens > 0 ? matchingTokens / totalUniqueTokens : 0;
    score += jaccard * 20;

    if (score > bestScore) {
      bestScore = score;
      targetCompetency = c;
    }
  });

  if (!targetCompetency && availableCompetencies && availableCompetencies.length > 0) {
    targetCompetency = availableCompetencies[0];
  }

  // 2. Map verified skills
  const verifiedMap = new Map();
  (traineeContext?.verifiedSkills || []).forEach((s) => {
    const sName = s.name || s;
    verifiedMap.set(normalize(sName), {
      proficiency: (s.highestProficiency || 'proficient').toLowerCase(),
      name: sName,
    });
  });

  // 3. Extract ordered skills from target competency or skill taxonomy
  const orderedSkills = [];
  const addedSkillNorms = new Set();

  if (targetCompetency && Array.isArray(targetCompetency.skills)) {
    targetCompetency.skills.forEach((s) => {
      const sName = typeof s === 'string' ? s : s.name || '';
      const sNorm = normalize(sName);
      if (sName && !addedSkillNorms.has(sNorm)) {
        addedSkillNorms.add(sNorm);
        orderedSkills.push(sName);
      }
    });
  }

  // Add relevant platform skills if needed
  if (orderedSkills.length < 3 && availableSkills && availableSkills.length > 0) {
    availableSkills.forEach((s) => {
      const sNorm = normalize(s.name);
      if (s.name && !addedSkillNorms.has(sNorm) && orderedSkills.length < 5) {
        addedSkillNorms.add(sNorm);
        orderedSkills.push(s.name);
      }
    });
  }

  // If still empty, supply clean domain defaults based on goal
  if (orderedSkills.length === 0) {
    if (goalNorm.includes('data')) {
      orderedSkills.push('Python', 'SQL & Relational Databases', 'Data Analysis & Pandas', 'Data Visualization', 'Machine Learning');
    } else if (goalNorm.includes('cloud') || goalNorm.includes('devops')) {
      orderedSkills.push('Linux System Administration', 'Docker & Containerization', 'Kubernetes Orchestration', 'CI/CD Pipelines', 'Cloud Architecture (AWS/GCP)');
    } else {
      orderedSkills.push('JavaScript', 'React', 'Node.js', 'MongoDB', 'Full Stack Integration');
    }
  }

  // 4. Construct ordered skill steps
  const steps = orderedSkills.map((sName, idx) => {
    const sNorm = normalize(sName);
    const isVerified = verifiedMap.has(sNorm);

    return {
      order: idx + 1,
      skill: sName,
      reason: isVerified
        ? `You already have verified foundation in ${sName}. Advance towards mastery.`
        : `Essential prerequisite capability for achieving your target career as a ${careerGoal}.`,
      targetProficiency: 'Proficient',
      status: isVerified ? 'completed' : 'upcoming',
      isDemonstrated: isVerified,
      isVerified: isVerified,
    };
  });

  return {
    careerGoal,
    targetCompetency: targetCompetency?.name || 'Institutional Milestone Track',
    summary: `Structured skill progression guiding you step-by-step toward achieving your goal as a ${careerGoal}.`,
    steps,
  };
};

/**
 * AI Career Roadmap Generator (Phase 7.4.1)
 * Focuses purely on ordered skills, leaving course matching strictly to the database.
 */
const generateCareerRoadmap = async ({
  careerGoal = 'Full Stack Developer',
  traineeContext = {},
  availableSkills = [],
  availableCompetencies = [],
  activeCourses = [],
  completedCourses = [],
}) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    return generateFallbackCareerRoadmap({
      careerGoal,
      traineeContext,
      availableSkills,
      availableCompetencies,
      activeCourses,
      completedCourses,
    });
  }

  const sanitizedSkills = (availableSkills || []).map((s) => s.name);
  const sanitizedCompetencies = (availableCompetencies || []).map((c) => ({
    name: c.name,
    skills: (c.skills || []).map((s) => s.name || s),
  }));

  const systemPrompt = `You are the Senior AI Career & Curriculum Architect for Capacity Connect, an institutional capacity-building portal.
The trainee wants to achieve the following career goal: "${careerGoal}".

CRITICAL ARCHITECTURAL RULES:
1. Your sole responsibility is to formulate a structured, logical sequence of SKILLS (e.g. JavaScript -> React -> Node.js -> MongoDB -> Full Stack Development).
2. DO NOT invent, suggest, or mention course names or course titles. The Capacity Connect database will handle matching courses.
3. Order the skills logically (Prerequisites / Fundamentals -> Core Domain Skills -> Advanced / Integration).
4. For each skill, specify:
   - "order": Integer (1, 2, 3...)
   - "skill": Exact skill name (prefer platform skills from taxonomy when applicable)
   - "reason": Clear, concise explanation of why this skill is needed for the career goal
   - "targetProficiency": "Proficient" or "Advanced"
5. Return ONLY a valid JSON object matching this schema:
{
  "careerGoal": "${careerGoal}",
  "targetCompetency": "<most relevant institutional competency from list or domain title>",
  "summary": "<2-3 sentence overview of this skill learning journey>",
  "steps": [
    {
      "order": 1,
      "skill": "<Skill Name, e.g. JavaScript>",
      "reason": "<Why this skill is required at this stage>",
      "targetProficiency": "Proficient" | "Advanced"
    }
  ]
}`;

  const userPrompt = `Target Career Goal: "${careerGoal}"

Trainee Current State:
- Verified Skills: ${JSON.stringify(traineeContext?.verifiedSkills || [])}
- Active Enrolled Courses: ${JSON.stringify(activeCourses.map((c) => ({ title: c.title, progress: c.progress })))}
- Completed Courses Count: ${traineeContext?.completedCoursesCount || 0}

Platform Taxonomies:
- Available Standard Skills: ${JSON.stringify(sanitizedSkills)}
- Available Competencies: ${JSON.stringify(sanitizedCompetencies)}

Please determine the logical ordered skill roadmap.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Career Roadmap AI responded with status ${response.status}. Using fallback.`);
      return generateFallbackCareerRoadmap({
        careerGoal,
        traineeContext,
        availableSkills,
        availableCompetencies,
        activeCourses,
        completedCourses,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : (Array.isArray(parsed.stages) ? parsed.stages : []);

    const validatedSteps = rawSteps.map((st, idx) => ({
      order: st.order || st.sequence || idx + 1,
      skill: st.skill || st.skillName || `Skill ${idx + 1}`,
      reason: st.reason || `Key competency required for ${careerGoal}.`,
      targetProficiency: st.targetProficiency || st.requiredProficiency || 'Proficient',
    }));

    return {
      careerGoal: parsed.careerGoal || careerGoal,
      targetCompetency: parsed.targetCompetency || 'Institutional Career Milestone',
      summary: parsed.summary || `A targeted skill roadmap to help you achieve your career goal as a ${careerGoal}.`,
      steps: validatedSteps.length > 0 ? validatedSteps : generateFallbackCareerRoadmap({ careerGoal, traineeContext, availableSkills, availableCompetencies, activeCourses, completedCourses }).steps,
    };
  } catch (err) {
    console.warn(`Career Roadmap AI error (${err.message}). Using fallback.`);
    return generateFallbackCareerRoadmap({
      careerGoal,
      traineeContext,
      availableSkills,
      availableCompetencies,
      activeCourses,
      completedCourses,
    });
  }
};

/**
 * Deterministic Fallback Adaptive Learning Advisor (Phase 7.5)
 * Analyzes latest trainee state and deterministically decides the next action.
 */
const generateFallbackAdaptiveAdvisor = ({
  careerGoal = 'Full Stack Developer',
  traineeContext = {},
  activeCourses = [],
  completedCourses = [],
  latestAssessments = [],
  failedAssessments = [],
  roadmapSteps = [],
  learningPathSteps = [],
}) => {
  const goal = careerGoal || 'Professional Growth';

  // 1. Priority 1: Incomplete enrolled active course (progress < 100%)
  const incompleteActiveCourses = (activeCourses || []).filter((c) => (c.progress || 0) < 100);

  if (incompleteActiveCourses.length > 0) {
    const active = incompleteActiveCourses[0];
    const progress = active.progress || 0;
    const activeTitle = active.title || 'Enrolled Course';
    const primarySkill = (active.skills && active.skills[0]?.name) || active.category || 'Core Skill';

    return {
      nextAction: {
        type: 'continue_course',
        skill: primarySkill,
        title: `Continue ${activeTitle}`,
        reason: `You are already ${progress}% through this course. Completing it is the most efficient next step toward your ${goal} goal.`,
        priority: 'high',
      },
      insight: `You are currently progressing through ${activeTitle} (${progress}%). Complete remaining modules and the assessment to verify your ${primarySkill} skills and advance your roadmap.`,
      focusArea: active.category || primarySkill,
      urgency: 'immediate',
    };
  }

  // 2. Priority 2: Failed/Weak Assessment Remediation
  if (Array.isArray(failedAssessments) && failedAssessments.length > 0) {
    const weak = failedAssessments[0];
    const weakTitle = weak.title || weak.courseTitle || 'Assessment';
    const weakScore = weak.percentage !== undefined ? `${weak.percentage}%` : 'Below passing threshold';

    return {
      nextAction: {
        type: 'review_assessment',
        skill: weak.courseTitle || 'Assessment Remediation',
        title: `Remediate ${weakTitle}`,
        reason: `Your latest score (${weakScore}) indicates areas for improvement before progressing to subsequent milestones.`,
        priority: 'high',
        assessmentId: weak.assessmentId || weak._id,
        assessmentTitle: weakTitle,
        score: weak.percentage,
      },
      insight: `Your result on ${weakTitle} (${weakScore}) suggests additional review is needed. Review the question explanations and concept notes before re-attempting.`,
      focusArea: weak.courseTitle || 'Conceptual Review',
      urgency: 'immediate',
    };
  }

  // 3. Priority 3: Next uncompleted roadmap skill
  if (Array.isArray(roadmapSteps) && roadmapSteps.length > 0) {
    const nextStep = roadmapSteps.find(
      (st) => !st.isDemonstrated && st.status !== 'Already Demonstrated' && st.status !== 'completed'
    );

    if (nextStep) {
      const skillName = nextStep.skill || nextStep.skillName || 'Next Skill';
      const isAvailable = nextStep.courseAvailable !== false;

      if (!isAvailable) {
        return {
          nextAction: {
            type: 'course_not_available',
            skill: skillName,
            title: `Next Skill: ${skillName}`,
            reason: `This skill is required for your roadmap, but Capacity Connect currently does not have a published course covering this skill.`,
            priority: 'medium',
          },
          insight: `${skillName} is the next milestone on your ${goal} roadmap. Check back as new courses are published by faculty.`,
          focusArea: skillName,
          urgency: 'standard',
        };
      }

      return {
        nextAction: {
          type: 'start_course',
          skill: skillName,
          title: `Start ${skillName}`,
          reason: nextStep.reason || `Essential capability for achieving your target as a ${goal}.`,
          priority: 'high',
        },
        insight: `You have completed prior requirements and are ready to advance to ${skillName} (${nextStep.targetProficiency || 'Proficient'}). Enroll in the recommended course to continue your journey.`,
        focusArea: skillName,
        urgency: 'standard',
      };
    }
  }

  // 4. Priority 4: All milestones mastered
  return {
    nextAction: {
      type: 'no_action',
      skill: 'Roadmap Completed',
      title: 'Milestones Mastered',
      reason: `You have completed all active milestones for ${goal}!`,
      priority: 'low',
    },
    insight: `Outstanding progress! You have verified proficiency across your active learning trajectory. You can explore additional elective courses or set a new career milestone.`,
    focusArea: 'Mastery & Continued Learning',
    urgency: 'optional',
  };
};

/**
 * Generate Adaptive Learning Advisor via OpenAI (Phase 7.5)
 * Analyzes latest trainee state and generates actionable guidance.
 */
const generateAdaptiveAdvisor = async ({
  careerGoal = 'Full Stack Developer',
  traineeContext = {},
  activeCourses = [],
  completedCourses = [],
  latestAssessments = [],
  failedAssessments = [],
  roadmapSteps = [],
  learningPathSteps = [],
}) => {
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey || apiKey.length < 10) {
    return generateFallbackAdaptiveAdvisor({
      careerGoal,
      traineeContext,
      activeCourses,
      completedCourses,
      latestAssessments,
      failedAssessments,
      roadmapSteps,
      learningPathSteps,
    });
  }

  try {
    const verifiedSkillsList = (traineeContext.verifiedSkills || [])
      .map((s) => `${s.name} (${s.highestProficiency || 'proficient'})`)
      .join(', ') || 'None yet';

    const activeCoursesList = (activeCourses || [])
      .map((c) => `${c.title} (${c.progress || 0}% progress, Category: ${c.category || 'General'})`)
      .join('; ') || 'None';

    const recentAssessmentsList = (latestAssessments || [])
      .slice(0, 5)
      .map((a) => `${a.title || a.courseTitle || 'Assessment'}: ${a.percentage}% (${a.passed ? 'PASSED' : 'FAILED'})`)
      .join('; ') || 'None';

    const roadmapSequence = (roadmapSteps || [])
      .map((s, idx) => `${idx + 1}. ${s.skill} [Status: ${s.status || (s.isDemonstrated ? 'Demonstrated' : 'Pending')}]`)
      .join('\n') || 'None';

    const systemPrompt = `You are the Adaptive AI Learning Advisor for Capacity Connect, an advanced institutional career and skills intelligence platform.
Your task is to analyze the trainee's real-time state and provide ONE single, most effective NEXT ACTION and educational INSIGHT.

Decision Priority Rules:
1. If the trainee is currently enrolled in an incomplete course (progress < 100%), prioritize finishing it ("continue_course").
2. If the trainee recently failed an assessment (score < 70%), prioritize remediation and reviewing weak areas ("review_assessment" or "retry_assessment").
3. If previous steps are completed, identify the next unmastered skill on their career roadmap ("start_course" or "learn_skill").
4. If all roadmap steps are mastered, state ("no_action") with congratulations.

Strict Constraints:
- Output valid JSON only.
- Output ONLY pure skill names or focus concepts in "nextAction.skill".
- Do NOT fabricate course titles or course IDs. The platform database resolves all courses.
- Explanations must be concise, direct, and actionable.

JSON Schema:
{
  "nextAction": {
    "type": "continue_course" | "start_course" | "review_assessment" | "retry_assessment" | "learn_skill" | "no_action",
    "skill": "Exact skill name",
    "title": "Clear action title",
    "reason": "Why this specific action is the optimal next step",
    "priority": "high" | "medium" | "low"
  },
  "insight": "Concise 2-3 sentence educational explanation detailing context, progress, and upcoming trajectory.",
  "focusArea": "Primary subject or capability domain",
  "urgency": "immediate" | "standard" | "optional"
}`;

    const userPrompt = `Trainee State Assessment:
- Career Goal: "${careerGoal || 'Full Stack Developer'}"
- Verified Skills: ${verifiedSkillsList}
- Active Enrollments: ${activeCoursesList}
- Recent Assessment History: ${recentAssessmentsList}
- Career Roadmap Progression:
${roadmapSequence}

Analyze this learner's situation and return the JSON response specifying their immediate next learning action.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Adaptive Advisor AI responded with status ${response.status}. Using fallback.`);
      return generateFallbackAdaptiveAdvisor({
        careerGoal,
        traineeContext,
        activeCourses,
        completedCourses,
        latestAssessments,
        failedAssessments,
        roadmapSteps,
        learningPathSteps,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    if (!parsed.nextAction || !parsed.nextAction.type) {
      throw new Error('Invalid JSON structure from AI');
    }

    return {
      nextAction: {
        type: parsed.nextAction.type,
        skill: parsed.nextAction.skill || 'Next Step',
        title: parsed.nextAction.title || 'Recommended Action',
        reason: parsed.nextAction.reason || 'Optimal progression step for your profile.',
        priority: parsed.nextAction.priority || 'high',
      },
      insight: parsed.insight || 'Continuous learning analysis updated based on your recent platform activity.',
      focusArea: parsed.focusArea || parsed.nextAction.skill || 'Skill Development',
      urgency: parsed.urgency || 'standard',
    };
  } catch (err) {
    console.warn(`Adaptive Advisor AI error (${err.message}). Using fallback.`);
    return generateFallbackAdaptiveAdvisor({
      careerGoal,
      traineeContext,
      activeCourses,
      completedCourses,
      latestAssessments,
      failedAssessments,
      roadmapSteps,
      learningPathSteps,
    });
  }
};

/**
 * Deterministic fallback for Course Doubt Assistant
 */
const generateFallbackCourseDoubt = ({ course, question, traineeName }) => {
  const qLower = (question || '').toLowerCase();
  const title = course?.title || 'this course';
  const category = course?.category || 'technology';
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const skills = Array.isArray(course?.skills)
    ? course.skills.map((s) => (typeof s === 'string' ? s : s.name || s.skill?.name || '')).filter(Boolean)
    : [];

  let matchedModule = null;
  for (const m of modules) {
    const mTitle = (m.title || '').toLowerCase();
    if (qLower.includes(mTitle) || (mTitle && qLower.split(' ').some((w) => w.length > 3 && mTitle.includes(w)))) {
      matchedModule = m;
      break;
    }
  }

  let answer = '';
  let followUps = [];

  if (qLower.includes('summar') || qLower.includes('overview') || qLower.includes('what is this course') || qLower.includes('tell me about')) {
    answer = `### 📘 Course Overview: "${title}"\n\n` +
      `This course provides structured learning in **${category}**.\n\n` +
      `**Key Details:**\n` +
      `• **Curriculum Structure:** ${modules.length} hands-on modules designed for systematic progression.\n` +
      (skills.length > 0 ? `• **Target Skills:** ${skills.join(', ')}\n` : '') +
      `• **Proficiency Target:** Pass the final assessment with 80%+ to earn an official certificate and verify skills in your passport.\n\n` +
      (course?.description ? `*Summary:* ${course.description}\n\n` : '') +
      `**Next Step:** Explore Module 1 and check the resources tab before attempting the module quiz!`;
    followUps = [
      'What are the course prerequisites?',
      'How is the final assessment structured?',
      'Which skills will I earn upon completion?'
    ];
  } else if (qLower.includes('prerequisite') || qLower.includes('requirement') || qLower.includes('who is this for')) {
    answer = `### 🎯 Prerequisites & Target Audience for "${title}"\n\n` +
      `• **Course Level:** ${course?.level || 'General / All Levels'}\n` +
      `• **Domain:** ${category}\n` +
      `• **Preparation:** Basic familiarity with ${skills.slice(0, 2).join(' and ') || 'fundamental domain concepts'} is helpful. The modules guide you step-by-step from fundamentals to advanced application.`;
    followUps = [
      'What is covered in Module 1?',
      'How do I earn my certificate?',
      'What resources are available for this course?'
    ];
  } else if (qLower.includes('quiz') || qLower.includes('exam') || qLower.includes('assessment') || qLower.includes('certificate')) {
    answer = `### 🏆 Assessment & Certification Guide for "${title}"\n\n` +
      `1. **Module Quizzes:** After studying module lessons and resources, complete the quiz to lock in your progress.\n` +
      `2. **Graduation Exam:** Complete all course modules to unlock the final course assessment.\n` +
      `3. **Passing Standard:** Score **80% or higher** to graduate.\n` +
      `4. **Certificate Issuance:** Passing instantly generates a tamper-evident digital certificate with ID and updates your Skill Passport.\n\n` +
      `*Tip: If you score below 80%, review the AI diagnostic feedback and re-attempt!*`;
    followUps = [
      'Can I retake assessments if I fail?',
      'How does AI explain my quiz results?',
      'Which skills get verified upon passing?'
    ];
  } else if (matchedModule) {
    answer = `### 📖 Module Focus: "${matchedModule.title}"\n\n` +
      (matchedModule.description ? `**Description:** ${matchedModule.description}\n\n` : '') +
      `**How to Master this Module:**\n` +
      `1. **Review Materials:** Check all attachments and slides in the resources section.\n` +
      `2. **Practice Hands-on:** Apply the concepts in a code environment or practical scenario.\n` +
      `3. **Take Quiz:** Test your understanding with the module quiz to track completion.`;
    followUps = [
      `What resources are attached to ${matchedModule.title}?`,
      'How do I test my knowledge on this module?',
      'What is the next topic after this?'
    ];
  } else {
    answer = `### 💡 Course Guidance for "${title}"\n\n` +
      `Regarding your question: *"${question}"*\n\n` +
      `• **Concept Context:** In this course, concepts revolve around **${skills.join(', ') || category}**.\n` +
      `• **Best Practice:** Break complex topics into modular components, test each step, and verify against course lesson materials.\n` +
      `• **Curriculum Pointer:** Check the curriculum modules on the left to review specific lecture notes and exercises.\n\n` +
      `Feel free to ask more specific questions about any module topic or code snippet!`;
    followUps = [
      'Can you explain this in simpler terms?',
      'Give me a practical example',
      'What are common mistakes to avoid in this course?'
    ];
  }

  return {
    answer,
    suggestedFollowUps: followUps,
    source: 'fallback',
  };
};

/**
 * Contextual Course Doubt AI Assistant (Chatbot Q&A)
 */
const answerCourseDoubt = async ({ course, question, history = [], traineeName = 'Trainee', userId }) => {
  if (userId && !checkRateLimit(userId).allowed) {
    return generateFallbackCourseDoubt({ course, question, traineeName });
  }

  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();
  if (!apiKey) {
    return generateFallbackCourseDoubt({ course, question, traineeName });
  }

  try {
    const modulesSummary = (course.modules || [])
      .map((m, i) => `Module ${i + 1}: "${m.title}" - ${m.description || ''}`)
      .join('\n');

    const skillsSummary = (course.skills || [])
      .map((s) => (typeof s === 'string' ? s : s.name || s.skill?.name || ''))
      .filter(Boolean)
      .join(', ');

    const systemPrompt =
      `You are an expert AI Teaching Assistant for Capacity Connect, embedded directly inside the course: "${course.title}".\n` +
      `Your role is to answer trainee questions, resolve doubts, explain concepts clearly with examples and code snippets when helpful, and guide them through their learning.\n\n` +
      `COURSE CONTEXT:\n` +
      `- Title: ${course.title}\n` +
      `- Category: ${course.category || 'General'}\n` +
      `- Level: ${course.level || 'Intermediate'}\n` +
      `- Description: ${course.description || 'Comprehensive training course.'}\n` +
      `- Skills Mapped: ${skillsSummary || 'Course domain skills'}\n` +
      `- Modules:\n${modulesSummary || 'Structured curriculum modules'}\n\n` +
      `RESPONSE INSTRUCTIONS:\n` +
      `1. Be encouraging, clear, and pedagogically precise.\n` +
      `2. Format your response cleanly using markdown (bold headings, bullet points, and code blocks when applicable).\n` +
      `3. At the end of your response, provide a JSON-like list of 3 brief follow-up questions the trainee might want to ask next in this exact JSON block at the very end:\n` +
      `\`\`\`json\n{"suggestedFollowUps": ["Follow up 1?", "Follow up 2?", "Follow up 3?"]}\n\`\`\``;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Include recent history (last 6 messages)
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-6);
      for (const turn of recentHistory) {
        if (turn.role && turn.content) {
          messages.push({
            role: turn.role === 'assistant' ? 'assistant' : 'user',
            content: String(turn.content).slice(0, 1000),
          });
        }
      }
    }

    messages.push({ role: 'user', content: question });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 12000);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Course Doubt AI responded with status ${response.status}. Using fallback.`);
      return generateFallbackCourseDoubt({ course, question, traineeName });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    let suggestedFollowUps = [
      'Can you give a practical example?',
      'How does this relate to the final assessment?',
      'What are the key best practices to remember?'
    ];

    // Extract suggestedFollowUps if present in json block
    const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.suggestedFollowUps)) {
          suggestedFollowUps = parsed.suggestedFollowUps;
        }
        content = content.replace(/```json\s*\{[\s\S]*?\}\s*```/, '').trim();
      } catch (e) {
        // ignore parse error
      }
    }

    return {
      answer: content,
      suggestedFollowUps,
      source: 'ai',
    };
  } catch (err) {
    console.warn(`Course Doubt AI error (${err.message}). Using fallback.`);
    return generateFallbackCourseDoubt({ course, question, traineeName });
  }
};

/**
 * Deterministic fallback for Trainer Teaching Assistant Insights (Portfolio-wide)
 */
const generateFallbackTrainerAiTeachingInsights = ({
  trainerContext,
  courses = [],
  assessments = [],
  questionStats = [],
  dropOffStats = [],
  skillStats = [],
  supportStats = [],
}) => {
  const trainerName = trainerContext?.name || 'Trainer';
  const totalCourses = courses.length;
  const totalLearners = trainerContext?.totalLearners || 0;

  // 1. Overall Summary
  let summary = '';
  const struggleSkills = skillStats.filter((s) => s.difficulty === 'high' || s.difficulty === 'moderate');
  if (struggleSkills.length > 0) {
    const topNames = struggleSkills.slice(0, 3).map((s) => s.name).join(', ');
    summary = `Your learners are engaging across ${totalCourses} ${totalCourses === 1 ? 'course' : 'courses'}, demonstrating strength in foundational topics while experiencing difficulty in ${topNames}.`;
  } else {
    summary = `Your learners are making consistent progress across ${totalCourses} ${totalCourses === 1 ? 'course' : 'courses'} with steady curriculum completion and assessment performance.`;
  }

  // 2. Difficulty Areas
  const difficultyAreas = questionStats.slice(0, 4).map((q) => {
    const severity = q.accuracyPercentage < 45 ? 'high' : q.accuracyPercentage < 65 ? 'medium' : 'low';
    return {
      topic: q.topic || q.questionText || 'Concept Check',
      assessmentTitle: q.assessmentTitle,
      courseTitle: q.courseTitle,
      accuracyPercentage: q.accuracyPercentage,
      attempts: q.totalAttempts,
      incorrectCount: q.incorrectCount,
      severity,
      insight: `${q.accuracyPercentage}% accuracy across ${q.totalAttempts} ${q.totalAttempts === 1 ? 'attempt' : 'attempts'}. This question appears to be a difficulty point for learners; reviewing practical examples prior to testing may reinforce comprehension.`,
    };
  });

  // 3. Drop-off Insights
  const dropOffInsights = dropOffStats.slice(0, 3).map((d) => ({
    courseTitle: d.courseTitle,
    moduleTitle: d.moduleTitle,
    enrolledCount: d.enrolledCount,
    completedCount: d.completedCount,
    completionPercentage: d.completionPercentage,
    reason: `Module completion drops to ${d.completionPercentage}% (${d.completedCount}/${d.enrolledCount} learners). This may indicate that learners encounter conceptual complexity or pacing friction at this stage.`,
  }));

  // 4. Skill Difficulty Breakdown
  const skillInsights = skillStats.slice(0, 6).map((s) => ({
    skill: s.name,
    category: s.category || 'Technical',
    difficulty: s.difficulty, // 'high', 'moderate', 'demonstrated'
    passRate: s.passRate,
    coursesMapped: s.courseCount,
    reason: s.difficulty === 'high'
      ? `High difficulty observed (${s.passRate}% assessment success). Consider providing additional scaffolding or interactive drills.`
      : s.difficulty === 'moderate'
      ? `Moderate difficulty (${s.passRate}% assessment success). Most learners progress with supplementary code walkthroughs.`
      : `Mostly demonstrated (${s.passRate}% assessment success). Learners are consistently validating competency in this skill area.`,
  }));

  // 5. Teaching Suggestions
  const teachingSuggestions = [];
  if (difficultyAreas.length > 0) {
    const topArea = difficultyAreas[0];
    teachingSuggestions.push({
      type: 'assessment_review',
      title: `Reinforce ${topArea.topic.slice(0, 45)} before testing`,
      action: `Consider adding supplementary examples or a quick knowledge-check quiz for "${topArea.topic}" in ${topArea.courseTitle}.`,
      priority: 'high',
      courseTitle: topArea.courseTitle,
      assessmentTitle: topArea.assessmentTitle,
    });
  }

  if (dropOffInsights.length > 0) {
    const topDrop = dropOffInsights[0];
    teachingSuggestions.push({
      type: 'curriculum_scaffolding',
      title: `Add practice material for "${topDrop.moduleTitle}"`,
      action: `Break down the material in "${topDrop.moduleTitle}" into smaller milestone steps to help reduce drop-off in ${topDrop.courseTitle}.`,
      priority: 'medium',
      courseTitle: topDrop.courseTitle,
    });
  }

  if (struggleSkills.length > 0) {
    const topSkill = struggleSkills[0];
    teachingSuggestions.push({
      type: 'skill_exercise',
      title: `Provide targeted exercises for ${topSkill.name}`,
      action: `Learners are experiencing high friction demonstrating "${topSkill.name}". An optional hands-on lab or reference guide would improve outcomes.`,
      priority: 'medium',
    });
  }

  if (teachingSuggestions.length === 0) {
    teachingSuggestions.push({
      type: 'general_maintenance',
      title: 'Maintain current instructional pace',
      action: 'Curriculum metrics indicate healthy learner progression across published modules and quizzes.',
      priority: 'low',
    });
  }

  // 6. Learners Needing Support
  const learnerSupport = supportStats.slice(0, 5).map((l) => ({
    traineeId: l.traineeId,
    traineeName: l.traineeName,
    courseTitle: l.courseTitle,
    failedAttemptsCount: l.failedAttemptsCount,
    latestScore: l.latestScore,
    progress: l.progress,
    reason: `${l.traineeName} has attempted the assessment ${l.failedAttemptsCount} times (latest score: ${l.latestScore}%) and may benefit from targeted review.`,
  }));

  return {
    summary,
    difficultyAreas,
    dropOffInsights,
    skillInsights,
    teachingSuggestions,
    learnerSupport,
    metricsSummary: {
      totalCourses,
      totalLearners,
      evaluatedQuestionsCount: questionStats.length,
      dropOffDetectedCount: dropOffStats.length,
      strugglingLearnersCount: supportStats.length,
    },
    source: 'fallback',
  };
};

/**
 * Generate AI Trainer Teaching Insights (Portfolio-wide) via OpenAI
 */
const generateTrainerAiTeachingInsights = async ({
  trainerContext,
  courses = [],
  assessments = [],
  questionStats = [],
  dropOffStats = [],
  skillStats = [],
  supportStats = [],
  userId,
}) => {
  if (userId && !checkRateLimit(userId).allowed) {
    return generateFallbackTrainerAiTeachingInsights({
      trainerContext,
      courses,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }

  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();
  if (!apiKey) {
    return generateFallbackTrainerAiTeachingInsights({
      trainerContext,
      courses,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }

  try {
    const systemPrompt =
      `You are an expert AI Teaching Assistant for Capacity Connect. You are assisting instructor: "${trainerContext.name || 'Trainer'}".\n` +
      `Your task is to analyze real learner performance data across the trainer's authorized courses and generate clear, pedagogical insights and teaching suggestions.\n\n` +
      `CRITICAL RULES:\n` +
      `1. DO NOT invent or fabricate statistics, learner counts, course names, or percentages. Use the exact data provided in the prompt.\n` +
      `2. Keep insights constructive, respectful, and focused purely on instructional effectiveness and learner mastery.\n` +
      `3. Use language indicating correlation rather than certainty ("may indicate", "suggests", "appears to", "worth reviewing").\n` +
      `4. Provide actionable, practical teaching suggestions that the trainer can choose to implement.\n` +
      `5. Return ONLY a valid JSON object matching the requested schema.`;

    const userPayload = {
      trainer: {
        name: trainerContext.name,
        totalCourses: courses.length,
        totalLearners: trainerContext.totalLearners || 0,
      },
      courses: courses.map((c) => ({
        id: c._id,
        title: c.title,
        category: c.category,
        level: c.level,
        enrollmentCount: c.enrollmentCount,
        completionPercentage: c.completionPercentage,
        averageAssessmentScore: c.averageAssessmentScore,
      })),
      topDifficultyQuestions: questionStats.slice(0, 5),
      moduleDropOffs: dropOffStats.slice(0, 4),
      skillPerformance: skillStats.slice(0, 8),
      learnersNeedingSupport: supportStats.slice(0, 5).map((l) => ({
        traineeName: l.traineeName,
        courseTitle: l.courseTitle,
        failedAttempts: l.failedAttemptsCount,
        latestScore: l.latestScore,
        progress: l.progress,
      })),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 12000);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analyze the following trainer performance data and return a JSON object with keys:\n` +
              `{\n` +
              `  "summary": "2-3 sentence overview of learner strengths and friction points",\n` +
              `  "difficultyAreas": [{"topic": "...", "severity": "high|medium|low", "insight": "..."}],\n` +
              `  "dropOffInsights": [{"moduleTitle": "...", "courseTitle": "...", "reason": "..."}],\n` +
              `  "skillInsights": [{"skill": "...", "difficulty": "high|moderate|demonstrated", "reason": "..."}],\n` +
              `  "teachingSuggestions": [{"type": "...", "title": "...", "action": "...", "priority": "high|medium|low"}],\n` +
              `  "learnerSupport": [{"traineeName": "...", "reason": "..."}]\n` +
              `}\n\nDATA:\n${JSON.stringify(userPayload)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Trainer AI Teaching Assistant responded with status ${response.status}. Using fallback.`);
      return generateFallbackTrainerAiTeachingInsights({
        trainerContext,
        courses,
        assessments,
        questionStats,
        dropOffStats,
        skillStats,
        supportStats,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);

    // Merge validated deterministic metrics with AI interpretation
    return {
      summary: parsed.summary || 'Learner performance analyzed across your published curriculum.',
      difficultyAreas: Array.isArray(parsed.difficultyAreas) && parsed.difficultyAreas.length > 0
        ? parsed.difficultyAreas.map((d, idx) => {
            const match = questionStats[idx] || {};
            return {
              topic: d.topic || match.topic || match.questionText || 'Concept Area',
              assessmentTitle: match.assessmentTitle || '',
              courseTitle: match.courseTitle || '',
              accuracyPercentage: match.accuracyPercentage || 0,
              attempts: match.totalAttempts || 0,
              incorrectCount: match.incorrectCount || 0,
              severity: d.severity || (match.accuracyPercentage < 50 ? 'high' : 'medium'),
              insight: d.insight || `${match.accuracyPercentage}% accuracy. Consider reviewing this concept with learners.`,
            };
          })
        : generateFallbackTrainerAiTeachingInsights({ trainerContext, courses, assessments, questionStats, dropOffStats, skillStats, supportStats }).difficultyAreas,
      dropOffInsights: Array.isArray(parsed.dropOffInsights) && parsed.dropOffInsights.length > 0
        ? parsed.dropOffInsights.map((d, idx) => {
            const match = dropOffStats[idx] || {};
            return {
              courseTitle: d.courseTitle || match.courseTitle || '',
              moduleTitle: d.moduleTitle || match.moduleTitle || '',
              enrolledCount: match.enrolledCount || 0,
              completedCount: match.completedCount || 0,
              completionPercentage: match.completionPercentage || 0,
              reason: d.reason || `Module completion drops to ${match.completionPercentage}%.`,
            };
          })
        : generateFallbackTrainerAiTeachingInsights({ trainerContext, courses, assessments, questionStats, dropOffStats, skillStats, supportStats }).dropOffInsights,
      skillInsights: Array.isArray(parsed.skillInsights) && parsed.skillInsights.length > 0
        ? parsed.skillInsights.map((s, idx) => {
            const match = skillStats[idx] || {};
            return {
              skill: s.skill || match.name || 'Skill',
              category: match.category || 'Technical',
              difficulty: s.difficulty || match.difficulty || 'moderate',
              passRate: match.passRate || 0,
              coursesMapped: match.courseCount || 1,
              reason: s.reason || `Learners have demonstrated ${match.passRate}% pass rate in this skill.`,
            };
          })
        : generateFallbackTrainerAiTeachingInsights({ trainerContext, courses, assessments, questionStats, dropOffStats, skillStats, supportStats }).skillInsights,
      teachingSuggestions: Array.isArray(parsed.teachingSuggestions) && parsed.teachingSuggestions.length > 0
        ? parsed.teachingSuggestions.map((t) => ({
            type: t.type || 'pedagogical_action',
            title: t.title || 'Instructional Recommendation',
            action: t.action || t.suggestion || 'Review course material.',
            priority: t.priority || 'medium',
            courseTitle: t.courseTitle,
            assessmentTitle: t.assessmentTitle,
          }))
        : generateFallbackTrainerAiTeachingInsights({ trainerContext, courses, assessments, questionStats, dropOffStats, skillStats, supportStats }).teachingSuggestions,
      learnerSupport: Array.isArray(parsed.learnerSupport) && parsed.learnerSupport.length > 0
        ? parsed.learnerSupport.map((l, idx) => {
            const match = supportStats[idx] || {};
            return {
              traineeId: match.traineeId,
              traineeName: l.traineeName || match.traineeName || 'Learner',
              courseTitle: match.courseTitle || '',
              failedAttemptsCount: match.failedAttemptsCount || 1,
              latestScore: match.latestScore || 0,
              progress: match.progress || 0,
              reason: l.reason || `${match.traineeName} may benefit from additional assistance.`,
            };
          })
        : generateFallbackTrainerAiTeachingInsights({ trainerContext, courses, assessments, questionStats, dropOffStats, skillStats, supportStats }).learnerSupport,
      metricsSummary: {
        totalCourses: courses.length,
        totalLearners: trainerContext.totalLearners || 0,
        evaluatedQuestionsCount: questionStats.length,
        dropOffDetectedCount: dropOffStats.length,
        strugglingLearnersCount: supportStats.length,
      },
      source: 'ai',
    };
  } catch (err) {
    console.warn(`Trainer AI Teaching Assistant error (${err.message}). Using fallback.`);
    return generateFallbackTrainerAiTeachingInsights({
      trainerContext,
      courses,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }
};

/**
 * Deterministic fallback for Course-Specific AI Insights
 */
const generateFallbackCourseSpecificAiInsights = ({
  course,
  modules = [],
  assessments = [],
  questionStats = [],
  dropOffStats = [],
  skillStats = [],
  supportStats = [],
}) => {
  const title = course?.title || 'Course';
  const avgProgress = course?.averageProgress || 0;
  const completionRate = course?.completionPercentage || 0;
  const avgScore = course?.averageAssessmentScore || 0;

  const difficultyAreas = questionStats.slice(0, 3).map((q) => ({
    topic: q.topic || q.questionText || 'Assessment Question',
    assessmentTitle: q.assessmentTitle,
    accuracyPercentage: q.accuracyPercentage,
    attempts: q.totalAttempts,
    incorrectCount: q.incorrectCount,
    severity: q.accuracyPercentage < 50 ? 'high' : 'medium',
    insight: `${q.accuracyPercentage}% accuracy (${q.incorrectCount}/${q.totalAttempts} incorrect). Concept appears to cause confusion.`,
  }));

  const dropOffInsights = dropOffStats.map((d) => ({
    moduleTitle: d.moduleTitle,
    enrolledCount: d.enrolledCount,
    completedCount: d.completedCount,
    completionPercentage: d.completionPercentage,
    reason: `Completion slows to ${d.completionPercentage}% at "${d.moduleTitle}". Additional examples may help maintain momentum.`,
  }));

  const skillInsights = skillStats.map((s) => ({
    skill: s.name,
    difficulty: s.difficulty,
    passRate: s.passRate,
    reason: s.difficulty === 'high'
      ? `Learners struggle with ${s.name} (${s.passRate}% pass rate). Hands-on practice recommended.`
      : `${s.name} is well-demonstrated by learners (${s.passRate}% pass rate).`,
  }));

  const teachingSuggestions = [];
  if (difficultyAreas.length > 0) {
    teachingSuggestions.push({
      type: 'assessment_scaffold',
      title: `Provide guidance on "${difficultyAreas[0].topic.slice(0, 40)}"`,
      action: `Learners show low accuracy on this topic. Add a code example or walkthrough before the quiz.`,
      priority: 'high',
    });
  }
  if (dropOffInsights.length > 0) {
    teachingSuggestions.push({
      type: 'module_pacing',
      title: `Review pacing in "${dropOffInsights[0].moduleTitle}"`,
      action: `Consider breaking down this module into smaller subsections to improve completion.`,
      priority: 'medium',
    });
  }
  if (teachingSuggestions.length === 0) {
    teachingSuggestions.push({
      type: 'positive_reinforcement',
      title: 'Maintain current course structure',
      action: 'Curriculum delivery is showing strong learner retention and passing rates.',
      priority: 'low',
    });
  }

  return {
    courseId: course._id,
    courseTitle: title,
    performance: {
      averageProgress: avgProgress,
      completionRate,
      averageScore,
      enrollmentCount: course?.enrollmentCount || 0,
    },
    difficultyAreas,
    dropOffInsights,
    skillInsights,
    teachingSuggestions,
    supportLearners: supportStats.slice(0, 4),
    source: 'fallback',
  };
};

/**
 * Generate Course-Specific AI Insights via OpenAI
 */
const generateCourseSpecificAiInsights = async ({
  course,
  modules = [],
  assessments = [],
  questionStats = [],
  dropOffStats = [],
  skillStats = [],
  supportStats = [],
  userId,
}) => {
  if (userId && !checkRateLimit(userId).allowed) {
    return generateFallbackCourseSpecificAiInsights({
      course,
      modules,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }

  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();
  if (!apiKey) {
    return generateFallbackCourseSpecificAiInsights({
      course,
      modules,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }

  try {
    const systemPrompt =
      `You are an expert AI Teaching Assistant for Capacity Connect analyzing a single course: "${course.title}".\n` +
      `Analyze the provided real metrics and generate targeted course diagnosis and teaching suggestions.\n` +
      `Do not fabricate statistics or modify any data. Return ONLY valid JSON.`;

    const payload = {
      courseTitle: course.title,
      category: course.category,
      level: course.level,
      enrollmentCount: course.enrollmentCount,
      averageProgress: course.averageProgress,
      completionPercentage: course.completionPercentage,
      averageScore: course.averageAssessmentScore,
      modules: modules.map((m) => m.title),
      questionDifficulties: questionStats.slice(0, 4),
      dropOffs: dropOffStats,
      skills: skillStats,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs || 10000);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Analyze this course performance data and return JSON with keys:\n` +
              `{\n` +
              `  "summary": "...",\n` +
              `  "difficultyAreas": [{"topic": "...", "severity": "high|medium|low", "insight": "..."}],\n` +
              `  "dropOffInsights": [{"moduleTitle": "...", "reason": "..."}],\n` +
              `  "skillInsights": [{"skill": "...", "difficulty": "high|moderate|demonstrated", "reason": "..."}],\n` +
              `  "teachingSuggestions": [{"title": "...", "action": "...", "priority": "high|medium|low"}]\n` +
              `}\n\nDATA:\n${JSON.stringify(payload)}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return generateFallbackCourseSpecificAiInsights({
        course,
        modules,
        assessments,
        questionStats,
        dropOffStats,
        skillStats,
        supportStats,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const parsed = JSON.parse(content);
    const fallback = generateFallbackCourseSpecificAiInsights({
      course,
      modules,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });

    return {
      courseId: course._id,
      courseTitle: course.title,
      summary: parsed.summary || `${course.title} performance diagnostics evaluated.`,
      performance: fallback.performance,
      difficultyAreas: Array.isArray(parsed.difficultyAreas) && parsed.difficultyAreas.length > 0
        ? parsed.difficultyAreas.map((d, i) => ({
            topic: d.topic || fallback.difficultyAreas[i]?.topic || 'Concept Area',
            accuracyPercentage: fallback.difficultyAreas[i]?.accuracyPercentage || 50,
            severity: d.severity || 'medium',
            insight: d.insight || 'Reviewing this topic with learners is recommended.',
          }))
        : fallback.difficultyAreas,
      dropOffInsights: Array.isArray(parsed.dropOffInsights) && parsed.dropOffInsights.length > 0
        ? parsed.dropOffInsights.map((d, i) => ({
            moduleTitle: d.moduleTitle || fallback.dropOffInsights[i]?.moduleTitle || 'Module',
            completionPercentage: fallback.dropOffInsights[i]?.completionPercentage || 50,
            reason: d.reason || 'Learner completion slows at this stage.',
          }))
        : fallback.dropOffInsights,
      skillInsights: Array.isArray(parsed.skillInsights) && parsed.skillInsights.length > 0
        ? parsed.skillInsights.map((s, i) => ({
            skill: s.skill || fallback.skillInsights[i]?.skill || 'Skill',
            difficulty: s.difficulty || fallback.skillInsights[i]?.difficulty || 'moderate',
            passRate: fallback.skillInsights[i]?.passRate || 75,
            reason: s.reason || 'Skill evaluated against assessment outcomes.',
          }))
        : fallback.skillInsights,
      teachingSuggestions: Array.isArray(parsed.teachingSuggestions) && parsed.teachingSuggestions.length > 0
        ? parsed.teachingSuggestions.map((t) => ({
            title: t.title || 'Instructional Recommendation',
            action: t.action || 'Consider supplementary practice exercises.',
            priority: t.priority || 'medium',
          }))
        : fallback.teachingSuggestions,
      supportLearners: fallback.supportLearners,
      source: 'ai',
    };
  } catch (err) {
    console.warn(`Course Specific AI error (${err.message}). Using fallback.`);
    return generateFallbackCourseSpecificAiInsights({
      course,
      modules,
      assessments,
      questionStats,
      dropOffStats,
      skillStats,
      supportStats,
    });
  }
};

/**
 * =========================================================================
 * PHASE 7.7: AI ASSESSMENT QUESTION GENERATOR & PDF PARSER
 * =========================================================================
 */

/**
 * Deterministic Fallback MCQ Question Generator grounded in course/module content
 */
const generateFallbackAssessmentQuestionsFromContent = ({
  course = {},
  moduleDoc = null,
  resources = [],
  count = 5,
  difficulty = 'medium',
  topic = '',
}) => {
  const courseTitle = course.title || 'Course Subject';
  const moduleTitle = moduleDoc ? moduleDoc.title : courseTitle;
  const outcomes = Array.isArray(course.learningOutcomes) && course.learningOutcomes.length > 0
    ? course.learningOutcomes
    : [
        `Understand core principles of ${courseTitle}`,
        `Apply best practices in ${moduleTitle}`,
        `Identify key components and architectures`,
        `Solve practical problems using standard methodologies`,
        `Analyze and evaluate implementation scenarios`,
      ];

  const skillNames = Array.isArray(course.skills)
    ? course.skills.map((s) => s.skill?.name || s.name || '').filter(Boolean)
    : [];

  const targetDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  const questions = [];

  for (let i = 0; i < count; i++) {
    const outcome = outcomes[i % outcomes.length] || `Topic in ${moduleTitle}`;
    const skillName = skillNames[i % (skillNames.length || 1)] || moduleTitle;
    const diff = difficulty === 'mixed' ? (['easy', 'medium', 'hard'][i % 3]) : targetDifficulty;

    const templates = [
      {
        q: `What is the primary objective when applying "${outcome}" in ${moduleTitle}?`,
        optA: `To establish structured patterns and maintain standard execution quality.`,
        optB: `To bypass system validations and expedite deployment without testing.`,
        optC: `To eliminate all external dependencies regardless of compatibility.`,
        optD: `To restrict user access to low-level runtime configurations only.`,
        ans: 'A',
        exp: `Establishing structured patterns and maintaining execution quality is the foundational goal when working with ${outcome}.`,
      },
      {
        q: `Which of the following represents a recommended best practice for ${skillName} within ${moduleTitle}?`,
        optA: `Hardcoding sensitive operational values into public code repositories.`,
        optB: `Adhering to modular separation of concerns and verifying functional outcomes.`,
        optC: `Disabling logging and monitoring across critical production stages.`,
        optD: `Ignoring baseline prerequisites prior to deploying new changes.`,
        ans: 'B',
        exp: `Modular separation of concerns and verifying functional outcomes ensures maintainable and resilient architectures in ${skillName}.`,
      },
      {
        q: `In the context of "${moduleTitle}", what is the key advantage of structured concept evaluation?`,
        optA: `It automatically guarantees zero computational overhead.`,
        optB: `It replaces the need for any subsequent functional testing.`,
        optC: `It provides verifiable feedback on trainee comprehension and identifies skill gaps.`,
        optD: `It restricts execution to legacy operating environments only.`,
        ans: 'C',
        exp: `Structured evaluation provides objective diagnostic feedback on concept comprehension and highlights specific learning areas for review.`,
      },
      {
        q: `When analyzing performance in ${skillName}, which factor is most critical according to course guidelines?`,
        optA: `Consistency of methodology and adherence to documented standards.`,
        optB: `Maximizing code length without considering readability.`,
        optC: `Avoiding standard libraries in favor of completely untested custom routines.`,
        optD: `Running unauthenticated services on unprotected default ports.`,
        ans: 'A',
        exp: `Adherence to standard methodologies and documented patterns ensures consistent, reliable results in ${skillName}.`,
      },
      {
        q: `What is the expected outcome after completing the review of ${outcome}?`,
        optA: `Complete mastery of foundational concepts and ability to solve practical tasks.`,
        optB: `Immediate deprecation of all existing course study resources.`,
        optC: `Limiting development strictly to non-networked local environments.`,
        optD: `Preventing any future updates or modifications to the codebase.`,
        ans: 'A',
        exp: `Completing the outcome enables trainees to apply foundational principles to solve practical challenges effectively.`,
      },
    ];

    const template = templates[i % templates.length];
    questions.push({
      questionText: template.q,
      optionA: template.optA,
      optionB: template.optB,
      optionC: template.optC,
      optionD: template.optD,
      correctOption: template.ans,
      marks: 1,
      explanation: template.exp,
      difficulty: diff,
      topic: topic || skillName || moduleTitle,
    });
  }

  return {
    questions,
    source: 'fallback',
    contentSummary: `Generated ${questions.length} grounded questions based on ${moduleTitle} syllabus & outcomes.`,
  };
};

/**
 * AI Assessment Question Generator from Course & Module Content
 */
const generateAssessmentQuestionsFromContent = async ({
  course = {},
  moduleDoc = null,
  resources = [],
  count = 5,
  difficulty = 'medium',
  topic = '',
  userId = 'default',
}) => {
  const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 5));
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    return generateFallbackAssessmentQuestionsFromContent({
      course,
      moduleDoc,
      resources,
      count: safeCount,
      difficulty,
      topic,
    });
  }

  // Build grounded educational context
  const courseTitle = course.title || 'Course';
  const moduleTitle = moduleDoc ? moduleDoc.title : 'All Modules';
  const courseDesc = course.description || course.shortDescription || '';
  const moduleDesc = moduleDoc ? (moduleDoc.description || '') : '';
  const outcomes = Array.isArray(course.learningOutcomes) ? course.learningOutcomes.join('; ') : '';
  const skills = Array.isArray(course.skills)
    ? course.skills.map((s) => s.skill?.name || s.name || '').filter(Boolean).join(', ')
    : '';
  const resourceSummaries = (Array.isArray(resources) ? resources : [])
    .map((r) => `${r.title || 'Resource'}: ${r.description || r.type || ''}`)
    .slice(0, 8)
    .join(' | ');

  const educationalContext = `
COURSE TITLE: ${courseTitle}
CATEGORY & LEVEL: ${course.category || 'General'} (${course.level || 'Beginner'})
COURSE SYLLABUS / DESCRIPTION: ${courseDesc}
LEARNING OUTCOMES: ${outcomes || 'Core concepts and practical application.'}
SKILLS TAUGHT: ${skills || 'General competency skills.'}
TARGET MODULE: ${moduleTitle}
MODULE DESCRIPTION: ${moduleDesc || 'Module specific topics and principles.'}
ATTACHED RESOURCES: ${resourceSummaries || 'Standard curriculum materials.'}
SPECIFIC TOPIC FOCUS: ${topic || 'Comprehensive coverage of the selected curriculum.'}
`.trim();

  const systemPrompt = `You are an expert assessment item writer and curriculum designer for Capacity Connect.
Your task is to generate exactly ${safeCount} high-quality, professional Multiple Choice Questions (MCQs) STRICTLY GROUNDED in the provided educational content.

CRITICAL RULES:
1. Grounding: All questions, correct answers, and distractors MUST be directly relevant to the course/module content provided. DO NOT fabricate facts or test unrelated subjects.
2. Structure: Every question MUST have exactly 4 plausible options (optionA, optionB, optionC, optionD) and exactly one designated correctOption ('A', 'B', 'C', or 'D').
3. Quality: Write clear, unambiguous question prompts. Distractors must be realistic but demonstrably incorrect based on course concepts.
4. Explanations: Provide a concise, educational explanation (2 sentences) explaining why the correct option is right.
5. Difficulty: Produce questions adhering to the requested difficulty level ("${difficulty}": 'easy', 'medium', 'hard', or 'mixed').
6. Return ONLY a valid JSON object matching the schema below:

{
  "questions": [
    {
      "questionText": "Clear question prompt ending with a question mark?",
      "optionA": "First plausible option text",
      "optionB": "Second plausible option text",
      "optionC": "Third plausible option text",
      "optionD": "Fourth plausible option text",
      "correctOption": "A",
      "explanation": "Concise educational explanation grounding why this option is correct.",
      "difficulty": "medium",
      "topic": "${topic || moduleTitle}"
    }
  ]
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 15000));

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please generate ${safeCount} assessment questions based on this educational content:\n\n${educationalContext}` },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`OpenAI Questions Gen returned ${response.status}: ${errText}`);
      return generateFallbackAssessmentQuestionsFromContent({
        course,
        moduleDoc,
        resources,
        count: safeCount,
        difficulty,
        topic,
      });
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent || '{}');

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return generateFallbackAssessmentQuestionsFromContent({
        course,
        moduleDoc,
        resources,
        count: safeCount,
        difficulty,
        topic,
      });
    }

    // Deterministic validation & sanitization
    const validQuestions = [];
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) continue;

      const optA = (q.optionA || '').trim();
      const optB = (q.optionB || '').trim();
      const optC = (q.optionC || '').trim();
      const optD = (q.optionD || '').trim();

      if (!optA || !optB || !optC || !optD) continue;
      // Ensure unique options
      const optSet = new Set([optA, optB, optC, optD]);
      if (optSet.size < 4) continue;

      const correctOpt = String(q.correctOption || 'A').toUpperCase().trim();
      const validCorrect = ['A', 'B', 'C', 'D'].includes(correctOpt) ? correctOpt : 'A';
      const qDiff = ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : (difficulty === 'mixed' ? (['easy', 'medium', 'hard'][i % 3]) : 'medium');

      validQuestions.push({
        questionText: q.questionText.trim(),
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: validCorrect,
        marks: 1,
        explanation: (q.explanation || `Option ${validCorrect} is the correct response for this concept.`).trim(),
        difficulty: qDiff,
        topic: (q.topic || topic || moduleTitle).trim(),
      });

      if (validQuestions.length >= safeCount) break;
    }

    if (validQuestions.length === 0) {
      return generateFallbackAssessmentQuestionsFromContent({
        course,
        moduleDoc,
        resources,
        count: safeCount,
        difficulty,
        topic,
      });
    }

    // If fewer than requested, fill remaining with fallback
    if (validQuestions.length < safeCount) {
      const fallbackSet = generateFallbackAssessmentQuestionsFromContent({
        course,
        moduleDoc,
        resources,
        count: safeCount - validQuestions.length,
        difficulty,
        topic,
      });
      validQuestions.push(...fallbackSet.questions);
    }

    return {
      questions: validQuestions,
      source: 'ai',
      contentSummary: `Generated ${validQuestions.length} AI questions grounded in ${moduleTitle} content.`,
    };
  } catch (err) {
    console.warn(`AI Question Generation error (${err.message}). Using fallback.`);
    return generateFallbackAssessmentQuestionsFromContent({
      course,
      moduleDoc,
      resources,
      count: safeCount,
      difficulty,
      topic,
    });
  }
};

/**
 * Regenerate a Single MCQ Question from Course/Module Content
 */
const regenerateSingleQuestionFromContent = async ({
  course = {},
  moduleDoc = null,
  resources = [],
  existingQuestionText = '',
  difficulty = 'medium',
  topic = '',
  userId = 'default',
}) => {
  const result = await generateAssessmentQuestionsFromContent({
    course,
    moduleDoc,
    resources,
    count: 2,
    difficulty,
    topic,
    userId,
  });

  // Pick a question distinct from existing
  const freshQuestion = result.questions.find((q) => q.questionText !== existingQuestionText) || result.questions[0];
  return {
    question: freshQuestion,
    source: result.source,
  };
};

/**
 * Deterministic Regex Parser for Text-based Question PDFs
 */
const fallbackParseQuestionsFromPdfText = (pdfText) => {
  if (!pdfText || typeof pdfText !== 'string') {
    return { questions: [], hasAnswerKey: false };
  }

  const lines = pdfText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];
  let currentQ = null;
  let detectedAnswerKeys = 0;

  const isQuestionStart = (line) => /^(?:Q(?:uestion)?\s*)?\d+[\.\)\:]\s+/i.test(line);
  const isOptionA = (line) => /^[Aa1][\.\)\:\-]\s+/i.test(line);
  const isOptionB = (line) => /^[Bb2][\.\)\:\-]\s+/i.test(line);
  const isOptionC = (line) => /^[Cc3][\.\)\:\-]\s+/i.test(line);
  const isOptionD = (line) => /^[Dd4][\.\)\:\-]\s+/i.test(line);
  const isAnswerLine = (line) => /^(?:Answer|Ans|Correct(?:\s*Answer)?|Key)[\:\s\-]+/i.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isQuestionStart(line)) {
      if (currentQ && currentQ.questionText && currentQ.optionA && currentQ.optionB) {
        questions.push(finalizeQuestion(currentQ));
      }
      currentQ = {
        questionText: line.replace(/^(?:Q(?:uestion)?\s*)?\d+[\.\)\:]\s*/i, '').trim(),
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctOption: 'A',
        hasAnswerKey: false,
      };
    } else if (currentQ) {
      if (isOptionA(line)) {
        currentQ.optionA = line.replace(/^[Aa1][\.\)\:\-]\s*/i, '').trim();
      } else if (isOptionB(line)) {
        currentQ.optionB = line.replace(/^[Bb2][\.\)\:\-]\s*/i, '').trim();
      } else if (isOptionC(line)) {
        currentQ.optionC = line.replace(/^[Cc3][\.\)\:\-]\s*/i, '').trim();
      } else if (isOptionD(line)) {
        currentQ.optionD = line.replace(/^[Dd4][\.\)\:\-]\s*/i, '').trim();
      } else if (isAnswerLine(line)) {
        const match = line.match(/(?:Answer|Ans|Correct(?:\s*Answer)?|Key)[\:\s\-]+([A-Da-d1-4])/i);
        if (match && match[1]) {
          const raw = match[1].toUpperCase();
          const mapped = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }[raw] || raw;
          if (['A', 'B', 'C', 'D'].includes(mapped)) {
            currentQ.correctOption = mapped;
            currentQ.hasAnswerKey = true;
            detectedAnswerKeys++;
          }
        }
      } else if (!currentQ.optionA) {
        // Multi-line question prompt
        currentQ.questionText += ' ' + line;
      }
    }
  }

  if (currentQ && currentQ.questionText && currentQ.optionA && currentQ.optionB) {
    questions.push(finalizeQuestion(currentQ));
  }

  function finalizeQuestion(q) {
    return {
      questionText: q.questionText.slice(0, 300),
      optionA: (q.optionA || 'Option A').slice(0, 200),
      optionB: (q.optionB || 'Option B').slice(0, 200),
      optionC: (q.optionC || 'Option C').slice(0, 200),
      optionD: (q.optionD || 'Option D').slice(0, 200),
      correctOption: q.correctOption || 'A',
      marks: 1,
      explanation: q.hasAnswerKey ? `Extracted answer key from PDF: Option ${q.correctOption}` : '',
      difficulty: 'medium',
      topic: 'PDF Imported Question',
      hasAnswerKey: q.hasAnswerKey,
      isAiSuggestedAnswer: !q.hasAnswerKey,
    };
  }

  return {
    questions,
    hasAnswerKey: detectedAnswerKeys > 0,
    source: 'fallback_pdf_parser',
  };
};

/**
 * AI Structured Parsing of Extracted PDF Text into MCQs
 */
const parseQuestionsFromPdfText = async ({
  pdfText = '',
  course = {},
  moduleDoc = null,
  userId = 'default',
}) => {
  if (!pdfText || pdfText.trim().length < 20) {
    return {
      questions: [],
      hasAnswerKey: false,
      error: "We couldn't extract readable text from this PDF. This PDF may contain scanned images. Please upload a text-based PDF or use manual entry.",
    };
  }

  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    const fallbackResult = fallbackParseQuestionsFromPdfText(pdfText);
    return fallbackResult;
  }

  const truncatedText = pdfText.slice(0, 12000); // Guard token length

  const systemPrompt = `You are a precision PDF examination question parser.
Your task is to parse raw extracted text from a PDF examination paper or quiz worksheet and extract all Multiple Choice Questions (MCQs) into clean, structured JSON.

RULES:
1. Identify all question prompts, their 4 options (A, B, C, D), and their correct answer if provided anywhere in the text (e.g. "Answer: B", "Ans: (3)", "Key: C").
2. If an option is missing or only 2-3 options exist, supply plausible standard distractors so every question has exactly 4 options.
3. If an answer key exists in the text, set "hasAnswerKey": true on the root object, and specify "correctOption": 'A'|'B'|'C'|'D'.
4. If NO answer key exists in the text, set "hasAnswerKey": false, and provide your best intelligent guess for "correctOption" while flagging "isAiSuggestedAnswer": true on the question.
5. Return ONLY a valid JSON object matching this schema:

{
  "hasAnswerKey": true,
  "questions": [
    {
      "questionText": "Extracted question prompt?",
      "optionA": "Text for Option A",
      "optionB": "Text for Option B",
      "optionC": "Text for Option C",
      "optionD": "Text for Option D",
      "correctOption": "A",
      "explanation": "Brief explanation or extracted answer note",
      "difficulty": "medium",
      "topic": "General",
      "isAiSuggestedAnswer": false
    }
  ]
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 15000));

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please parse these extracted PDF examination questions:\n\n${truncatedText}` },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`OpenAI PDF parse returned status ${response.status}. Using regex fallback.`);
      return fallbackParseQuestionsFromPdfText(pdfText);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent || '{}');

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return fallbackParseQuestionsFromPdfText(pdfText);
    }

    const sanitizedQuestions = parsed.questions.map((q) => {
      const correctOpt = String(q.correctOption || 'A').toUpperCase().trim();
      return {
        questionText: (q.questionText || 'Imported Question').trim(),
        optionA: (q.optionA || 'Option A').trim(),
        optionB: (q.optionB || 'Option B').trim(),
        optionC: (q.optionC || 'Option C').trim(),
        optionD: (q.optionD || 'Option D').trim(),
        correctOption: ['A', 'B', 'C', 'D'].includes(correctOpt) ? correctOpt : 'A',
        marks: 1,
        explanation: q.explanation || '',
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        topic: q.topic || 'PDF Import',
        isAiSuggestedAnswer: Boolean(q.isAiSuggestedAnswer || !parsed.hasAnswerKey),
      };
    });

    return {
      questions: sanitizedQuestions,
      hasAnswerKey: Boolean(parsed.hasAnswerKey),
      source: 'ai_pdf_parser',
    };
  } catch (err) {
    console.warn(`AI PDF parsing error (${err.message}). Using fallback parser.`);
    return fallbackParseQuestionsFromPdfText(pdfText);
  }
};

/**
 * Suggest Answers using AI for Questions imported without an answer key
 */
const suggestAnswersForQuestions = async ({
  questions = [],
  course = {},
  moduleDoc = null,
  userId = 'default',
}) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { questions: [] };
  }

  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  if (!apiKey) {
    // Fallback: assign Option A and note suggestion
    return {
      questions: questions.map((q) => ({
        ...q,
        correctOption: q.correctOption || 'A',
        explanation: q.explanation || 'Suggested default answer. Trainer review required.',
        isAiSuggestedAnswer: true,
      })),
      source: 'fallback',
    };
  }

  const systemPrompt = `You are an academic examination validator.
Given a list of multiple choice questions without answers, evaluate each question and select the single most accurate correctOption ('A', 'B', 'C', or 'D') along with a 1-2 sentence explanation.

Return ONLY a valid JSON object:
{
  "answers": [
    {
      "index": 0,
      "correctOption": "B",
      "explanation": "Clear explanation grounded in standard concepts."
    }
  ]
}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(timeoutMs, 15000));

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify({ questions }) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`OpenAI suggest answers returned status ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const answersMap = new Map();

    if (Array.isArray(parsed.answers)) {
      parsed.answers.forEach((ans) => {
        answersMap.set(ans.index, ans);
      });
    }

    const updatedQuestions = questions.map((q, idx) => {
      const suggestion = answersMap.get(idx);
      const suggestedOption = suggestion && ['A', 'B', 'C', 'D'].includes(suggestion.correctOption)
        ? suggestion.correctOption
        : q.correctOption || 'A';

      return {
        ...q,
        correctOption: suggestedOption,
        explanation: suggestion?.explanation || q.explanation || 'AI Suggested Answer — Trainer Review Required.',
        isAiSuggestedAnswer: true,
      };
    });

    return {
      questions: updatedQuestions,
      source: 'ai',
    };
  } catch (err) {
    console.warn(`Error suggesting answers with AI (${err.message}). Using fallback.`);
    return {
      questions: questions.map((q) => ({
        ...q,
        correctOption: q.correctOption || 'A',
        explanation: q.explanation || 'AI Suggested Answer — Trainer Review Required.',
        isAiSuggestedAnswer: true,
      })),
      source: 'fallback',
    };
  }
};

/**
 * Generate MCQs by analyzing educational Matter/Content extracted from a PDF
 */
const generateQuestionsFromMatterPdf = async ({
  pdfText = '',
  count = 5,
  difficulty = 'medium',
  topic = '',
  course = {},
  moduleDoc = null,
  userId = 'default',
}) => {
  if (!pdfText || pdfText.trim().length < 20) {
    return {
      questions: [],
      error: "We couldn't extract readable text from this PDF. This PDF may contain scanned images. Please upload a text-based PDF or use manual entry.",
    };
  }

  const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 5));
  const { apiKey, model, baseUrl, timeoutMs } = getOpenAiConfig();

  // If no API key configured, use deterministic fallback generator
  if (!apiKey) {
    return generateFallbackQuestionsFromMatterPdf({
      pdfText,
      count: safeCount,
      difficulty,
      topic,
      course,
      moduleDoc,
    });
  }

  const truncatedText = pdfText.slice(0, 14000);

  const systemPrompt = `You are an expert instructional designer and senior assessment author.
Your task is to analyze the educational study material/matter extracted from a PDF document and generate exactly ${safeCount} high-quality Multiple Choice Questions (MCQs).
Rules:
1. Every question must be strictly grounded in the concepts, facts, definitions, rules, workflows, and insights described in the PDF text.
2. Provide 4 distinct options (Option A, Option B, Option C, Option D) for each question.
3. Designate exactly one correct option: 'A', 'B', 'C', or 'D'.
4. Include a concise educational explanation clarifying why the answer is correct based on the PDF material.
5. Respect the difficulty level (${difficulty}).
6. Format your response strictly as a JSON object with this shape:
{
  "questions": [
    {
      "questionText": "Question prompt based on PDF content?",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correctOption": "A",
      "marks": 1,
      "explanation": "Explanation grounded in the text",
      "difficulty": "medium",
      "topic": "Topic from PDF"
    }
  ]
}`;

  const userPrompt = `Course Context: ${course?.title || 'General Curriculum'}
${moduleDoc ? `Module Context: ${moduleDoc.title}` : ''}
${topic ? `Topic Focus: ${topic}` : ''}
Target Count: ${safeCount} questions
Target Difficulty: ${difficulty}

--- EXTRACTED PDF STUDY MATERIAL / MATTER ---
${truncatedText}
--- END PDF MATTER ---

Generate ${safeCount} strictly grounded MCQs as JSON.`;

  try {
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`OpenAI Matter PDF Questions returned ${response.status}:`, errText);
      return generateFallbackQuestionsFromMatterPdf({
        pdfText,
        count: safeCount,
        difficulty,
        topic,
        course,
        moduleDoc,
      });
    }

    const resJson = await response.json();
    const rawContent = resJson.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return generateFallbackQuestionsFromMatterPdf({
        pdfText,
        count: safeCount,
        difficulty,
        topic,
        course,
        moduleDoc,
      });
    }

    const sanitized = parsed.questions.map((q, idx) => {
      const correctOpt = ['A', 'B', 'C', 'D'].includes(q.correctOption?.toUpperCase())
        ? q.correctOption.toUpperCase()
        : 'A';

      return {
        questionText: (q.questionText || `Question ${idx + 1} from PDF material`).slice(0, 300),
        optionA: (q.optionA || 'Option A').slice(0, 200),
        optionB: (q.optionB || 'Option B').slice(0, 200),
        optionC: (q.optionC || 'Option C').slice(0, 200),
        optionD: (q.optionD || 'Option D').slice(0, 200),
        correctOption: correctOpt,
        marks: 1,
        explanation: (q.explanation || 'Based on the uploaded PDF document material.').slice(0, 500),
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty?.toLowerCase())
          ? q.difficulty.toLowerCase()
          : (difficulty === 'mixed' ? (['easy', 'medium', 'hard'][idx % 3]) : difficulty),
        topic: (q.topic || topic || course?.title || 'PDF Matter').slice(0, 80),
        source: 'ai_matter_pdf',
      };
    });

    return {
      questions: sanitized.slice(0, safeCount),
      hasAnswerKey: true,
      source: 'openai_matter_pdf',
    };
  } catch (err) {
    console.warn('OpenAI generateQuestionsFromMatterPdf exception:', err.message);
    return generateFallbackQuestionsFromMatterPdf({
      pdfText,
      count: safeCount,
      difficulty,
      topic,
      course,
      moduleDoc,
    });
  }
};

/**
 * Deterministic Fallback Generator from PDF Matter
 */
const generateFallbackQuestionsFromMatterPdf = ({
  pdfText = '',
  count = 5,
  difficulty = 'medium',
  topic = '',
  course = {},
  moduleDoc = null,
}) => {
  const safeCount = Math.max(1, Math.min(20, parseInt(count, 10) || 5));
  const lines = pdfText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length < 15) return false;
      if (l.startsWith('http') || l.includes('@') || l.includes('[Content_Types]') || l.includes('.xml')) return false;
      // Filter out non-alphanumeric noise
      const validAlphaCount = (l.match(/[a-zA-Z0-9\s]/g) || []).length;
      return validAlphaCount / l.length >= 0.7;
    });

  const questions = [];
  const diffCycle = ['easy', 'medium', 'hard'];

  for (let i = 0; i < safeCount; i++) {
    const activeDiff = difficulty === 'mixed' ? diffCycle[i % diffCycle.length] : difficulty;
    const sampleLine = lines.length > 0
      ? lines[i % lines.length]
      : `Core instructional concept of ${course?.title || 'the curriculum'}`;
    const cleanSnippet = sampleLine.replace(/^[0-9\.\-\*\#\s]+/, '').slice(0, 100);

    const questionTemplates = [
      `According to the study material, what is the primary significance of "${cleanSnippet}"?`,
      `Which of the following best describes the key concept highlighted in the document: "${cleanSnippet}"?`,
      `Based on the provided material, how does "${cleanSnippet}" function within the workflow?`,
      `What is the recommended practice or outcome regarding "${cleanSnippet}" in the document?`,
      `In the context of the curriculum, which statement accurately reflects "${cleanSnippet}"?`,
    ];

    const qText = questionTemplates[i % questionTemplates.length];

    questions.push({
      questionText: qText.slice(0, 300),
      optionA: `It establishes the fundamental framework for ${cleanSnippet}.`,
      optionB: `It serves as an auxiliary mechanism unrelated to the main workflow.`,
      optionC: `It is deprecated in favor of legacy configurations.`,
      optionD: `It restricts execution without providing validation checks.`,
      correctOption: 'A',
      marks: 1,
      explanation: `Based on the uploaded document section: "${cleanSnippet}".`,
      difficulty: activeDiff,
      topic: topic || (moduleDoc?.title || course?.title || 'Document Study Matter').slice(0, 80),
      source: 'fallback_matter_document',
    });
  }

  return {
    questions,
    hasAnswerKey: true,
    source: 'fallback_matter_document',
  };
};

module.exports = {
  getOpenAiConfig,
  generateQuestionExplanation,
  generateFallbackExplanation,
  generateCourseRecommendations,
  generateFallbackRecommendations,
  generateSkillGuidance,
  generateFallbackSkillGuidance,
  generateCourseRationale,
  generateFallbackCourseRationale,
  generateLearningPath,
  generateFallbackLearningPath,
  generateCareerRoadmap,
  generateFallbackCareerRoadmap,
  generateAdaptiveAdvisor,
  generateFallbackAdaptiveAdvisor,
  generateFallbackCourseDoubt,
  answerCourseDoubt,
  generateTrainerAiTeachingInsights,
  generateFallbackTrainerAiTeachingInsights,
  generateCourseSpecificAiInsights,
  generateFallbackCourseSpecificAiInsights,
  generateAssessmentQuestionsFromContent,
  generateFallbackAssessmentQuestionsFromContent,
  generateQuestionsFromMatterPdf,
  generateFallbackQuestionsFromMatterPdf,
  regenerateSingleQuestionFromContent,
  parseQuestionsFromPdfText,
  fallbackParseQuestionsFromPdfText,
  suggestAnswersForQuestions,
  checkRateLimit,
};

