const express = require('express');
const ctrl = require('../controllers/adminAgentsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

// Просмотр — все авторизованные
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Редактирование — agent (свой) или admin (любой)
router.put('/:id', ctrl.update);

// Загрузка аватара — agent (свой) или admin
router.post('/:id/avatar', upload.single('avatar'), ctrl.uploadAvatar);

// Только admin: создание, удаление, управление аккаунтами
router.post('/',                     requireRole('admin'), ctrl.create);
router.delete('/:id',                requireRole('admin'), ctrl.remove);
router.post('/:id/account',          requireRole('admin'), ctrl.createAccount);
router.post('/:id/account/password', requireRole('admin'), ctrl.resetPassword);
router.post('/:id/account/toggle',   requireRole('admin'), ctrl.toggleActive);

module.exports = router;