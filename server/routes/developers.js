const express = require('express');
const ctrl = require('../controllers/developersController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/',       ctrl.list);
router.post('/',      ctrl.create);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;