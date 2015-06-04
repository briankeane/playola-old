'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var Station = require('../station/station.model');
var AudioBlock = require('../audioBlock/audioBlock.model')
var timestamps = require('mongoose-timestamp');

var spinSchema = new Schema({
  playlistPosition:       { type: Number                              },
  _audioBlock:            { type: Schema.ObjectId, ref: 'AudioBlock'  },
  _station:               { type: Schema.ObjectId, ref: 'Station'     },
  airtime:                { type: Date                                },
  durationOffset:         { type: Number, default: 0                  },
  manualDuration:         { type: Number                              },
  _endTime:          { type: Date                                },
  previousSpinOverlap:    { type: Number                              }
}, {
  toObject: { getters: true },
  toJSON: { virtuals: true }
});

spinSchema.virtual('endTime').get(function () {
  if (this.manalEndTime) {
    return this._endTime;
  } else {

    // if it's missing the audioBlock, duration, or airtime, return null
    if (!((this.airtime) && (this._audioBlock) && (this._audioBlock.duration))) {
      return null;
    } else {
      return new Date(this.airtime.getTime() + this.duration);
    }
  }
});

spinSchema.virtual('duration').get(function () {
  // if something is stored in manualDuration, use that
  if (this.manualDuration) {
    return this.manualDuration;
  } else {
    // if something is stored in _audioBlock
    if (this._audioBlock) {

      // get _audioBlock if it hasn't already been populated
      if (this._audioBlock.duration) {
        return this._audioBlock.duration + this.durationOffset;
      } else {
        return null;
      } 
    }
  }
});

// ****************************************************************
// ********************** commercialsFollow ***********************
// ****************************************************************
// * Commercials are placed after the top and bottom of           *
// * the hour.  This method checks to see if the spin crosses     *
// * over the hour or half-hour mark                              *
// ****************************************************************
spinSchema.virtual('commercialsFollow').get(function () {
  if (!(this.airtime) || !(this.duration) || (!this.endTime)) {
    return null;
  } else {
    // if beginning and end of spin are in different time 'blocks'
    if (Math.floor(this.airtime.getTime()/1800000.0) !== Math.floor(this.endTime.getTime()/1800000.0)) {
      return true;
    } else {
      return false;
    }
  }
});


// ****************************************************************
// *************************** Statics ****************************
// ****************************************************************

spinSchema.statics.getFullPlaylist = function (stationId, callback) {
  Spin
  .find({ _station: stationId })
  .populate('_audioBlock')
  .sort('playlistPosition')
  .exec(callback);
};

spinSchema.statics.getPartialPlaylist = function (attrs, callback) {
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

  Spin
  .find(query)
  .populate('_audioBlock')
  .sort('playlistPosition')
  .exec(callback);
}

spinSchema.statics.getByPlaylistPosition = function (attrs, callback) {
  Spin
  .findOne({ _station: attrs._station, playlistPosition: attrs.playlistPosition })
  .populate('_audioBlock')
  .exec(callback);
};


// *************************************
spinSchema.plugin(timestamps);
var Spin = mongoose.model('Spin', spinSchema);
module.exports = Spin;