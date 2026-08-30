const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Temporary directory for uploaded assessment document files
const tempDir = path.join(__dirname, '../uploads/temp_assessments');

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `assessment-${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (ALLOWED_EXTENSIONS.includes(extension)) {
    return cb(null, true);
  }

  cb(
    new Error(
      'Invalid file type. Supported document formats include PDF (.pdf), Word (.docx, .doc), PowerPoint (.pptx, .ppt), and Text (.txt, .md).'
    )
  );
};

const assessmentPdfUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB maximum file size
  fileFilter,
});

module.exports = assessmentPdfUpload;
