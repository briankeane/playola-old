'use strict';

var _ = require('lodash');
var RotationItem = require('./rotationItem.model');

// Get list of rotationItems
exports.index = function(req, res) {
  RotationItem.find(function (err, rotationItems) {
    if(err) { return handleError(res, err); }
    return res.json(200, rotationItems);
  });
};

// Get a single rotationItem
exports.show = function(req, res) {
  RotationItem.findById(req.params.id, function (err, rotationItem) {
    if(err) { return handleError(res, err); }
    if(!rotationItem) { return res.send(404); }
    return res.json(rotationItem);
  });
};

// Creates a new rotationItem in the DB.
exports.create = function(req, res) {
  RotationItem.create(req.body, function(err, rotationItem) {
    if(err) { return handleError(res, err); }
    return res.json(201, rotationItem);
  });
};

// Updates an existing rotationItem in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  RotationItem.findByIdAndPopulate(req.params.id, function (err, rotationItem) {
    if (err) { return handleError(res, err); }
    if(!rotationItem) { return res.send(404); }

    // modify the song markups if necessary
    var modifiedFlag = false;
    var fieldNames = ['eom', 'boo', 'eoi'];
    for (var i in fieldNames) {
      var key = fieldNames[i];
      if((req.body[key] !== null) && (typeof(rotationItem._song[key]) === 'undefined')) {
        modifiedFlag = true;
        rotationItem._song[key] = req.body[key];
      }
    }

    if (modifiedFlag) {
      rotationItem._song.save();
    }

    var updated = _.merge(rotationItem, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, rotationItem);
    });
  });
};

// Deletes a rotationItem from the DB.
exports.destroy = function(req, res) {
  RotationItem.findById(req.params.id, function (err, rotationItem) {
    if(err) { return handleError(res, err); }
    if(!rotationItem) { return res.send(404); }
    rotationItem.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}