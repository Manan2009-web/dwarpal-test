const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');

const profileUploadDir = path.join(env.uploadsDir, 'profiles');
fs.mkdirSync(profileUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, profileUploadDir);
  },
  filename: (req, file, callback) => {
    const safeFileName = file.originalname
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.-]/g, '');

    callback(null, `${Date.now()}-${req.user?._id || 'user'}-${safeFileName}`);
  }
});

function fileFilter(req, file, callback) {
  if (file.mimetype.startsWith('image/')) {
    return callback(null, true);
  }

  return callback(new Error('Only image files are allowed'));
}

const profileUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

module.exports = {
  profileUpload
};
