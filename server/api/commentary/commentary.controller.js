'use strict';

var _ = require('lodash');
var Commentary = require('./commentary.model');
var AudioConverter = require('../../utilities/audioConverter/audioConverter');
var fs = require('fs');
var AudioFileStorageHandler = require('../../utilities/audioFileStorageHandler/audioFileStorageHandler');
var Scheduler = require('../../utilities/scheduler/scheduler');

// Get list of commentarys
exports.index = function(req, res) {
  Commentary.find(function (err, commentarys) {
    if(err) { return handleError(res, err); }
    return res.json(200, commentarys);
  });
};

// Get a single commentary
exports.show = function(req, res) {
  Commentary.findById(req.params.id, function (err, commentary) {
    if(err) { return handleError(res, err); }
    if(!commentary) { return res.send(404); }
    return res.json(commentary);
  });
};

exports.acceptUpload = function (req, res) {
  var oldFilepath = process.cwd() + '/server/data/unprocessedAudio/' + req.files.file.name;
  var newFilepath = oldFilepath + '.wav';
  fs.rename(oldFilepath, newFilepath, function (err) {
    if (err) { return handleError(res, err); }
    AudioConverter.convertFile(process.cwd() + '/server/data/unprocessedAudio/' + req.files.file.name + '.wav', function (err, convertedFilepath) {
      if (err) { return handleError(res, err); }
      AudioFileStorageHandler.storeCommentary({ duration: req.body.duration,
                                                stationId: req.body._station,
                                                filepath: convertedFilepath 
                                              }, function (err, key) {
        if (err) { return handleError(res, err); }
        Commentary.create({ key: key,
                            _station: req.body._station,
                            duration: parseInt(req.body.duration) 
                          }, function (err, createdCommentary) {
          if (err) { return handleError(res, err); }
          Scheduler.insertSpin({ playlistPosition: parseInt(req.body.playlistPosition),
                                  _station: req.body._station,
                                  _audioBlock: createdCommentary.id 
                                }, function (err, updatedStation) {
            Scheduler.getProgram({ stationId: req.body._station }, function (err, program) {
              if (err) { return handleError(res, err); }
              return res.send(200, program);
            });
          });
        });
      });
    });
  });
}

// Creates a new commentary in the DB.
exports.create = function(req, res) {
  Commentary.create(req.body, function(err, commentary) {
    if(err) { return handleError(res, err); }
    return res.json(201, commentary);
  });
};

// Updates an existing commentary in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Commentary.findById(req.params.id, function (err, commentary) {
    if (err) { return handleError(res, err); }
    if(!commentary) { return res.send(404); }
    var updated = _.merge(commentary, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, commentary);
    });
  });
};

// Deletes a commentary from the DB.
exports.destroy = function(req, res) {
  Commentary.findById(req.params.id, function (err, commentary) {
    if(err) { return handleError(res, err); }
    if(!commentary) { return res.send(404); }
    commentary.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}