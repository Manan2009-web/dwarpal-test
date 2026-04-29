const express = require('express');
const debugController = require('../controllers/debugController');

const router = express.Router();

router.get('/email', debugController.sendEmailDebugTest);

module.exports = router;
