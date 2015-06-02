'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var _ = require('lodash');
var timestamps = require('mongoose-timestamp');
var User = require('../user/user.model');
var Station = require('../station/station.model');

var PresetSchema = new Schema({
  _user:        { type: Schema.ObjectId, ref: 'User' },  // following user
  _station:     { type: Schema.ObjectId, ref: 'User' }   // followed station
});

// ***********************************************************
// ******************** Common Queries ***********************
// ***********************************************************
PresetSchema.statics.getFollowers = function (stationId, callback) {
  Preset
  .find({ _station: stationId })
  .exec(function (err, presets) {
    if (err) {
      callback(err);
    } else {
      // grab all those followers and populate them
      var userIds = _.map(presets, function (preset) { return preset._user });

      // IF userIds is empty, just do the callback with an empty array
      if (!userIds.length) {
        callback(null, []);
        return;
      }
      // build the user query
      var query = { $or: [] }
      for (var i=0;i<userIds.length;i++) {
        query['$or'].push({ _id: userIds[i] });
      }

      // make the call
      User
      .find(query)
      .populate('_station')
      .sort('twitterHandle')
      .exec(callback);
    }
  });
}

PresetSchema.statics.getPresets = function (userId, callback) {
  Preset
  .find({ _user: userId })
  .exec(function (err, presets) {
    if (err) {
      callback(err);
    } else {
      var stations = _.map(presets, function (preset) { return preset._station });

      // IF stations is empty, just do the callback with an empty array
      if (!stations.length) {
        callback(null, []);
        return;
      }

      // build the station query
      var query = { $or: [] }
      for (var i=0;i<stations.length;i++) {
        query['$or'].push({ _id: stations[i] })
      }

      Station
      .find(query)
      .populate('_user')
      .exec(function (err, stations) {
        if (err) {
          callback(err);
        } else {
          stations = _.sortByAll(stations, ['user.twitterHandle']);
          callback(null, stations);
        }
      });
    }
  });
};

PresetSchema.plugin(timestamps);
var Preset = mongoose.model('Preset', PresetSchema);
module.exports = Preset; 