import multer from 'multer';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const memoryStorage = multer.memoryStorage();

export const contractAttachmentUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Use PDF, DOC, DOCX, PNG, JPG, WEBP, or TXT.'));
    }
  },
}).single('file');
