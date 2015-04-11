'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var extend = require('mongoose-schema-extend');
var AudioBlockSchema = require('../audioBlock/audioBlock.schema');
var Station = require('../station/station.model');
var timestamps = require('mongoose-timestamp');

var logEntrySchema = new Schema({
  playlistPosition:   { type: Number },
  _audioBlock:        { type: Schema.ObjectId, ref: 'AudioBlock' },
  _station:           { type: Schema.ObjectId, ref: 'Station' },
  airtime:            { type: Date },
  listenersAtStart:   { type: Number },
  listenersAtFinish:  { type: Number },
  durationOffset:     { type: Number, default: 0 },
  commercialsFollow:  { type: Boolean },
  manualEndTime:      { type: Date    }
}, {
  toObject: { getters: true },
  toJSON:   { getters: true }
});

// *******************************************************
// * endTime -- calculates the end of the log entry      *
// *******************************************************
logEntrySchema.virtual('endTime').get(function () {
  if (this.manualEndTime) {
    return this.manualEndTime;
  } else {
    // if it's missing the audioBlock, duration, or airtime, return null
    if (!((this.airtime) && (this._audioBlock) && (this._audioBlock.duration))) {
      return null;
    } else {
      return new Date(this.airtime.getTime() + this.duration);
    }
  }
});

// *************************************************************
// * duration -- calculates the duration of the log entry      *
// *************************************************************
logEntrySchema.virtual('duration').get(function () {
  // if something is stored in _audioBlock
  if (this._audioBlock) {

    // get _audioBlock if it hasn't already been populated
    if (this._audioBlock.duration) {
      return this._audioBlock.duration + this.durationOffset;
    } else {
      return null;
    } 
  }
});


// ***********************************************************
// ******************** Common Queries ***********************
// ***********************************************************
logEntrySchema.statics.getRecent = function (attrs, callback) {
  // if there's no count, set the limit 
  if (!attrs.count) { 
    attrs.count = 1000; 
  }

  LogEntry
  .find({ _station: attrs._station })
  .sort('-airtime')
  .limit(attrs.count)
  .populate('_station _audioBlock')
  .exec(callback);
};

logEntrySchema.statics.getMostRecent = function (stationId, callback) {
  LogEntry.find({ _station: stationId })
  .sort('-airtime')
  .limit(1)
  .populate('_audioBlock')
  .exec(function (err, logEntries) {
    
    callback(err, logEntries[0])
  });
};

logEntrySchema.statics.getFullStationLog = function (stationId, callback) {
  LogEntry
  .find({ _station: stationId })
  .sort('-airtime')
  .populate('_station _audioBlock')
  .exec(callback);
};

logEntrySchema.statics.getLog = function (attrs, callback) {
  var query = { $and: [{ _station: attrs._station}] };
  
  // add endTime limit to query
  if (attrs.endTime) {
    query['$and'].push({ airtime: { $lte: attrs.endTime } });
  }

  // add startTime limit to query
  if (attrs.startTime) {
    query['$and'].push({ airtime: { $gte: attrs.startTime } });
  }

  // add startingPlaylistPosition limit to query
  if (attrs.startingPlaylistPosition) {
    query['$and'].push({ playlistPosition: { $gte: attrs.startingPlaylistPosition } });
  }

  // add endingPlaylistPosition limit to query
  if (attrs.endingPlaylistPosition) {
    query['$and'].push({ playlistPosition: { $lte: attrs.endingPlaylistPosition } });
  }

  // add endDate limit to query
  if (attrs.endDate) {
    // reset date to midnight
    attrs.endDate.setDate(attrs.endDate.getDate() + 1);
    attrs.endDate.setHours(0,0,0,0);
    query['$and'].push({ airtime: { $lte: attrs.endDate } });
  }
  // add startDate limit to query
  if (attrs.startDate) {
    query['$and'].push({ airtime: { $gte: attrs.startDate } });
  }
  

  LogEntry
  .find(query)
  .sort('airtime')
  .populate('_station _audioBlock')
  .exec(callback);
};

logEntrySchema.statics.getEntryByPlaylistPosition = function (attrs, callback) {
  LogEntry
  .findOne({ _station: attrs._station, playlistPosition: attrs.playlistPosition })
  .populate('_station _audioBlock')
  .exec(callback);
};

// ***********************************************************************
// * newFromSpin -- creates a log entry from a spin. Does not delete the *
// * spin.                                                               *
// ***********************************************************************
logEntrySchema.statics.newFromSpin = function (spin) {
  return new LogEntry({ _station: (spin._station._id || spin._station),
                        playlistPosition: spin.playlistPosition,
                        _audioBlock: (spin._audioBlock._id || spin._audioBlock),
                        airtime: spin.airtime,
                        commercialsFollow: spin.commercialsFollow,
                        durationOffset: spin.durationOffset || 0,
                        manualEndTime: spin.manualEndTime });
}


// *************************************
logEntrySchema.plugin(timestamps);
var LogEntry = mongoose.model('LogEntry', logEntrySchema);
module.exports = LogEntry;