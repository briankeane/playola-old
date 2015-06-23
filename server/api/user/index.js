'use strict';

var express = require('express');
var controller = require('./user.controller');
var auth = require('../../auth/auth.service');

var router = express.Router();

router.get('/', auth.hasRole('admin'), controller.index);
router.delete('/:id', auth.hasRole('admin'), controller.destroy);
router.get('/me', auth.isAuthenticated(), controller.me);
router.get('/me/presets', auth.isAuthenticated(), controller.getMyPresets)
router.put('/me/follow', auth.isAuthenticated(), controller.meFollow)
router.get('/findByKeywords', controller.findByKeywords);
router.put('/:id/password', auth.isAuthenticated(), controller.changePassword);
router.get('/:id/twitterFriends', auth.isAuthenticated(), controller.twitterFriends);
router.get('/:id', auth.isAuthenticated(), controller.show);
router.get('/:id/presets', auth.isAuthenticated(), controller.presets);
router.post('/', controller.create);
router.put('/:id/update', auth.isAuthenticated(), controller.update);
router.put('/:id/setZipcode', auth.isAuthenticated(), controller.setZipcode);
router.put('/:id/follow', auth.isAuthenticated(), controller.follow);
router.put('/:id/unfollow', auth.isAuthenticated(), controller.unfollow);
router.put('/:id/reportTourTaken', auth.isAuthenticated(), controller.reportTourTaken);


module.exports = router;