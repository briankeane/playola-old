'use strict';

var Preset = require('../preset/preset.model');
var User = require('./user.model');
var passport = require('passport');
var config = require('../../config/environment');
var jwt = require('jsonwebtoken');
var TimezoneFinder = require('../../utilities/timezoneFinder/timezoneFinder');
var _ = require('lodash');

var validationError = function(res, err) {
  return res.json(422, err);
};

/**
 * Get list of users
 * restriction: 'admin'
 */
exports.index = function(req, res) {
  User.find({}, '-salt -hashedPassword', function (err, users) {
    if(err) return res.send(500, err);
    res.json(200, users);
  });
};

/**
 * Creates a new user
 */
exports.create = function (req, res, next) {
  var newUser = new User(req.body);
  newUser.provider = 'local';
  newUser.role = 'user';
  newUser.save(function(err, user) {
    if (err) return validationError(res, err);
    var token = jwt.sign({_id: user._id }, config.secrets.session, { expiresInMinutes: 60*5 });
    res.json({ token: token });
  });
};

/**
 * Get a single user
 */
exports.show = function (req, res, next) {
  var userId = req.params.id;

  User.findById(userId, function (err, user) {
    if (err) return next(err);
    if (!user) return res.send(401);
    res.json(user.profile);
  });
};

exports.twitterFriends = function(req, res, next) {
  User.findById(req.params.id, function (err, user) {
    if (err) return next(err);
    if (!user) return res.send(401);

    // build the query
    var query = { $or: [] };
    for (var i=0;i<user.twitter.friends.length;i++) {
      query["$or"].push({ twitterHandle: user.twitter.friends[i].screen_name });
    }

    // if none are on playola, return blank array
    if (!query["$or"].length) {
      return res.json(200, { friends: [] });
    
    // otherwise grab the stations
    } else {
      User
      .find(query)
      .populate('_station')
      .exec(function (err, users) {
        return res.json(200, { friends: users });
      })
    }
  });
};

exports.follow = function (req, res) {
  var followerId = req.params.followerId;
  var followeeId = req.body.followeeId;

  // check for already following
  Preset.findOne({ _follower: followerId,
                   _followee: followeeId 
              }, function (err, preset) {
    if (err) { return res.send(err); }
    
    // IF already following, just get the list of presets and send it with 200
    if (preset) { 
      Preset.getPresets(followerId, function (err, presets) {
        if (err) { return res.send(err); }
        return res.json(200, { presets: presets });
      });

    // otherwise, create the preset and return a new current preset list
    } else {
      Preset.create({ _follower: followerId,
                      _followee: followeeId
                    }, function (err, newPresetItem) {
        if (err) { return res.send(err); }
        Preset.getPresets(userId, function (err, presets) {

          // grab the new preset to include separately, too
          var newPreset;
          for (var i=0;i<presets.length;i++) {
            if (presets[i]._id.equals(newPresetItem._station)) {
              newPreset = presets[i];
            }
          }
          return res.send(201, { presets: presets,
                                newPreset: newPreset });
        });
      });
    } // endIF
  });
}

exports.meFollow = function (req, res) {
  req.params.followerId = req.user.id;
}

exports.unfollow = function (req, res) {
  var userId = req.params.id;
  var stationId = req.body.stationId;

  // Find the station 
  Preset.findOneAndRemove({ _user: userId, _station: stationId }, function (err, removed) {
    if (!removed) { return res.send(401); }
    Preset.getPresets(userId, function (err, presets) {
      return res.send(201, { presets: presets });
    });
  });
};

// Updates an existing user in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  User.findById(req.params.id, function (err, user) {
    if (err) { return handleError(res, err); }
    if(!user) { return res.send(404); }
    var updated = _.merge(user, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, user);
    });
  });
};

exports.reportTourTaken = function (req,res) {
  User.findById(req.params.id, function (err, user) {
    if (err) { return handleError(res, err); }
    if (!user) { return res.send(404); }
    
    var tourObject = user.tours;

    if (!tourObject) {
      tourObject = {};
    }
    tourObject[req.body.tour] = true;
    user.tours = tourObject;
    user.markModified('tours');
    user.save(function (err, updatedUser) {
      if (err) { return handleError(res, err); }
      return res.json(200, updatedUser);
    });
  });
};

exports.findByKeywords = function (req, res) {
  User.keywordSearch(req.query.searchString, function (err, searchResults) {
    if (err) { return res.send(500, err); }
    return res.json(200, { searchResults: searchResults });
  });
};

/**
 * Deletes a user
 * restriction: 'admin'
 */
exports.destroy = function(req, res) {
  User.findByIdAndRemove(req.params.id, function(err, user) {
    if(err) return res.send(500, err);
    return res.send(204);
  });
};

/**
 * Change a users password
 */
exports.changePassword = function(req, res, next) {
  var userId = req.user._id;
  if (req.body.oldPassword) {
    var oldPass = String(req.body.oldPassword);
  } else {
    var oldPass = ""
  }
  var newPass = String(req.body.newPassword);

  User.findById(userId, function (err, user) {
    // if they have no old password, or if the old password was correct...
  console.log(oldPass.length);
  console.log(user.password);
  console.log(user.hashedPassword);

    if(user.authenticate(oldPass) || (!oldPass.length && (!user.password)))  {
      user.password = newPass;
      user.save(function(err) {
        if (err) return validationError(res, err);
        res.send(200);
      });
    } else {
      res.send(403);
    }
  });
};
/**
 * Sets the zipcode
 */
exports.setZipcode = function(req, res, next) {
  var userId = req.user._id;
  TimezoneFinder.findByZip(req.body.zipcode, function (err, timezone) {
    if(err) { console.log(err); return res.send(422, { message: err.message }); }
    User.findById(userId, function (err, user) {
      if (err) { return res.json(400); }
      if(!user) { return res.send(404); }
      User.findByIdAndUpdate(userId, { zipcode: req.body.zipcode, timezone: timezone }, function (err, updatedUser) {
        if (err) { return err; }
        return res.json(200, updatedUser);
      });
    });
  });
};

exports.presets = function (req, res) {
  Preset.getPresets(req.params.id, function (err, presets) {
    if (err) { return res.send(500, err); }
    return res.json(200, { presets: presets })
  });
}

exports.getMyPresets = function (req,res) {
  req.params.id = user.id;
  return self.presets(req.res)
}


exports.me = function(req, res, next) {
  var userId = req.user._id;
  User.findOne({ _id: userId })
  .select('-salt -hashedPassword')
  .populate('_station')
  .exec(function (err, user) { // don't ever give out the password or salt
    if (err) return next(err);
    if (!user) return res.json(401);
    res.json(user);
  });
};

exports.search = function (req, res, next) {
  var keywordString = req.keywordString
  User.keywordSearch(req.keywordString, function (err, list) {
    if (err) return next(err);
    if (!list) return res.send(200, { users: [] });
    return res.json(200, { users: list });
  });
}


function handleError(res, err) {
  return res.send(500, err);
}

/**
 * Authentication callback
 */
exports.authCallback = function(req, res, next) {
  res.redirect('/');
};
