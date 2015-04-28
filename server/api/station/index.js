'use strict';

var express = require('express');
var controller = require('./station.controller');
var auth = require('../../auth/auth.service');

var router = express.Router();

router.get('/', controller.index);
router.get('/topStations', auth.isAuthenticated(), controller.topStations);
router.get('/me', auth.isAuthenticated(), controller.me);
router.get('/:id/getRotationItems', auth.isAuthenticated(), controller.getRotationItems)
router.get('/:id/getProgram', auth.isAuthenticated(), controller.getProgram)
router.put('/:id/removeRotationItem', auth.isAuthenticated(), controller.removeRotationItem)
router.put('/:id/updateRotationBin', auth.isAuthenticated(), controller.updateRotationBin)
router.post('/:id/createRotationItem', auth.isAuthenticated(), controller.createRotationItem)
router.get('/:id', controller.show);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.destroy);

module.exports = router;