'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');
var moment = require('moment');
var Song = require('../song/song.model');
var Station = require('../station/station.model');

moment().format();

var rotationItemSchema = new Schema({
  _station:             { type: Schema.ObjectId, ref: 'Station' },
  _song:                { type: Schema.ObjectId, ref: 'Song' },
  _eom:                 { type: Number },
  _boo:                 { type: Number },
  _eoi:                 { type: Number },
  bin:                  { type: String },
  assignedAt:           { type: Date, default: Date.now() },
  history: [
              { 
                bin:          { type: String},
                weight:       { type: Number},
                assignedAt:   { type: Date} 
              }
            ]
},  {
  toObject: { getters: true },
  toJSON: { virtuals: true }
});

var markerGetGenerator = function(field) {
  var fieldName = '_' + field;
  return function() {
    if (this[fieldName] === null) {
      return null;
    } else if (typeof(this[fieldName]) !== 'undefined') {
      return this[fieldName];
    } else {
      if (this._song) {
        return this._song[field];
      } else {
        return null;
      }
    }
  }
}

var markerSetGenerator = function(field) {
  return function(value) {
    this['_' + field] = value;
  }
}

rotationItemSchema.virtual('eom').get(markerGetGenerator('eom'));
rotationItemSchema.virtual('eom').set(markerSetGenerator('eom'));
rotationItemSchema.virtual('boo').get(markerGetGenerator('boo'));
rotationItemSchema.virtual('boo').set(markerSetGenerator('boo'));
rotationItemSchema.virtual('eoi').get(markerGetGenerator('eoi'));
rotationItemSchema.virtual('eoi').set(markerSetGenerator('eoi'));

// ***********************************************************
// ******************** Common Queries ***********************
// ***********************************************************

rotationItemSchema.statics.findByIdAndPopulate = function (id, callback) {
  RotationItem
  .findById(id)
  .populate('_station _song')
  .exec(callback);
};

rotationItemSchema.statics.findAllForStation = function (stationId, callback) {
  RotationItem
  .find({ _station: stationId })
  .populate('_song')
  .sort('bin -weight')
  .exec(callback);
};

rotationItemSchema.statics.addSongToBin = function (attrs, callback) {
  RotationItem.findOne({ _station: attrs._station,
                          _song: attrs._song }, function (err, rotationItem) {
    // if the song has never been in rotation
    if (!rotationItem) {
      RotationItem.create(attrs, function (err, newRotationItem) {
        if (err) {
          callback(err);
        } else {
          callback(null, newRotationItem);
        }
      })

    // otherwise if the song has been in rotation before
    } else {
      //update the bin
      rotationItem.updateBin(attrs.bin, function (err, updatedRotationItem) {
        if (err) {
          callback(err);
        } else { 
          callback(null, updatedRotationItem);
        }
      });
    }
  });
}


// ***********************************************************
// ************************ Methods **************************
// **********************************************************
rotationItemSchema.methods.updateBin = function (bin, callback) {
  // do nothing if there is no change
  if (this.bin === bin) {
    callback(null, this);
  } else {
    // store the old values in history array
    this.history.push({ bin: this.bin,
                        assignedAt: this.assignedAt });

    // update new values
    this.bin = bin;
    this.assignedAt = Date.now();
    this.save(callback);
  }
};

// *************************************
rotationItemSchema.plugin(timestamps);
var RotationItem = mongoose.model('RotationItem', rotationItemSchema);
module.exports = RotationItem;