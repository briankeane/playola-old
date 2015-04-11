'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var extend = require('mongoose-schema-extend');
var AudioBlockSchema = require('../audioBlock/audioBlock.schema');

var commercialBlockSchema = AudioBlockSchema.extend({
  precedingPlaylistPosition:        { type: Number }
});

var CommercialBlock = mongoose.model('CommercialBlock', commercialBlockSchema);
module.exports = CommercialBlock;