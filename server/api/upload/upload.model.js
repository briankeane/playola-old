'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var UploadSchema = new Schema({
  filename: String,
  tags: {},
  possibleMatches: [{}],
  status: String,
  key: String
});

UploadSchema.plugin(timestamps);
module.exports = mongoose.model('Upload', UploadSchema);