'use strict';

var _ = require('lodash');
var CommercialBlock = require('./commercialBlock.model');

// Get list of commercialBlocks
exports.index = function(req, res) {
  CommercialBlock.find(function (err, commercialBlocks) {
    if(err) { return handleError(res, err); }
    return res.json(200, commercialBlocks);
  });
};

// Get a single commercialBlock
exports.show = function(req, res) {
  CommercialBlock.findById(req.params.id, function (err, commercialBlock) {
    if(err) { return handleError(res, err); }
    if(!commercialBlock) { return res.send(404); }
    return res.json(commercialBlock);
  });
};

// Creates a new commercialBlock in the DB.
exports.create = function(req, res) {
  CommercialBlock.create(req.body, function(err, commercialBlock) {
    if(err) { return handleError(res, err); }
    return res.json(201, commercialBlock);
  });
};

// Updates an existing commercialBlock in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  CommercialBlock.findById(req.params.id, function (err, commercialBlock) {
    if (err) { return handleError(res, err); }
    if(!commercialBlock) { return res.send(404); }
    var updated = _.merge(commercialBlock, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, commercialBlock);
    });
  });
};

// Deletes a commercialBlock from the DB.
exports.destroy = function(req, res) {
  CommercialBlock.findById(req.params.id, function (err, commercialBlock) {
    if(err) { return handleError(res, err); }
    if(!commercialBlock) { return res.send(404); }
    commercialBlock.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}