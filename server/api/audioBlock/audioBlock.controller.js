'use strict';

var _ = require('lodash');
var AudioBlock = require('./audioBlock.model');

// Get list of audioBlocks
exports.index = function(req, res) {
  AudioBlock.find(function (err, audioBlocks) {
    if(err) { return handleError(res, err); }
    return res.json(200, audioBlocks);
  });
};

// Get a single audioBlock
exports.show = function(req, res) {
  AudioBlock.findById(req.params.id, function (err, audioBlock) {
    if(err) { return handleError(res, err); }
    if(!audioBlock) { return res.send(404); }
    return res.json(audioBlock);
  });
};

// Creates a new audioBlock in the DB.
exports.create = function(req, res) {
  AudioBlock.create(req.body, function(err, audioBlock) {
    if(err) { return handleError(res, err); }
    return res.json(201, audioBlock);
  });
};

// Updates an existing audioBlock in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  AudioBlock.findById(req.params.id, function (err, audioBlock) {
    if (err) { return handleError(res, err); }
    if(!audioBlock) { return res.send(404); }
    var updated = _.merge(audioBlock, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, audioBlock);
    });
  });
};

// Deletes a audioBlock from the DB.
exports.destroy = function(req, res) {
  AudioBlock.findById(req.params.id, function (err, audioBlock) {
    if(err) { return handleError(res, err); }
    if(!audioBlock) { return res.send(404); }
    audioBlock.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}