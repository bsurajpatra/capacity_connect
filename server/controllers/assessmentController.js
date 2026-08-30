const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const Assessment = require('../models/Assessment');
const QuizAttempt = require('../models/QuizAttempt');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Resource = require('../models/Resource');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { generateCertificatePDF, generateCertificateId } = require('../utils/certificateGenerator');
const { extractTextFromDocument } = require('../utils/documentExtractor');
const {
  generateQuestionExplanation,
  generateAssessmentQuestionsFromContent,
  generateQuestionsFromMatterPdf,
  regenerateSingleQuestionFromContent,
  parseQuestionsFromPdfText,
  suggestAnswersForQuestions,
  checkRateLimit,
} = require('../services/openaiService');
const { invalidateTraineeAICache } = require('./recommendationController');

/**
 * Helper to sanitize assessment questions for Trainee (strip correctOption)
 */
const sanitizeQuestionsForTrainee = (questions) => {
  return questions.map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    marks: q.marks,
  }));
};

/**
 * @desc    Get module quiz (trainee receives sanitized questions, trainer gets full quiz)
 * @route   GET /api/modules/:moduleId/quiz
 * @access  Private (Enrolled Trainee, Owner Trainer, Admin)
 */
const getModuleQuiz = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const moduleDoc = await Module.findById(moduleId);
    if (!moduleDoc) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    const course = await Course.findById(moduleDoc.course);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const quiz = await Assessment.findOne({ module: moduleId, type: 'module' });
    if (!quiz) {
      return res.status(200).json({ success: true, data: null });
    }

    // Role-based access control
    if (req.user.role === 'trainee') {
      const enrollment = await Enrollment.findOne({
        trainee: req.user._id,
        course: course._id,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You must be enrolled in this course to access the quiz.',
        });
      }

      if (quiz.status !== 'published') {
        return res.status(200).json({ success: true, data: null });
      }

      // Fetch Trainee's latest attempt if exists
      const latestAttempt = await QuizAttempt.findOne({
        trainee: req.user._id,
        assessment: quiz._id,
      }).sort({ createdAt: -1 });

      const sanitizedQuiz = quiz.toObject();
      sanitizedQuiz.questions = sanitizeQuestionsForTrainee(quiz.questions);

      return res.status(200).json({
        success: true,
        data: {
          quiz: sanitizedQuiz,
          latestAttempt,
        },
      });
    }

    // Trainer access: ownership verification
    if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view quizzes for courses you instruct.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        quiz,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create or update module quiz
 * @route   POST /api/modules/:moduleId/quiz
 * @access  Private (Owner Trainer, Admin)
 */
