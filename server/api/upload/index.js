'use strict';

var express = require('express');
var controller = require('./upload.controller');

var router = express.Router();

router.get('/', controller.index);
router.get('/:id', controller.show);
router.post('/', controller.create);
router.put('/:id/submitViaEchonestId', controller.submitViaEchonestId);
router.put('/:id/resubmitWithUpdatedTags', controller.resubmitWithUpdatedTags);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;