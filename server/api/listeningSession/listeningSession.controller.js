'use strict';

var _ = require('lodash');
var ListeningSession = require('./listeningSession.model');

// Get list of listeningSessions
exports.index = function(req, res) {
  ListeningSession.find(function (err, listeningSessions) {
    if(err) { return handleError(res, err); }
    return res.json(200, listeningSessions);
  });
};

// Get a single listeningSession
exports.show = function(req, res) {
  ListeningSession.findById(req.params.id, function (err, listeningSession) {
    if(err) { return handleError(res, err); }
    if(!listeningSession) { return res.send(404); }
    return res.json(listeningSession);
  });
};

// Creates a new listeningSession in the DB.
exports.create = function(req, res) {
  // insert time
  var attrs = req.body;
  attrs.startTime = new Date();
  attrs.endTime = new Date(new Date().getTime() + 60*1000);

  // check for already existing listeningSession
  ListeningSession.findOne({ _station: attrs._station,
                          startTime: {
                            $gte: new Date(new Date().getTime() - 90*1000)
                          }
                        }, function (err, currentListeningSession) {
    if (err) { return handleError(res, err); }
    
    // IF one is found, update it
    if (currentListeningSession) {
      var updated = currentListeningSession;
      updated.endTime = attrs.endTime;
      updated.save(function (err) {
        if (err) { return handleError(res, err); }
        return res.json(200, updated);
      });

    // ELSE create a new one
    } else {
      ListeningSession.create(attrs, function(err, listeningSession) {
        if(err) { return handleError(res, err); }
        return res.json(201, listeningSession);
      }); 
    }
  });
};

// Updates an existing listeningSession in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  ListeningSession.findById(req.params.id, function (err, listeningSession) {
    if (err) { return handleError(res, err); }
    if(!listeningSession) { return res.send(404); }

    // if station has changed, create a new listeningSession
    if (listeningSession._station.equals(req.body._station)) {

      var attrs = req.body;
      attrs.startTime = new Date();
      attrs.endTime = new Date(new Date().getTime() + 60*1000);
      attrs._user = listeningSession._user;

      ListeningSession.create(attrs, function(err, newListeningSession) {
        return res.json(201, newListeningSession);
      });
    
    // otherwise just update the time
    } else {
      var updated = listeningSession
      updated.endTime =  new Date(new Date().getTime() + 60*1000);
      updated.save(function (err) {
        if (err) { return handleError(res, err); }
        return res.json(200, updated);
      });
    }
  });
};

// Deletes a listeningSession from the DB.
exports.destroy = function(req, res) {
  ListeningSession.findById(req.params.id, function (err, listeningSession) {
    if(err) { return handleError(res, err); }
    if(!listeningSession) { return res.send(404); }
    listeningSession.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}