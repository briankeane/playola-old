'use strict';

var _ = require('lodash');
var Preset = require('./preset.model');

// Get list of presets
exports.index = function(req, res) {
  Preset.find(function (err, presets) {
    if(err) { return handleError(res, err); }
    return res.json(200, presets);
  });
};

// Get a single preset
exports.show = function(req, res) {
  Preset.findById(req.params.id, function (err, preset) {
    if(err) { return handleError(res, err); }
    if(!preset) { return res.send(404); }
    return res.json(preset);
  });
};

// Creates a new preset in the DB.
exports.create = function(req, res) {
  // check to see if it already exists
  Preset.findOne({ _follower: req.user._id,
                   _followee: req.body.followeeId 
              }, function (err, foundPreset) {
   if (err) { return handleError(res, err); }
   if (foundPreset) {
    return res.send(304, foundPreset);
   } else {
    Preset.create(req.body, function(err, preset) {
      if(err) { return handleError(res, err); }
      return res.json(201, preset);
    });
   }
  });
};


// Updates an existing preset in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Preset.findById(req.params.id, function (err, preset) {
    if (err) { return handleError(res, err); }
    if(!preset) { return res.send(404); }
    var updated = _.merge(preset, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, preset);
    });
  });
};

// Deletes a preset from the DB.
exports.destroy = function(req, res) {
  Preset.findById(req.params.id, function (err, preset) {
    if(err) { return handleError(res, err); }
    if(!preset) { return res.send(404); }
    preset.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}