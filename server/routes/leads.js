const express = require('express');
const ctrl = require('../controllers/leadsController');

const router = express.Router();

router.post('/', ctrl.create);

module.exports = router;
