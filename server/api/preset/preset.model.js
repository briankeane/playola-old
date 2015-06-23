'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var _ = require('lodash');
var timestamps = require('mongoose-timestamp');
var User = require('../user/user.model');
var Station = require('../station/station.model');

var PresetSchema = new Schema({
  _follower:          { type: Schema.ObjectId, ref: 'User' },  // following user
  _followee:          { type: Schema.ObjectId, ref: 'User' }   // followed station
});

// ***********************************************************
// ******************** Common Queries ***********************
// ***********************************************************
PresetSchema.statics.getFollowers = function (_followee, callback) {
  Preset
  .find({ _followee: _followee })
  .exec(function (err, presets) {
    if (err) {
      callback(err);
    } else {
      // grab all those followers and populate them
      var followerIds = _.map(presets, function (preset) { return preset._follower });

      // IF userIds is empty, just do the callback with an empty array
      if (!followerIds.length) {
        callback(null, []);
        return;
      }
      // build the user query
      var query = { $or: [] }
      for (var i=0;i<followerIds.length;i++) {
        query['$or'].push({ _id: followerIds[i] });
      }

      // make the call
      User
      .find(query)
      .populate('_station')
      .sort('twitterHandle')
      .exec(function (err, users) {
        if (err) {
          callback(err);
        } else {
        // fix station population
          for (var i=0;i<users.length;i++) {
            users[i].station = users[i]._station;
            users[i]._station = users[i].station._id;
          }
          callback(null, users);
        }
      });

    }
  });
}

PresetSchema.statics.getPresets = function (_follower, callback) {
  Preset
  .find({ _follower: _follower })
  .exec(function (err, presets) {
    if (err) {
      callback(err);
    } else {
      var followeeIds = _.map(presets, function (preset) { return preset._followee });

      // IF stations is empty, just do the callback with an empty array
      if (!followeeIds.length) {
        callback(null, []);
        return;
      }

      // build the station query
      var query = { $or: [] }
      for (var i=0;i<followeeIds.length;i++) {
        query['$or'].push({ _id: followeeIds[i] })
      }

      User
      .find(query)
      .populate('_station')
      .sort('twitterHandle')
      .exec(function (err, users) {
        if (err) {
          callback(err);
        } else {

          // fix population output
          for (var i=0;i<users.length;i++) {
            users[i].station = users[i]._station
            users[i]._station = users[i].station._id
          }
          callback(null, users);
        }
      });
    }
  });
};

PresetSchema.plugin(timestamps);
var Preset = mongoose.model('Preset', PresetSchema);
module.exports = Preset; 