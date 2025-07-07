const express = require('express');
const router = express.Router();

const {
  generateKnockoutMatches
} = require('../controllers/knockoutController');

router.post('/generate', generateKnockoutMatches);

module.exports = router;
