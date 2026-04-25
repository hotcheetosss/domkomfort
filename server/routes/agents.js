const express = require('express');
const ctrl = require('../controllers/agentsController');

const router = express.Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
