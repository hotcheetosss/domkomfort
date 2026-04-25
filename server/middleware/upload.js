const multer = require('multer');

// Храним в памяти (Buffer) — sharp потом обработает и сохранит
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Разрешены только JPEG, PNG, WEBP'), false);
  }
  cb(null, true);
};

// Ограничения: макс. 15 МБ на файл, макс. 20 файлов за раз
module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 20,
  },
});