const express = require('express');
const publicController = require('../controllers/publicController');
const siteConfigController = require('../controllers/siteConfigController');

const router = express.Router();

router.get('/frontend-config', publicController.getFrontendConfig);
router.get('/site-config', siteConfigController.getPublicConfig);

module.exports = router;

