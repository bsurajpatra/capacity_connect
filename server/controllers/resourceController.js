const fs = require('fs');
const path = require('path');
const Resource = require('../models/Resource');
const Module = require('../models/Module');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const { verifyCourseAccess } = require('../utils/courseOwnership');

/**
 * Determine resource type based on file extension
 */
const detectResourceType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) return 'video';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc', '.docx', '.odt'].includes(ext)) return 'document';
  if (['.ppt', '.pptx'].includes(ext)) return 'presentation';
  if (['.txt', '.csv', '.md'].includes(ext)) return 'text';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return 'image';
  return 'document';
};

/**
 * @desc    Create a new learning resource (File upload or External Link)
 * @route   POST /api/modules/:moduleId/resources
 * @access  Private (Owner Trainer, Admin)
 */
const createResource = async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    const { title, description, type, externalUrl } = req.body;

    const moduleItem = await Module.findById(moduleId);
    if (!moduleItem) {
      // If file was uploaded by multer, clean it up since module does not exist
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Parent module not found',
      });
    }

    const check = await verifyCourseAccess(moduleItem.course, req.user);
    if (!check.authorized) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(check.statusCode).json({
        success: false,
        message: check.message,
      });
    }

    if (!title || !title.trim()) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Resource title is required',
      });
    }

    let resourceType = type;
    let fileName = '';
    let filePath = '';
    let fileSize = 0;
    let validExternalUrl = '';

    if (type === 'link') {
      if (!externalUrl || !externalUrl.trim()) {
        return res.status(400).json({
          success: false,
          message: 'External URL is required for link resources',
        });
      }

      // Validate URL format
      try {
        const urlObj = new URL(externalUrl.trim());
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          throw new Error('Invalid protocol');
        }
        validExternalUrl = externalUrl.trim();
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid web URL starting with http:// or https://',
        });
      }
    } else {
      // File upload scenario
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please select a file to upload or choose external link type',
        });
      }

      fileName = req.file.originalname;
      filePath = `uploads/resources/${req.file.filename}`.replace(/\\/g, '/');
      fileSize = req.file.size;
      resourceType = type || detectResourceType(req.file.originalname);
    }

    const newResource = await Resource.create({
      course: moduleItem.course,
      module: moduleId,
      title: title.trim(),
      description: description ? description.trim() : '',
      type: resourceType,
      fileName,
      filePath,
      fileSize,
      externalUrl: validExternalUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'Resource added successfully',
      data: newResource,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        // ignore
      }
    }
    next(error);
  }
};

/**
 * @desc    Get resources for a module
 * @route   GET /api/modules/:moduleId/resources
 * @access  Public / Authenticated
 */
const getResources = async (req, res, next) => {
  try {
    const { moduleId } = req.params;

    const moduleItem = await Module.findById(moduleId);
    if (!moduleItem) {
      return res.status(404).json({
        success: false,
        message: 'Module not found',
      });
    }

    const course = await Course.findById(moduleItem.course);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Parent course not found',
      });
    }

    // Check authorization
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access learning resources',
      });
    }

    if (req.user.role === 'admin') {
      // Admin authorized
    } else if (req.user.role === 'trainer') {
      const isOwner =
        course.trainer.toString() === req.user._id.toString() ||
        course.trainer.toString() === req.user.id;
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not own this course.',
        });
      }
    } else if (req.user.role === 'trainee') {
      const enrollment = await Enrollment.findOne({
        trainee: req.user._id,
        course: course._id,
        status: { $in: ['active', 'completed'] },
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must enroll in this course to access its learning resources.',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const resources = await Resource.find({ module: moduleId }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: resources.length,
      data: resources,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update resource details (title, description, externalUrl)
 * @route   PUT /api/resources/:id
 * @access  Private (Owner Trainer, Admin)
 */
const updateResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    const check = await verifyCourseAccess(resource.course, req.user);
    if (!check.authorized) {
      return res.status(check.statusCode).json({
        success: false,
        message: check.message,
      });
    }

    const { title, description, externalUrl } = req.body;
    if (title && title.trim()) resource.title = title.trim();
    if (description !== undefined) resource.description = description.trim();
    if (resource.type === 'link' && externalUrl) {
      try {
        new URL(externalUrl.trim());
        resource.externalUrl = externalUrl.trim();
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid URL format',
        });
      }
    }

    await resource.save();

    return res.status(200).json({
      success: true,
      message: 'Resource updated successfully',
      data: resource,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete resource and clean up disk file
 * @route   DELETE /api/resources/:id
 * @access  Private (Owner Trainer, Admin)
 */
const deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found',
      });
    }

    const check = await verifyCourseAccess(resource.course, req.user);
    if (!check.authorized) {
      return res.status(check.statusCode).json({
        success: false,
        message: check.message,
      });
    }

    // Delete local file if present
    if (resource.filePath) {
      const diskPath = path.isAbsolute(resource.filePath)
        ? resource.filePath
        : path.join(__dirname, '..', resource.filePath);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch (unlinkErr) {
          console.warn(`Could not delete file ${diskPath}:`, unlinkErr.message);
        }
      }
    }

    await Resource.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResource,
  getResources,
  updateResource,
  deleteResource,
};
