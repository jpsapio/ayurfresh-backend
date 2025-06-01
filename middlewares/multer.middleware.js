import multer from 'multer';

const storage = multer.memoryStorage();

export const uploadProductImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
}).array('images', 4);