const saveModuleQuiz = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { title, description, questions, status, passingPercentage } = req.body;

    const moduleDoc = await Module.findById(moduleId);
    if (!moduleDoc) {
      return res.status(404).json({ success: false, message: 'Module not found' });
    }

    const course = await Course.findById(moduleDoc.course);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Ownership check
    if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only create quizzes for your own courses.',
        });
      }
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Quiz title is required' });
    }

    if (status === 'published' && (!questions || questions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish quiz with 0 questions. Please add at least 1 question.',
      });
    }

    const passPct =
      passingPercentage !== undefined
        ? Math.max(0, Math.min(100, parseInt(passingPercentage, 10) || 0))
        : 50;

    let quiz = await Assessment.findOne({ module: moduleId, type: 'module' });

    if (quiz) {
      quiz.title = title.trim();
      quiz.description = description ? description.trim() : '';
      quiz.passingPercentage = passPct;
      if (questions) quiz.questions = questions;
      if (status) quiz.status = status;
      await quiz.save();
    } else {
      quiz = await Assessment.create({
        course: course._id,
        module: moduleId,
        type: 'module',
        title: title.trim(),
        description: description ? description.trim() : '',
        passingPercentage: passPct,
        questions: questions || [],
        status: status || 'draft',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Module quiz saved successfully',
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get final course assessment
 * @route   GET /api/courses/:courseId/final-assessment
 * @access  Private (Enrolled Trainee, Owner Trainer, Admin)
 */
const getFinalAssessment = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const assessment = await Assessment.findOne({ course: courseId, type: 'final' });
    if (!assessment) {
      return res.status(200).json({ success: true, data: null });
    }

    // Role-based access control
    if (req.user.role === 'trainee') {
      const enrollment = await Enrollment.findOne({
        trainee: req.user._id,
        course: course._id,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You must be enrolled in this course to access the final assessment.',
        });
      }

      if (assessment.status !== 'published') {
        return res.status(200).json({ success: true, data: null });
      }

      // Check for trainee certificate & attempts
      const certificate = await Certificate.findOne({
        trainee: req.user._id,
        course: courseId,
      })
        .populate('trainee', 'name email')
        .populate('course', 'title')
        .populate('trainer', 'name');

      const latestAttempt = await QuizAttempt.findOne({
        trainee: req.user._id,
        assessment: assessment._id,
      }).sort({ createdAt: -1 });

      // Check module completion gating
      const courseModules = await Module.find({ course: course._id }).select('_id');
      const completedSet = new Set(
        (enrollment.completedModules || []).map((id) => id.toString())
      );
      const allModulesCompleted =
        courseModules.length === 0 ||
        courseModules.every((mod) => completedSet.has(mod._id.toString()));

      const sanitizedAssessment = assessment.toObject();
      sanitizedAssessment.questions = sanitizeQuestionsForTrainee(assessment.questions);

      return res.status(200).json({
        success: true,
        data: {
          assessment: sanitizedAssessment,
          latestAttempt,
          certificate,
          isLocked: !allModulesCompleted,
          totalModules: courseModules.length,
          completedCount: completedSet.size,
          gatingMessage: !allModulesCompleted
            ? 'Complete all required course modules before attempting the final assessment.'
            : null,
        },
      });
    }

    // Trainer ownership verification
    if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view assessments for courses you instruct.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        assessment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create or update final course assessment
 * @route   POST /api/courses/:courseId/final-assessment
 * @access  Private (Owner Trainer, Admin)
 */
const saveFinalAssessment = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, passingPercentage, questions, status } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Ownership check
    if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only create assessments for your own courses.',
        });
      }
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Assessment title is required' });
    }

    const passPct = passingPercentage !== undefined ? parseInt(passingPercentage, 10) : 60;
    if (isNaN(passPct) || passPct < 0 || passPct > 100) {
      return res.status(400).json({
        success: false,
        message: 'Passing percentage must be an integer between 0 and 100.',
      });
    }

    if (status === 'published' && (!questions || questions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish assessment with 0 questions. Please add at least 1 question.',
      });
    }

    let assessment = await Assessment.findOne({ course: courseId, type: 'final' });

    if (assessment) {
      assessment.title = title.trim();
      assessment.description = description ? description.trim() : '';
      assessment.passingPercentage = passPct;
      if (questions) assessment.questions = questions;
      if (status) assessment.status = status;
      await assessment.save();
    } else {
      assessment = await Assessment.create({
        course: courseId,
        module: null,
        type: 'final',
        title: title.trim(),
        description: description ? description.trim() : '',
        passingPercentage: passPct,
        questions: questions || [],
        status: status || 'draft',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Final assessment saved successfully',
      data: assessment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete assessment (Module Quiz or Final Assessment)
 * @route   DELETE /api/assessments/:id
 * @access  Private (Owner Trainer, Admin)
 */
const deleteAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const course = await Course.findById(assessment.course);
    if (req.user.role === 'trainer' && course) {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    await Assessment.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle assessment status (draft/published)
 * @route   PUT /api/assessments/:id/status
 * @access  Private (Owner Trainer, Admin)
 */
const toggleAssessmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const course = await Course.findById(assessment.course);
    if (req.user.role === 'trainer' && course) {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const nextStatus = assessment.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published' && (!assessment.questions || assessment.questions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish assessment without questions.',
      });
    }

    assessment.status = nextStatus;
    await assessment.save();

    return res.status(200).json({
      success: true,
      message: `Assessment status updated to ${nextStatus}`,
      data: assessment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Duplicate an existing assessment
 * @route   POST /api/assessments/:id/duplicate
 * @access  Private (Owner Trainer, Admin)
 */
const duplicateAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sourceAssessment = await Assessment.findById(id);
    if (!sourceAssessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const course = await Course.findById(sourceAssessment.course);
    if (req.user.role === 'trainer' && course) {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    // Clone questions
    const clonedQuestions = (sourceAssessment.questions || []).map((q) => ({
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      marks: q.marks || 1,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 'medium',
      skill: q.skill || null,
      topic: q.topic || '',
    }));

    const newAssessment = await Assessment.create({
      course: sourceAssessment.course,
      module: sourceAssessment.module || null,
      type: sourceAssessment.type,
      title: `${sourceAssessment.title} (Copy)`,
      description: sourceAssessment.description || '',
      passingPercentage: sourceAssessment.passingPercentage || 60,
      timeLimit: sourceAssessment.timeLimit || 0,
      allowedAttempts: sourceAssessment.allowedAttempts || 3,
      randomizeQuestions: sourceAssessment.randomizeQuestions || false,
      questions: clonedQuestions,
      status: 'draft',
    });

    return res.status(201).json({
      success: true,
      message: 'Assessment duplicated successfully',
      data: newAssessment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit attempt for a module quiz or final assessment
 * @route   POST /api/assessments/:id/attempt
 * @access  Private (Enrolled Trainee only)
 */
const submitAssessmentAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // Array of { questionId, selectedOption }
    const traineeId = req.user._id;

    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (assessment.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit attempt for an unpublished assessment.',
      });
    }

    const course = await Course.findById(assessment.course).populate('trainer', 'name email');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      trainee: traineeId,
      course: course._id,
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be enrolled in this course to take this assessment.',
      });
    }

    // Final Assessment Gating Enforcement (Backend Authority)
    if (assessment.type === 'final') {
      const courseModules = await Module.find({ course: course._id }).select('_id');
      const completedSet = new Set(
        (enrollment.completedModules || []).map((id) => id.toString())
      );
      const allModulesCompleted =
        courseModules.length === 0 ||
        courseModules.every((mod) => completedSet.has(mod._id.toString()));

      if (!allModulesCompleted) {
        return res.status(403).json({
          success: false,
          isLocked: true,
          message: 'Complete all required course modules before attempting the final assessment.',
          data: {
            totalModules: courseModules.length,
            completedModules: completedSet.size,
          },
        });
      }
    }

    // Evaluate answers
    let score = 0;
    let totalMarks = 0;
    const processedAnswers = [];

    const submittedMap = {};
    if (Array.isArray(answers)) {
      answers.forEach((ans) => {
        if (ans.questionId) {
          submittedMap[ans.questionId.toString()] = (ans.selectedOption || '').toUpperCase().trim();
        }
      });
    }

    assessment.questions.forEach((q) => {
      const qId = q._id.toString();
      const qMarks = q.marks || 1;
      totalMarks += qMarks;

      const selected = submittedMap[qId] || '';
      const correct = q.correctOption.toUpperCase().trim();
      const isCorrect = selected === correct;

      if (isCorrect) {
        score += qMarks;
      }

      processedAnswers.push({
        question: q._id,
        questionText: q.questionText,
        optionA: q.optionA || '',
        optionB: q.optionB || '',
        optionC: q.optionC || '',
        optionD: q.optionD || '',
        selectedOption: selected,
        correctOption: correct,
        isCorrect,
        marksAwarded: isCorrect ? qMarks : 0,
        explanation: q.explanation || '',
      });
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passThreshold = assessment.passingPercentage || (assessment.type === 'final' ? 60 : 50);
    const passed = percentage >= passThreshold;

    // Create Attempt Record
    const attempt = await QuizAttempt.create({
      trainee: traineeId,
      assessment: assessment._id,
      course: course._id,
      module: assessment.module,
      type: assessment.type,
      answers: processedAnswers,
      score,
      totalMarks,
      percentage,
      passed,
      submittedAt: new Date(),
    });

    let certificateData = null;

    // 1. AUTOMATIC MODULE COMPLETION (For Module Quizzes)
    if (assessment.type === 'module' && assessment.module) {
      const currentCompleted = enrollment.completedModules
        ? enrollment.completedModules.map((m) => m.toString())
        : [];

      if (!currentCompleted.includes(assessment.module.toString())) {
        currentCompleted.push(assessment.module.toString());
        enrollment.completedModules = currentCompleted;

        const totalModules = await Module.countDocuments({ course: course._id });
        const progress =
          totalModules > 0 ? Math.round((currentCompleted.length / totalModules) * 100) : 0;
        enrollment.progress = Math.min(100, Math.max(0, progress));

        // If course has no final assessment, 100% progress completes the course
        const hasPublishedFinal = await Assessment.exists({
          course: course._id,
          type: 'final',
          status: 'published',
        });

        if (enrollment.progress === 100 && !hasPublishedFinal) {
          enrollment.status = 'completed';
          enrollment.completedAt = new Date();
        }
        await enrollment.save();
      }
    }

    // 2. AUTOMATIC CERTIFICATE GENERATION & COURSE COMPLETION (For Passed Final Assessment)
    if (assessment.type === 'final' && passed) {
      // Mark enrollment as completed upon passing final assessment
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      await enrollment.save();

      let existingCert = await Certificate.findOne({
        trainee: traineeId,
        course: course._id,
      });

      if (!existingCert) {
        const certificateId = generateCertificateId();
        const traineeUser = await User.findById(traineeId);

        const filePath = await generateCertificatePDF({
          certificateId,
          traineeName: traineeUser?.name || 'Trainee',
          courseTitle: course.title,
          trainerName: course.trainer?.name || 'Course Instructor',
          percentage,
          issuedAt: new Date(),
        });

        existingCert = await Certificate.create({
          certificateId,
          trainee: traineeId,
          course: course._id,
          trainer: course.trainer?._id || course.trainer,
          assessment: assessment._id,
          score,
          totalMarks,
          percentage,
          issuedAt: new Date(),
          filePath,
          status: 'valid',
        });
      }

      certificateData = existingCert;
    }

    // Invalidate AI recommendation & advisor caches for this trainee
    invalidateTraineeAICache(traineeId);

    return res.status(201).json({
      success: true,
      message:
        assessment.type === 'final'
          ? passed
            ? 'Congratulations! You passed the final assessment.'
            : 'Assessment submitted. You did not meet the passing criteria.'
          : 'Module quiz submitted and module completed!',
      data: {
        attempt,
        certificate: certificateData,
        progress: enrollment.progress,
        isModuleCompleted: assessment.type === 'module',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get trainee attempts for an assessment
 * @route   GET /api/assessments/:id/my-attempts
 * @access  Private (Enrolled Trainee only)
 */
const getMyAssessmentAttempts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const traineeId = req.user._id;

    const attempts = await QuizAttempt.find({
      trainee: traineeId,
      assessment: id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: attempts.length,
      data: attempts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get course assessment results roster for Trainer
 * @route   GET /api/courses/:courseId/trainer-results
 * @access  Private (Owner Trainer, Admin)
 */
const getCourseAssessmentResults = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const enrollments = await Enrollment.find({ course: courseId }).populate(
      'trainee',
      'name email department'
    );

    const moduleQuizzes = await Assessment.find({ course: courseId, type: 'module' });
    const finalAssessment = await Assessment.findOne({ course: courseId, type: 'final' });

    // Aggregate attempts for each trainee
    const results = await Promise.all(
      enrollments.map(async (e) => {
        const traineeId = e.trainee?._id;

        // Module Quiz Attempts
        const moduleAttempts = await QuizAttempt.find({
          trainee: traineeId,
          course: courseId,
          type: 'module',
        });

        const totalModuleScore = moduleAttempts.reduce((sum, a) => sum + a.percentage, 0);
        const moduleQuizAvg =
          moduleAttempts.length > 0 ? Math.round(totalModuleScore / moduleAttempts.length) : null;

        // Final Assessment Attempt
        let finalAttempt = null;
        if (finalAssessment) {
          finalAttempt = await QuizAttempt.findOne({
            trainee: traineeId,
            assessment: finalAssessment._id,
          }).sort({ createdAt: -1 });
        }

        const certificate = await Certificate.findOne({
          trainee: traineeId,
          course: courseId,
        });

        return {
          traineeId: e.trainee?._id,
          name: e.trainee?.name || 'Learner',
          email: e.trainee?.email || 'N/A',
          department: e.trainee?.department || 'N/A',
          progress: e.progress || 0,
          moduleQuizzesAttempted: moduleAttempts.length,
          moduleQuizAvg,
          finalAttemptId: finalAttempt ? finalAttempt._id : null,
          finalScore: finalAttempt ? finalAttempt.percentage : null,
          finalPassed: finalAttempt ? finalAttempt.passed : null,
          hasCertificate: Boolean(certificate),
          certificateId: certificate?.certificateId || null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        course: {
          _id: course._id,
          title: course.title,
        },
        moduleQuizzesCount: moduleQuizzes.length,
        hasFinalAssessment: Boolean(finalAssessment),
        learners: results,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get trainee's centralized assessments feed (Available & Completed across enrolled courses)
 * @route   GET /api/assessments/my-feed
 * @access  Private (Trainee only)
 */
const getMyAssessmentsFeed = async (req, res, next) => {
  try {
    const traineeId = req.user._id;

    // Find all active/completed enrollments for this trainee
    const enrollments = await Enrollment.find({ trainee: traineeId }).populate({
      path: 'course',
      select: 'title category level status trainer',
      populate: { path: 'trainer', select: 'name email department' },
    });

    const availableAssessments = [];
    const completedAssessments = [];

    for (const enrollment of enrollments) {
      const course = enrollment.course;
      if (!course || course.status !== 'published') continue;

      const courseModules = await Module.find({ course: course._id }).sort({ order: 1 });
      const completedSet = new Set(
        (enrollment.completedModules || []).map((id) => id.toString())
      );
      const allModulesCompleted =
        courseModules.length === 0 ||
        courseModules.every((mod) => completedSet.has(mod._id.toString()));

      // 1. Module Quizzes for this course
      for (const mod of courseModules) {
        const quiz = await Assessment.findOne({
          course: course._id,
          module: mod._id,
          type: 'module',
          status: 'published',
        });

        if (quiz && quiz.questions && quiz.questions.length > 0) {
          const latestAttempt = await QuizAttempt.findOne({
            trainee: traineeId,
            $or: [{ assessment: quiz._id }, { module: mod._id }],
          }).sort({ createdAt: -1 });

          const totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
          const passThreshold = quiz.passingPercentage || 50;

          if (latestAttempt) {
            completedAssessments.push({
              _id: quiz._id,
              type: 'module',
              title: quiz.title || `${mod.title} Quiz`,
              courseId: course._id,
              courseTitle: course.title,
              moduleId: mod._id,
              moduleTitle: mod.title,
              questionCount: quiz.questions.length,
              totalMarks,
              passThreshold,
              latestAttempt: {
                _id: latestAttempt._id,
                score: latestAttempt.score,
                totalMarks: latestAttempt.totalMarks,
                percentage: latestAttempt.percentage,
                passed: latestAttempt.passed,
                createdAt: latestAttempt.createdAt,
              },
            });
          } else {
            availableAssessments.push({
              _id: quiz._id,
              type: 'module',
              title: quiz.title || `${mod.title} Quiz`,
              courseId: course._id,
              courseTitle: course.title,
              moduleId: mod._id,
              moduleTitle: mod.title,
              questionCount: quiz.questions.length,
              totalMarks,
              passThreshold,
              isLocked: false,
            });
          }
        }
      }

      // 2. Final Course Assessment
      const finalAssessment = await Assessment.findOne({
        course: course._id,
        type: 'final',
        status: 'published',
      });

      if (finalAssessment && finalAssessment.questions && finalAssessment.questions.length > 0) {
        const latestAttempt = await QuizAttempt.findOne({
          trainee: traineeId,
          $or: [{ assessment: finalAssessment._id }, { course: course._id, type: 'final' }],
        }).sort({ createdAt: -1 });

        const certificate = await Certificate.findOne({
          trainee: traineeId,
          course: course._id,
        })
          .populate('trainee', 'name email')
          .populate('course', 'title')
          .populate('trainer', 'name');

        const totalMarks = finalAssessment.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
        const passThreshold = finalAssessment.passingPercentage || 60;

        if (latestAttempt) {
          completedAssessments.push({
            _id: finalAssessment._id,
            type: 'final',
            title: finalAssessment.title || `${course.title} Final Assessment`,
            courseId: course._id,
            courseTitle: course.title,
            questionCount: finalAssessment.questions.length,
            totalMarks,
            passThreshold,
            certificate: certificate || null,
            latestAttempt: {
              _id: latestAttempt._id,
              score: latestAttempt.score,
              totalMarks: latestAttempt.totalMarks,
              percentage: latestAttempt.percentage,
              passed: latestAttempt.passed,
              createdAt: latestAttempt.createdAt,
            },
          });
        } else {
          availableAssessments.push({
            _id: finalAssessment._id,
            type: 'final',
            title: finalAssessment.title || `${course.title} Final Assessment`,
            courseId: course._id,
            courseTitle: course.title,
            questionCount: finalAssessment.questions.length,
            totalMarks,
            passThreshold,
            isLocked: !allModulesCompleted,
            totalModules: courseModules.length,
            completedModules: completedSet.size,
          });
        }
      }
    }

    console.log(
      `[GET /api/assessments/my-feed] Trainee: ${req.user.name || traineeId} | Available: ${availableAssessments.length} | Completed: ${completedAssessments.length}`
    );

    return res.status(200).json({
      success: true,
      data: {
        availableAssessments,
        completedAssessments,
      },
    });
  } catch (error) {
    console.error('[GET /api/assessments/my-feed] Error:', error);
    next(error);
  }
};

/**
 * @desc    Get trainer's centralized assessments overview across all their courses
 * @route   GET /api/assessments/trainer-overview
 * @access  Private (Owner Trainer, Admin)
 */
const getTrainerAssessmentsOverview = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { trainer: req.user._id };
    const courses = await Course.find(query).sort({ createdAt: -1 });

    const courseIds = courses.map((c) => c._id);
    const assessments = await Assessment.find({ course: { $in: courseIds } })
      .populate('module', 'title order')
      .populate('course', 'title status');

    const overview = await Promise.all(
      assessments.map(async (ass) => {
        const attempts = await QuizAttempt.find({ assessment: ass._id });
        const passedCount = attempts.filter((a) => a.passed).length;
        const avgScore =
          attempts.length > 0
            ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length)
            : null;

        return {
          _id: ass._id,
          title: ass.title,
          type: ass.type,
          status: ass.status,
          courseId: ass.course?._id,
          courseTitle: ass.course?.title,
          moduleTitle: ass.module?.title || null,
          questionCount: ass.questions?.length || 0,
          totalMarks: ass.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0,
          passingPercentage: ass.passingPercentage || (ass.type === 'final' ? 60 : 50),
          totalAttempts: attempts.length,
          passedCount,
          avgScore,
          updatedAt: ass.updatedAt,
        };
      })
    );

    console.log(
      `[GET /api/assessments/trainer-overview] User: ${req.user.name} | Assessments: ${overview.length}`
    );

    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('[GET /api/assessments/trainer-overview] Error:', error);
    next(error);
  }
};

/**
 * @desc    Get assessment by ID (Sanitized for trainee)
 * @route   GET /api/assessments/:id
 * @access  Private (Authenticated)
 */
const getAssessmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`[GET /api/assessments/${id}] Requested by: ${req.user.email} (${req.user.role})`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn(`[GET /api/assessments/${id}] Invalid ObjectId format`);
      return res.status(400).json({ success: false, message: 'Invalid assessment ID format' });
    }

    const assessment = await Assessment.findById(id)
      .populate('course', 'title trainer')
      .populate('module', 'title order');
    if (!assessment) {
      console.warn(`[GET /api/assessments/${id}] Assessment not found in database`);
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (req.user.role === 'trainee') {
      const enrollment = await Enrollment.findOne({
        trainee: req.user._id,
        course: assessment.course._id,
      });

      if (!enrollment) {
        console.warn(`[GET /api/assessments/${id}] Trainee ${req.user.email} not enrolled in course ${assessment.course._id}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied. You must be enrolled in this course to view this assessment.',
        });
      }

      if (assessment.status !== 'published') {
        return res.status(403).json({
          success: false,
          message: 'Assessment is not published.',
        });
      }

      const latestAttempt = await QuizAttempt.findOne({
        trainee: req.user._id,
        $or: [{ assessment: assessment._id }, { module: assessment.module?._id }],
      }).sort({ createdAt: -1 });

      const sanitized = assessment.toObject();
      sanitized.questions = sanitizeQuestionsForTrainee(assessment.questions);

      console.log(`[GET /api/assessments/${id}] Success -> Title: "${sanitized.title}" (${sanitized.questions.length} Qs)`);

      return res.status(200).json({
        success: true,
        data: {
          assessment: sanitized,
          latestAttempt,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        assessment,
      },
    });
  } catch (error) {
    console.error(`[GET /api/assessments/${req.params.id}] Error:`, error);
    next(error);
  }
};

/**
 * @desc    Get detailed assessment attempt review with question-by-question explanations
 * @route   GET /api/assessments/attempts/:attemptId/review
 * @access  Private (Owner Trainee, Course Trainer, Admin)
 */
const getAssessmentAttemptReview = async (req, res, next) => {
  try {
    const { attemptId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ success: false, message: 'Invalid attempt ID' });
    }

    const attempt = await QuizAttempt.findById(attemptId)
      .populate('trainee', 'name email department')
      .populate('course', 'title category level trainer')
      .populate('module', 'title')
      .populate('assessment', 'title description passingPercentage questions type');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Assessment attempt not found' });
    }

    // Role-based access control
    const userRole = req.user.role;
    const userIdStr = req.user._id.toString();

    if (userRole === 'trainee') {
      if (attempt.trainee?._id?.toString() !== userIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only review your own assessment attempts.',
        });
      }
    } else if (userRole === 'trainer') {
      const courseTrainerId = attempt.course?.trainer?.toString();
      if (courseTrainerId !== userIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only review attempts for courses you instruct.',
        });
      }
    }
    // Admin has platform-wide review permission

    // Reconstruct question-by-question review with explanations
    const assessmentQuestionsMap = new Map();
    if (attempt.assessment && Array.isArray(attempt.assessment.questions)) {
      attempt.assessment.questions.forEach((q) => {
        assessmentQuestionsMap.set(q._id.toString(), q);
      });
    }

    const questionsReview = (attempt.answers || []).map((ans, idx) => {
      const qDoc = assessmentQuestionsMap.get(ans.question?.toString()) || {};
      return {
        questionIndex: idx + 1,
        questionId: ans.question,
        questionText: ans.questionText || qDoc.questionText || `Question ${idx + 1}`,
        optionA: ans.optionA || qDoc.optionA || '',
        optionB: ans.optionB || qDoc.optionB || '',
        optionC: ans.optionC || qDoc.optionC || '',
        optionD: ans.optionD || qDoc.optionD || '',
        selectedOption: ans.selectedOption || '',
        correctOption: ans.correctOption || qDoc.correctOption || '',
        isCorrect: ans.isCorrect,
        marksAwarded: ans.marksAwarded,
        explanation: ans.explanation || qDoc.explanation || '',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        attemptId: attempt._id,
        assessmentTitle: attempt.assessment?.title || 'Assessment Review',
        assessmentType: attempt.type,
        courseTitle: attempt.course?.title || 'Course',
        courseId: attempt.course?._id,
        moduleTitle: attempt.module?.title || null,
        trainee: {
          _id: attempt.trainee?._id,
          name: attempt.trainee?.name,
          email: attempt.trainee?.email,
          department: attempt.trainee?.department,
        },
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        passingPercentage: attempt.assessment?.passingPercentage || 60,
        submittedAt: attempt.submittedAt || attempt.createdAt,
        totalQuestions: questionsReview.length,
        correctCount: questionsReview.filter((q) => q.isCorrect).length,
        incorrectCount: questionsReview.filter((q) => !q.isCorrect).length,
        questions: questionsReview,
      },
    });
  } catch (error) {
    console.error(`[GET /api/assessments/attempts/${req.params.attemptId}/review] Error:`, error);
    next(error);
  }
};

/**
 * @desc    Generate personalized AI explanation for an assessment question after submission (Phase 7.1)
 * @route   POST /api/assessments/attempts/:attemptId/questions/:questionId/explain
 * @access  Private (Attempt Owner Trainee, Admin, Course Owner Trainer)
 */
const explainAssessmentQuestion = async (req, res, next) => {
  try {
    const { attemptId, questionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attemptId) || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ success: false, message: 'Invalid attempt or question ID.' });
    }

    // 1. Rate limiting check
    const rateCheck = checkRateLimit(req.user._id.toString());
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'You have requested multiple AI explanations recently. Please wait a moment before trying again.',
        retryAfterMs: rateCheck.remainingMs,
      });
    }

    // 2. Fetch QuizAttempt with related Course, Module, and Assessment
    const attempt = await QuizAttempt.findById(attemptId)
      .populate({
        path: 'course',
        select: 'title description category level status skills trainer',
        populate: { path: 'skills.skill', select: 'name category' },
      })
      .populate('module', 'title order')
      .populate('assessment');

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Assessment attempt not found.' });
    }

    // 3. RBAC Check: Trainee MUST own the attempt; Trainer can inspect if owns the course; Admin has platform visibility
    const isOwnerTrainee = attempt.trainee.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isOwnerTrainer =
      req.user.role === 'trainer' &&
      attempt.course?.trainer &&
      attempt.course.trainer.toString() === req.user._id.toString();

    if (!isOwnerTrainee && !isAdmin && !isOwnerTrainer) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only request AI explanations for your own assessment attempts.',
      });
    }

    // 4. Anti-Cheat: Attempt MUST have been submitted (not in progress)
    if (!attempt.submittedAt && attempt.percentage === undefined) {
      return res.status(400).json({
        success: false,
        message: 'AI explanations are only available after submitting the assessment.',
      });
    }

    // 5. Find the requested question within the attempt's recorded answers
    const ans = attempt.answers.find(
      (a) =>
        (a.question && a.question.toString() === questionId) ||
        (a._id && a._id.toString() === questionId)
    );

    if (!ans) {
      return res.status(404).json({
        success: false,
        message: 'Question was not found in this assessment attempt.',
      });
    }

    // Lookup original question doc from assessment definition for fallback text/options if needed
    const qDoc =
      attempt.assessment?.questions?.id(ans.question) ||
      attempt.assessment?.questions?.id(questionId) ||
      {};

    const questionText = ans.questionText || qDoc.questionText || 'Assessment Question';
    const optionA = ans.optionA || qDoc.optionA || 'Option A';
    const optionB = ans.optionB || qDoc.optionB || 'Option B';
    const optionC = ans.optionC || qDoc.optionC || 'Option C';
    const optionD = ans.optionD || qDoc.optionD || 'Option D';
    const selectedOption = ans.selectedOption || '';
    const correctOption = ans.correctOption || qDoc.correctOption || 'A';
    const trainerExplanation = ans.explanation || qDoc.explanation || '';
    const marks = ans.marksAwarded !== undefined ? ans.marksAwarded : qDoc.marks || 1;

    // Extract Skill and Proficiency context from course skills
    let skillName = attempt.course?.category || 'General';
    let targetProficiency = 'General';

    if (attempt.course?.skills && attempt.course.skills.length > 0) {
      const primarySkillItem = attempt.course.skills[0];
      if (primarySkillItem.skill?.name) {
        skillName = primarySkillItem.skill.name;
      }
      if (primarySkillItem.proficiency) {
        targetProficiency = primarySkillItem.proficiency;
      }
    }

    // 6. Generate structured explanation via OpenAI service
    const explanationData = await generateQuestionExplanation({
      courseTitle: attempt.course?.title || 'Capacity Connect Course',
      moduleTitle: attempt.module?.title || (attempt.type === 'final' ? 'Final Comprehensive Exam' : ''),
      assessmentType: attempt.type || 'Assessment',
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
    });

    return res.status(200).json({
      success: true,
      data: {
        attemptId: attempt._id,
        questionId,
        questionText,
        selectedOption,
        correctOption,
        isCorrect: ans.isCorrect,
        skill: {
          name: skillName,
          proficiency: targetProficiency,
        },
        trainerExplanation: trainerExplanation || null,
        aiExplanation: explanationData,
      },
    });
  } catch (error) {
    console.error(`[POST /api/assessments/attempts/:attemptId/questions/:questionId/explain] Error:`, error);
    next(error);
  }
};

/**
 * @desc    Generate AI Assessment Questions Grounded in Course/Module Content (Phase 7.7)
 * @route   POST /api/assessments/ai/generate-questions
 * @access  Private (Trainer, Admin)
 */
const generateAiQuestions = async (req, res, next) => {
  try {
    const { courseId, moduleId, count = 5, difficulty = 'medium', topic = '' } = req.body;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required for AI question generation.' });
    }

    const course = await Course.findById(courseId).populate('skills.skill', 'name category');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Strict ownership check
    if (req.user.role === 'trainer') {
      const isOwner = course.trainer.toString() === req.user._id.toString() || course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only generate assessment questions for courses you instruct.',
        });
      }
    }

    let moduleDoc = null;
    if (moduleId) {
      moduleDoc = await Module.findById(moduleId);
      if (!moduleDoc || moduleDoc.course.toString() !== course._id.toString()) {
        return res.status(404).json({ success: false, message: 'Module not found in this course.' });
      }
    }

    // Retrieve attached educational resources
    const resourceFilter = { course: course._id };
    if (moduleId) resourceFilter.module = moduleId;
    const resources = await Resource.find(resourceFilter).select('title description type');

    // Rate limit check
    const rateCheck = checkRateLimit(req.user._id.toString());
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many AI requests. Please wait ${Math.ceil((rateCheck.remainingMs || 5000) / 1000)} seconds before requesting more questions.`,
      });
    }

    const result = await generateAssessmentQuestionsFromContent({
      course,
      moduleDoc,
      resources,
      count: Math.max(1, Math.min(20, parseInt(count, 10) || 5)),
      difficulty,
      topic,
      userId: req.user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      data: {
        questions: result.questions,
        source: result.source,
        contentSummary: result.contentSummary,
      },
    });
  } catch (error) {
    console.error('[POST /api/assessments/ai/generate-questions] Error:', error);
    next(error);
  }
};

/**
 * @desc    Regenerate a Single AI MCQ Question from Course/Module Content (Phase 7.7)
 * @route   POST /api/assessments/ai/regenerate-question
 * @access  Private (Trainer, Admin)
 */
const regenerateSingleAiQuestion = async (req, res, next) => {
  try {
    const { courseId, moduleId, existingQuestionText = '', difficulty = 'medium', topic = '' } = req.body;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required.' });
    }

    const course = await Course.findById(courseId).populate('skills.skill', 'name category');
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Ownership check
    if (req.user.role === 'trainer') {
      const isOwner = course.trainer.toString() === req.user._id.toString() || course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only generate questions for your own courses.',
        });
      }
    }

    let moduleDoc = null;
    if (moduleId) {
      moduleDoc = await Module.findById(moduleId);
    }

    const resources = await Resource.find({ course: course._id, ...(moduleId ? { module: moduleId } : {}) });

    const result = await regenerateSingleQuestionFromContent({
      course,
      moduleDoc,
      resources,
      existingQuestionText,
      difficulty,
      topic,
      userId: req.user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[POST /api/assessments/ai/regenerate-question] Error:', error);
    next(error);
  }
};

/**
 * @desc    Extract & Parse Assessment Questions from Uploaded PDF (Phase 7.7)
 * @route   POST /api/assessments/questions/import-pdf
 * @access  Private (Trainer, Admin)
 */
const importQuestionsFromPdf = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid PDF file.',
      });
    }

    const {
      courseId,
      moduleId,
      importType = 'content_matter',
      count = 5,
      difficulty = 'medium',
      topic = '',
    } = req.body;

    if (!courseId) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ success: false, message: 'courseId is required.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Ownership check
    if (req.user.role === 'trainer') {
      const isOwner = course.trainer.toString() === req.user._id.toString() || course.trainer.toString() === req.user.id;
      if (!isOwner) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only import questions for your own courses.',
        });
      }
    }

    let moduleDoc = null;
    if (moduleId) {
      moduleDoc = await Module.findById(moduleId);
    }

    // Read and extract text from uploaded document (PDF, DOCX, DOC, PPTX, PPT, TXT)
    let pdfText = '';
    try {
      pdfText = await extractTextFromDocument(req.file.path, req.file.originalname);
    } catch (parseErr) {
      console.warn('Document parse error:', parseErr.message);
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: "We couldn't extract readable text from this document. Please upload a standard text-based PDF, Word (.docx), PowerPoint (.pptx), or Text file.",
      });
    } finally {
      // Safe cleanup of temporary uploaded file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {}
    }

    if (!pdfText || pdfText.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "We couldn't extract readable text from this document. The document may be empty or contain only non-OCR images. Please upload a text-based PDF, Word, PPTX, or Text file.",
      });
    }

    let result;
    if (importType === 'question_sheet') {
      // Mode B: Parse existing pre-formatted exam sheet
      result = await parseQuestionsFromPdfText({
        pdfText,
        course,
        moduleDoc,
        userId: req.user._id.toString(),
      });
    } else {
      // Mode A (Default): Generate questions grounded in the PDF study matter
      result = await generateQuestionsFromMatterPdf({
        pdfText,
        count: parseInt(count, 10) || 5,
        difficulty,
        topic,
        course,
        moduleDoc,
        userId: req.user._id.toString(),
      });
    }

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    if (!result.questions || result.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No questions could be generated from this PDF document. Please verify the PDF contains readable text.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        questions: result.questions,
        hasAnswerKey: result.hasAnswerKey ?? true,
        extractedCount: result.questions.length,
        source: result.source,
      },
    });
  } catch (error) {
    console.error('[POST /api/assessments/questions/import-pdf] Error:', error);
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(error);
  }
};

