const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const QuizAttempt = require('../models/QuizAttempt');
const Certificate = require('../models/Certificate');
const Module = require('../models/Module');
const Assessment = require('../models/Assessment');

/**
 * @desc    Get consolidated list of learners enrolled in trainer's courses
 * @route   GET /api/trainer/learners
 * @access  Private / Trainer
 */
const getTrainerLearners = async (req, res, next) => {
  try {
    const trainerId = req.user._id;
    const { courseId } = req.query || {};

    // 1. Fetch courses owned strictly by this trainer
    const courseQuery = { trainer: trainerId };
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      courseQuery._id = courseId;
    }

    const trainerCourses = await Course.find(courseQuery)
      .select('_id title category level skills')
      .populate('skills.skill', 'name category');
    const courseIds = trainerCourses.map((c) => c._id);

    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // 2. Fetch all enrollments, certificates, and quiz attempts for trainer's courses
    const [enrollments, certificates, quizAttempts] = await Promise.all([
      Enrollment.find({ course: { $in: courseIds } })
        .populate('trainee', 'name email department isActive createdAt')
        .populate('course', 'title category level skills')
        .sort({ updatedAt: -1 }),
      Certificate.find({
        course: { $in: courseIds },
        status: 'valid',
      }).select('trainee course certificateId percentage issueDate'),
      QuizAttempt.find({ course: { $in: courseIds } })
        .populate('trainee', 'name email')
        .populate('assessment', 'title type passingPercentage')
        .sort({ submittedAt: -1 }),
    ]);

    const certMap = new Map();
    certificates.forEach((c) => {
      const key = `${c.trainee.toString()}_${c.course.toString()}`;
      certMap.set(key, c);
    });

    const attemptsMap = new Map();
    quizAttempts.forEach((a) => {
      const tId = a.trainee?._id?.toString() || a.trainee?.toString();
      const cId = a.course?.toString();
      const key = `${tId}_${cId}`;
      if (!attemptsMap.has(key)) attemptsMap.set(key, []);
      attemptsMap.get(key).push(a);
    });

    // 3. Group by Trainee (Unique Learners)
    const learnerMap = new Map();

    enrollments.forEach((e) => {
      if (!e.trainee) return;
      const tId = e.trainee._id.toString();
      const cId = e.course?._id?.toString() || e.course?.toString();
      const certKey = `${tId}_${cId}`;
      const hasCert = certMap.has(certKey);
      const courseAttempts = attemptsMap.get(certKey) || [];

      const totalAttempts = courseAttempts.length;
      const passedAttempts = courseAttempts.filter((a) => a.passed).length;
      const failedAttempts = totalAttempts - passedAttempts;
      const avgScore = totalAttempts > 0
        ? Math.round(courseAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / totalAttempts)
        : null;
      const latestAttempt = courseAttempts[0] || null;

      const progress = e.progress || 0;
      let status = 'In Progress';
      if (e.status === 'completed' || progress === 100) {
        status = 'Completed';
      } else if (failedAttempts >= 2 || (totalAttempts > 0 && avgScore !== null && avgScore < 50)) {
        status = 'At Risk';
      } else if (progress <= 0 && totalAttempts === 0) {
        status = 'Not Started';
      }

      // Compute current skill level
      let currentSkillLevel = 'Beginner';
      if (status === 'Completed' || (avgScore !== null && avgScore >= 80)) {
        currentSkillLevel = e.course?.level === 'advanced' ? 'Advanced' : 'Proficient';
      } else if (progress >= 50 || (avgScore !== null && avgScore >= 60)) {
        currentSkillLevel = 'Proficient';
      }

      if (!learnerMap.has(tId)) {
        learnerMap.set(tId, {
          trainee: {
            _id: e.trainee._id,
            name: e.trainee.name,
            email: e.trainee.email,
            department: e.trainee.department || 'General',
            isActive: e.trainee.isActive,
            createdAt: e.trainee.createdAt,
          },
          coursesEnrolledCount: 0,
          coursesCompletedCount: 0,
          totalProgressSum: 0,
          certificatesEarnedCount: 0,
          lastActivity: e.updatedAt || e.createdAt,
          enrolledCourses: [],
          status,
          averageScore: avgScore,
          currentSkillLevel,
          enrolledAt: e.createdAt,
          courseProgress: progress,
        });
      }

      const entry = learnerMap.get(tId);
      entry.coursesEnrolledCount += 1;
      entry.totalProgressSum += progress;

      if (status === 'Completed') {
        entry.coursesCompletedCount += 1;
      }
      if (hasCert) {
        entry.certificatesEarnedCount += 1;
      }

      const enrollmentLastActivity = latestAttempt?.submittedAt || e.updatedAt || e.createdAt;
      if (new Date(enrollmentLastActivity) > new Date(entry.lastActivity)) {
        entry.lastActivity = enrollmentLastActivity;
      }

      // If viewing single course, adopt that course's status and scores directly
      if (courseId) {
        entry.status = status;
        entry.averageScore = avgScore;
        entry.latestScore = latestAttempt ? latestAttempt.percentage : null;
        entry.currentSkillLevel = currentSkillLevel;
        entry.courseProgress = progress;
        entry.enrolledAt = e.createdAt;
        entry.failedAttemptsCount = failedAttempts;
        entry.passedAttemptsCount = passedAttempts;
      }

      entry.enrolledCourses.push({
        courseId: e.course?._id,
        courseTitle: e.course?.title,
        category: e.course?.category,
        level: e.course?.level,
        progress,
        status,
        hasCertificate: hasCert,
        averageScore: avgScore,
        currentSkillLevel,
        enrolledAt: e.createdAt,
        lastActivity: enrollmentLastActivity,
        attempts: courseAttempts.map((a) => ({
          attemptId: a._id,
          assessmentTitle: a.assessment?.title || 'Assessment',
          type: a.type,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage: a.percentage,
          passed: a.passed,
          submittedAt: a.submittedAt,
        })),
      });
    });

    const learners = Array.from(learnerMap.values()).map((item) => ({
      trainee: item.trainee,
      coursesEnrolledCount: item.coursesEnrolledCount,
      coursesCompletedCount: item.coursesCompletedCount,
      averageProgress:
        item.coursesEnrolledCount > 0
          ? Math.round(item.totalProgressSum / item.coursesEnrolledCount)
          : 0,
      certificatesEarnedCount: item.certificatesEarnedCount,
      lastActivity: item.lastActivity,
      status: item.status,
      averageScore: item.averageScore,
      latestScore: item.latestScore,
      currentSkillLevel: item.currentSkillLevel,
      enrolledAt: item.enrolledAt,
      courseProgress: item.courseProgress !== undefined ? item.courseProgress : (item.coursesEnrolledCount > 0 ? Math.round(item.totalProgressSum / item.coursesEnrolledCount) : 0),
      failedAttemptsCount: item.failedAttemptsCount || 0,
      passedAttemptsCount: item.passedAttemptsCount || 0,
      enrolledCourses: item.enrolledCourses,
    }));

    return res.status(200).json({
      success: true,
      count: learners.length,
      data: learners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed learner progress strictly for trainer's owned courses
 * @route   GET /api/trainer/learners/:id
 * @access  Private / Trainer
 */
const getTrainerLearnerDetails = async (req, res, next) => {
  try {
    const trainerId = req.user._id;
    const traineeId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(traineeId)) {
      return res.status(400).json({ success: false, message: 'Invalid learner ID' });
    }

    const trainee = await User.findOne({ _id: traineeId, role: 'trainee' }).select('-password');
    if (!trainee) {
      return res.status(404).json({ success: false, message: 'Learner not found' });
    }

    // 1. Fetch courses owned strictly by this trainer
    const trainerCourses = await Course.find({ trainer: trainerId }).select('_id title category level');
    const courseIds = trainerCourses.map((c) => c._id);

    // 2. Fetch enrollments for this trainee strictly in trainer's courses
    const enrollments = await Enrollment.find({
      trainee: traineeId,
      course: { $in: courseIds },
    })
      .populate('course', 'title category level status')
      .sort({ createdAt: -1 });

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This learner is not enrolled in any of your courses.',
      });
    }

    // 3. Fetch modules, assessments, quiz attempts, and certificates for trainer's courses only
    const [modules, assessments, quizAttempts, certificates] = await Promise.all([
      Module.find({ course: { $in: courseIds } }).select('_id title course order'),
      Assessment.find({ course: { $in: courseIds } }).select('_id title course module type passingPercentage'),
      QuizAttempt.find({ trainee: traineeId, course: { $in: courseIds } })
        .populate('assessment', 'title type passingPercentage')
        .populate('course', 'title')
        .sort({ submittedAt: -1 }),
      Certificate.find({
        trainee: traineeId,
        course: { $in: courseIds },
        status: 'valid',
      }),
    ]);

    const certMap = new Map();
    certificates.forEach((c) => {
      certMap.set(c.course.toString(), c);
    });

    const courseBreakdown = enrollments.map((e) => {
      const cIdStr = e.course?._id?.toString();
      const courseModules = modules.filter((m) => m.course?.toString() === cIdStr);
      const courseAssessments = assessments.filter((a) => a.course?.toString() === cIdStr);
      const courseAttempts = quizAttempts.filter((a) => a.course?._id?.toString() === cIdStr);
      const cert = certMap.get(cIdStr);

      const completedModuleIds = new Set(
        (e.completedModules || []).map((id) => id.toString())
      );

      return {
        courseId: e.course?._id,
        courseTitle: e.course?.title,
        category: e.course?.category,
        level: e.course?.level,
        progress: e.progress,
        status: e.status,
        enrolledAt: e.createdAt,
        completedAt: e.completedAt,
        totalModulesCount: courseModules.length,
        completedModulesCount: completedModuleIds.size,
        modules: courseModules.map((m) => ({
          moduleId: m._id,
          title: m.title,
          isCompleted: completedModuleIds.has(m._id.toString()),
        })),
        attempts: courseAttempts.map((att) => ({
          attemptId: att._id,
          assessmentTitle: att.assessment?.title || 'Quiz',
          type: att.type,
          score: att.score,
          totalMarks: att.totalMarks,
          percentage: att.percentage,
          passed: att.passed,
          submittedAt: att.submittedAt,
        })),
        certificate: cert
          ? {
              certificateId: cert.certificateId,
              percentage: cert.percentage,
              issueDate: cert.issueDate || cert.issuedAt,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        learner: trainee,
        summary: {
          trainerCoursesEnrolled: enrollments.length,
          trainerCoursesCompleted: courseBreakdown.filter((c) => c.status === 'completed' || c.progress === 100).length,
          certificatesEarned: certificates.length,
        },
        courses: courseBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTrainerLearners,
  getTrainerLearnerDetails,
};
