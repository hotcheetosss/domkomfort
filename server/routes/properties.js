const express = require('express');
const ctrl = require('../controllers/propertiesController');

const router = express.Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
