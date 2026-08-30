const mongoose = require('mongoose');
const Course = require('../models/Course');

/**
 * Validates course existence and checks whether the user is the owner trainer or an admin
 * @param {string} courseId - Course MongoDB ID
 * @param {Object} user - Authenticated user (req.user)
 * @returns {Promise<{ authorized: boolean, course: Object|null, statusCode: number, message: string }>}
 */
const verifyCourseAccess = async (courseId, user) => {
  if (!courseId || !mongoose.Types.ObjectId.isValid(String(courseId))) {
    return {
      authorized: false,
      course: null,
      statusCode: 400,
      message: 'Invalid or missing Course ID',
    };
  }

  const course = await Course.findById(courseId);

  if (!course) {
    return {
      authorized: false,
      course: null,
      statusCode: 404,
      message: 'Course not found',
    };
  }

  // Admin has platform-wide permission
  if (user.role === 'admin') {
    return {
      authorized: true,
      course,
      statusCode: 200,
      message: 'Authorized (Admin)',
    };
  }

  // Trainer must be the creator of the course
  if (user.role === 'trainer') {
    const isOwner = course.trainer.toString() === user._id.toString() || course.trainer.toString() === user.id;
    if (isOwner) {
      return {
        authorized: true,
        course,
        statusCode: 200,
        message: 'Authorized (Owner Trainer)',
      };
    }
  }

  return {
    authorized: false,
    course,
    statusCode: 403,
    message: 'Access denied. You do not have permission to manage this course.',
  };
};

module.exports = {
  verifyCourseAccess,
};
