const express = require('express');
const ctrl = require('../controllers/adminPropertiesController');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Все роуты требуют логина
router.use(requireAuth);

// Список и просмотр — agent + admin
router.get('/',     ctrl.list);
router.get('/:id',  ctrl.getOne);

// Создание, редактирование — agent + admin
router.post('/',        ctrl.create);
router.put('/:id',      ctrl.update);

// Деактивация — agent + admin
router.post('/:id/deactivate', ctrl.deactivate);

// Полное удаление — только админ
router.delete('/:id', requireRole('admin'), ctrl.remove);

// Фото
router.post('/:id/photos',         upload.array('photos', 20), ctrl.uploadPhotos);
router.delete('/:id/photos',       ctrl.deletePhoto);
router.put('/:id/photos/reorder',  ctrl.reorderPhotos);

module.exports = router;