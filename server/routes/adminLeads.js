const express = require('express');
const ctrl = require('../controllers/adminLeadsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/',           ctrl.list);
router.get('/:id',        ctrl.getOne);
router.put('/:id',        ctrl.update);
router.delete('/:id',     requireRole('admin'), ctrl.remove);

module.exports = router;