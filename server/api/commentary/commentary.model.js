'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var extend = require('mongoose-schema-extend');
var AudioBlockSchema = require('../audioBlock/audioBlock.schema');
var Station = require('../station/station.model');
var timestamps = require('mongoose-timestamp');

var commentarySchema = AudioBlockSchema.extend({
  _station:            { type: Schema.ObjectId, ref: 'Station' },
  title:               { type: String, default: 'Commentary' }
}, {
  toObject: { getters: true },
  toJSON:   { getters: true }
});


commentarySchema.virtual('audioFileUrl').get(function () {
  if (!this.key) {
    return null;
  } else {
    if (process.env.NODE_ENV === 'production') {
      return 'http://commentaries.playola.fm/' + this.key;
    } else if (process.env.NODE_ENV === 'development') {
      return 'https://s3-us-west-2.amazonaws.com/playolacommentariesdevelopment/' + this.key;
    } else { // ELSE TEST
      return 'https://s3-us-west-2.amazonaws.com/playolacommentariestest/' + this.key;
    }
  }
});


var Commentary = mongoose.model('Commentary', commentarySchema);
module.exports = Commentary;