const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/assessmentController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const assessmentPdfUpload = require('../middleware/assessmentPdfUpload');

// Phase 7.7: AI Question Generation & PDF Question Import Routes
router.post(
  '/assessments/ai/generate-questions',
  protect,
  authorizeRoles('trainer', 'admin'),
  generateAiQuestions
);
router.post(
  '/assessments/ai/regenerate-question',
  protect,
  authorizeRoles('trainer', 'admin'),
  regenerateSingleAiQuestion
);
router.post(
  '/assessments/questions/import-pdf',
  protect,
  authorizeRoles('trainer', 'admin'),
  assessmentPdfUpload.single('file'),
  importQuestionsFromPdf
);
router.post(
  '/assessments/questions/suggest-answers',
  protect,
  authorizeRoles('trainer', 'admin'),
  suggestAnswersForPdfQuestions
);

// Assessment Attempt Review Route (With Explanations)
router.get('/assessments/attempts/:attemptId/review', protect, getAssessmentAttemptReview);
router.get('/attempts/:attemptId/review', protect, getAssessmentAttemptReview);

// AI Question Explanation Route (Phase 7.1)
router.post(
  '/assessments/attempts/:attemptId/questions/:questionId/explain',
  protect,
  explainAssessmentQuestion
);
router.post(
  '/attempts/:attemptId/questions/:questionId/explain',
  protect,
  explainAssessmentQuestion
);

// Centralized Assessment Feed & Overview Routes (Defined before /assessments/:id)
router.get('/assessments/my-feed', protect, authorizeRoles('trainee'), getMyAssessmentsFeed);
router.get(
  '/assessments/trainer-overview',
  protect,
  authorizeRoles('trainer', 'admin'),
  getTrainerAssessmentsOverview
);

// Module Quiz Routes
router.get('/modules/:moduleId/quiz', protect, getModuleQuiz);
router.post('/modules/:moduleId/quiz', protect, authorizeRoles('trainer', 'admin'), saveModuleQuiz);

// Final Course Assessment Routes
router.get('/courses/:courseId/final-assessment', protect, getFinalAssessment);
router.post(
  '/courses/:courseId/final-assessment',
  protect,
  authorizeRoles('trainer', 'admin'),
  saveFinalAssessment
);

// Assessment Details & Management Routes
router.get('/assessments/:id', protect, getAssessmentById);
router.delete('/assessments/:id', protect, authorizeRoles('trainer', 'admin'), deleteAssessment);
router.put(
  '/assessments/:id/status',
  protect,
  authorizeRoles('trainer', 'admin'),
  toggleAssessmentStatus
);
router.post(
  '/assessments/:id/duplicate',
  protect,
  authorizeRoles('trainer', 'admin'),
  duplicateAssessment
);

// Trainee Attempt & Results Routes
router.post('/assessments/:id/attempt', protect, authorizeRoles('trainee'), submitAssessmentAttempt);
router.get(
  '/assessments/:id/my-attempts',
  protect,
  authorizeRoles('trainee'),
  getMyAssessmentAttempts
);

// Trainer & Admin Enrolled Assessment Results Roster Route
router.get(
  '/courses/:courseId/trainer-results',
  protect,
  authorizeRoles('trainer', 'admin'),
  getCourseAssessmentResults
);

module.exports = router;
