'use strict';

var _ = require('lodash');
var Station = require('./station.model');
var RotationItem = require('../rotationItem/rotationItem.model');
var Spin = require('../spin/spin.model');
var User = require('../user/user.model');
var LogEntry = require('../logEntry/logEntry.model');
var SongPool = require('../../utilities/songPoolHandlerEmitter/songPoolHandlerEmitter');
var Scheduler = require('../../utilities/scheduler/scheduler');


// Get list of stations
exports.index = function(req, res) {
  Station.find(function (err, stations) {
    if(err) { return handleError(res, err); }
    return res.json(200, stations);
  });
};

// Get a single station
exports.show = function(req, res) {
  Station.findById(req.params.id, function (err, station) {
    if(err) { return handleError(res, err); }
    if(!station) { return res.send(404); }
    return res.json(station);
  });
};

// Creates a new station in the DB.
exports.create = function(req, res) {
  User.findOne({ _id: req.body._user }, function (err, user) {
    if (err) { return res.json(500, err); }
    if (!user) { return res.json(404, { message: 'User not found' } ); }
    if (user._station) { return res.json(409, { message: 'Station Already Exists' }); }

    Station.create({ _user: req.body._user,
                  timezone: user.timezone }, function (err, station) {
      if (err) { 
        return res.json(500, err); 
      } else {

        // load the station with rotationItems based on the artists they suggested
        SongPool.getSongSuggestions(req.body.artists, function (err, songSuggestions) {
          if (err) { return res.json(500, err); }
          if (!songSuggestions.length) { return res.json(500, { message: 'No Songs Suggested' }); }
          
          // initial ratio is 3/4/7 -- 16 units
          var unitSize = Math.floor(songSuggestions.length/16.0);

          // shuffle the collection
          songSuggestions = _.shuffle(songSuggestions)
          
          for (var i=0;i<songSuggestions.length;i++) {

            // put the first 4 in heavy rotation
            if (i<=unitSize*4) {
              RotationItem.create({ _song: songSuggestions[i]._id, 
                                    _station: station._id,
                                    bin: 'heavy' });
            // the next 5 go in medium rotation
            } else if (i<=unitSize*9) {
              RotationItem.create({ _song: songSuggestions[i]._id,
                                    _station: station._id,
                                    bin: 'medium' });
            // the rest go in light rotation
            } else {
              RotationItem.create({ _song: songSuggestions[i]._id,
                                    _station: station._id,
                                    bin: 'light' });
            
            }
          }

          // update the user with the new station's id
          user.update({ _station: station._id }, function (err, updatedUser) {
            if (err) { 
              return res.json(500, err) 
            } else {
              return res.json(201, station);
            }

          });

        });
      }
    });
  });
};

exports.topStations = function(req, res) {
  Station.listByRank({}, function (err, topStations) {
    if (err) { return handleError(res, err); }
    return res.json(200, { topStations: topStations });
  });
}

// Updates an existing station in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Station.findById(req.params.id, function (err, station) {
    if (err) { return handleError(res, err); }
    if(!station) { return res.send(404); }
    var updated = _.merge(station, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, station);
    });
  });
};

