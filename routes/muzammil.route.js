const express = require('express');
const { Audio } = require('../controller/format-conversion/contoller');
const { ResolutionScaling, BitrateControl, FormatCompatibility } = require('../controller/vedio/contoller');
const { mixAudio } = require('../controller/audio/contoller');


const router = express.Router();

// Basic Format Conversion
router.post('/audio', Audio);

// Video Processing
router.post('/vedio/resolutionscaling', ResolutionScaling);
router.post('/vedio/bitratecontrol', BitrateControl);
router.post('/vedio/formatcompatibility', FormatCompatibility);

// audio
router.post('/audio/mixaudio', mixAudio);

module.exports = router;
