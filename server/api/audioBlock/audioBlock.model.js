'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var AudioBlockSchema = require('./audioBlock.schema');

module.exports = mongoose.model('AudioBlock', AudioBlockSchema);