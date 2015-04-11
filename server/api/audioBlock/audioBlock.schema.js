'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var extend = require('mongoose-schema-extend');
var timestamps = require('mongoose-timestamp')

var AudioBlockSchema = new Schema({
  type:               { type: String },
  key:                { type: String },
  duration:           { type: Number }
}, { collection: 'audioBlocks', discriminatorKey: '_type' });

AudioBlockSchema.plugin(timestamps);
module.exports = AudioBlockSchema