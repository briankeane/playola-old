'use strict';

var _ = require('lodash');
var LogEntry = require('./logEntry.model');

// Get list of logEntrys
exports.index = function(req, res) {
  LogEntry.find(function (err, logEntrys) {
    if(err) { return handleError(res, err); }
    return res.json(200, logEntrys);
  });
};

// Get a single logEntry
exports.show = function(req, res) {
  LogEntry.findById(req.params.id, function (err, logEntry) {
    if(err) { return handleError(res, err); }
    if(!logEntry) { return res.send(404); }
    return res.json(logEntry);
  });
};

// Creates a new logEntry in the DB.
exports.create = function(req, res) {
  LogEntry.create(req.body, function(err, logEntry) {
    if(err) { return handleError(res, err); }
    return res.json(201, logEntry);
  });
};

// Updates an existing logEntry in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  LogEntry.findById(req.params.id, function (err, logEntry) {
    if (err) { return handleError(res, err); }
    if(!logEntry) { return res.send(404); }
    var updated = _.merge(logEntry, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, logEntry);
    });
  });
};

// Deletes a logEntry from the DB.
exports.destroy = function(req, res) {
  LogEntry.findById(req.params.id, function (err, logEntry) {
    if(err) { return handleError(res, err); }
    if(!logEntry) { return res.send(404); }
    logEntry.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}