// Deletes a station from the DB.
exports.destroy = function(req, res) {
  Station.findById(req.params.id, function (err, station) {
    if(err) { return handleError(res, err); }
    if(!station) { return res.send(404); }
    station.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

exports.me = function(req, res, next) {
  var userId = req.user._id;
  Station.findOne({
    _user: userId
  }, function(err, station) { // don't ever give out the password or salt
    if (err) return next(err);
    if (!station) return res.json(401);
    res.json(station);
  });
};

exports.getRotationItems = function(req, res, next) {
  RotationItem.findAllForStation(req.params.id, function (err, rotationItems) {
    if (err) return next(err);

    var rotationItemsObject = createRotationItemsObject(rotationItems);

    return res.json({ rotationItems: rotationItemsObject });
  });
};

exports.removeRotationItem = function (req,res,next) {
  RotationItem.findById(req.body.rotationItemId, function (err, rotationItem) {
    if (err) return next(err);
    if (!rotationItem) return res.json(401);

    rotationItem.updateBin('inactive', function (err, updatedRotationItem) {
      if (err) return next(err);

      RotationItem.findAllForStation(rotationItem._station, function (err, rotationItems) {
        if (err) return next(err);

        var rotationItemsObject = createRotationItemsObject(rotationItems);
        return res.json({ rotationItems: rotationItemsObject });
      });
    });
  });
};

exports.createRotationItem = function (req,res) {
  // if it's been populated, replace it song with unpopulated field for query
  if (req.body._song._id) {
    req.body._song = req.body._song._id;
  }
  RotationItem.updateBySongId(req.body, function (err, newRotationItem) {
    if (err) { return res.json(500, err); }
    RotationItem.findAllForStation(newRotationItem._station, function (err, updatedRotationItems) {
      if (err) return res(500, err);

      var rotationItemsObject = createRotationItemsObject(updatedRotationItems);

      return res.json({ newRotationItem: newRotationItem, rotationItems: rotationItemsObject });
    });
  });
};

exports.updateRotationWeight = function (req,res,next) {
  RotationItem.findById(req.body.rotationItemId, function (err, rotationItem) {
    if (err) return next(err);
    if (!rotationItem) return res.json(401);

    rotationItem.updateWeight(req.body.weight, function (err, updatedRotationItem) {
      if (err) return next(err);

      RotationItem.findAllForStation(rotationItem._station, function (err, rotationItems) {
        if (err) return next(err);

        var rotationItemsObject = createRotationItemsObject(rotationItems);
        return res.json({ rotationItems: rotationItemsObject });
      });
    });
  });
};

exports.getProgram = function (req,res,next) {
  Scheduler.getProgram({ stationId: req.params.id }, function (err, programObject) {
    if (err) return next(err);

    // if a CommercialBlock is about to be broadcast, grab the proper CommercialBlock for the requesting user
    if ((programObject.nowPlaying._audioBlock._type === 'CommercialBlock') || (programObject.playlist.length && (programObject.playlist[0]._audioBlock._type === 'CommercialBlock'))) {
      // if no user is provided, just return the program with the empty commercial blocks
      if (!req.query._user) {
        return res.json(200, programObject);

      } else {
        // Replace nowPlaying if necessary
        if (programObject.nowPlaying._audioBlock._type === 'CommercialBlock') {
          Scheduler.getCommercialBlockLink({ _user: req.query._user,
                                              airtime: programObject.nowPlaying.airtime
                                            }, function (err, link) {
            programObject.nowPlaying._audioBlock.audioFileUrl = link;
            programObject.nowPlaying._audioBlock.duration = programObject._station.secsOfCommercialPerHour/2*1000;
            programObject.nowPlaying.duration = programObject._station.secsOfCommercialPerHour/2*1000;
            return res.json(200, programObject);
          });

        // ELSE replace playlist[0] if it's the commercial block
        } else {
          Scheduler.getCommercialBlockLink({ _user: req.query._user,
                                              airtime: programObject.playlist[0].airtime,
                                            }, function (err, link) {
            programObject.playlist[0]._audioBlock.audioFileUrl = link;
            programObject.playlist[0]._audioBlock.duration = programObject._station.secsOfCommercialPerHour/2*1000;
            programObject.playlist[0].duration = programObject._station.secsOfCommercialPerHour/2*1000;
            return res.json(200, programObject);
          });
        }
      }
    } else {
      return res.json(200, programObject);
    }
  });
};

function createRotationItemsObject(rotationItems) {
  var rotationItemsObject = {};

  for (var i=0;i<rotationItems.length;i++) {
    
    // don't include rotationItems that have been deleted
    if (rotationItems[i].bin != 'inactive') {
      if (!rotationItemsObject[rotationItems[i].bin]) {
        rotationItemsObject[rotationItems[i].bin] = [];
      }
    }

    rotationItemsObject[rotationItems[i].bin].push(rotationItems[i]);
  }
  return rotationItemsObject;
}

function handleError(res, err) {
  return res.send(500, err);
}