/**
 * @desc    Suggest Answers for Questions without Answer Keys using AI (Phase 7.7)
 * @route   POST /api/assessments/questions/suggest-answers
 * @access  Private (Trainer, Admin)
 */
const suggestAnswersForPdfQuestions = async (req, res, next) => {
  try {
    const { questions, courseId, moduleId } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions array is required.' });
    }

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required.' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    // Ownership check
    if (req.user.role === 'trainer') {
      const isOwner = course.trainer.toString() === req.user._id.toString() || course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.',
        });
      }
    }

    let moduleDoc = null;
    if (moduleId) moduleDoc = await Module.findById(moduleId);

    const result = await suggestAnswersForQuestions({
      questions,
      course,
      moduleDoc,
      userId: req.user._id.toString(),
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[POST /api/assessments/questions/suggest-answers] Error:', error);
    next(error);
  }
};

module.exports = {
  getModuleQuiz,
  saveModuleQuiz,
  getFinalAssessment,
  saveFinalAssessment,
  deleteAssessment,
  toggleAssessmentStatus,
  duplicateAssessment,
  submitAssessmentAttempt,
  getMyAssessmentAttempts,
  getCourseAssessmentResults,
  getMyAssessmentsFeed,
  getTrainerAssessmentsOverview,
  getAssessmentById,
  getAssessmentAttemptReview,
  explainAssessmentQuestion,
  generateAiQuestions,
  regenerateSingleAiQuestion,
  importQuestionsFromPdf,
  suggestAnswersForPdfQuestions,
};

