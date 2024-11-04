const express = require('express');
const { convertAudioExtractor } = require('../controller/audio/extractionController.js');
const { convertVolumeAdjustment } = require('../controller/audio/volAdjustmentController.js');
const { convertChannelControl } = require('../controller/audio/channelControlController.js');
const { removeSilence } = require('../controller/audio/slienceRemoval.js');

const router = express.Router();

router.post('/audio/extractor', convertAudioExtractor);
router.post('/audio/voladjustment', convertVolumeAdjustment);
router.post('/audio/channelcontrol', convertChannelControl);
router.post('/audio/slienceremover', removeSilence);

module.exports = router;
