'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var ListeningSessionSchema = new Schema({
  startTime:          { type: Date },
  endTime:            { type: Date },
  _user:              { type: Schema.ObjectId, ref: 'User'  },
  _station:           { type: Schema.ObjectId, ref: 'Station' }
});

ListeningSessionSchema.plugin(timestamps);
module.exports = mongoose.model('ListeningSession', ListeningSessionSchema);