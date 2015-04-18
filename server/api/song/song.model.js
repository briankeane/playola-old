'use strict';

var random = require('mongoose-simple-random');
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
var extend = require('mongoose-schema-extend');
var AudioBlockSchema = require('../audioBlock/audioBlock.schema');

var songSchema = AudioBlockSchema.extend({
  artist:                 { type: String },
  title:                  { type: String },
  album:                  { type: String },
  echonestId:             { type: String },
  albumArtworkUrl:        { type: String },
  albumArtworkUrlSmall:   { type: String },
  trackViewUrl:           { type: String },
  eoi:                    { type: Number },
  eom:                    { type: Number },
  boo:                    { type: Number },
  itunesInfo:             {}
}, {
  toObject: { getters: true },
  toJSON: { getters: true }
});

// ***********************************************************
// ************************ Statics **************************
// ***********************************************************
songSchema.virtual('audioFileUrl').get(function () {
  if (!this.key) {
    return null;
  } else {
    if (process.env.NODE_ENV === 'production') {
      return 'http://songs.playola.fm/' + this.key;
    } else if (process.env.NODE_ENV === 'development') {
      return 'https://s3-us-west-2.amazonaws.com/playolasongsdevelopment/' + this.key;
    } else { // ELSE TEST
      return 'https://s3-us-west-2.amazonaws.com/playolasongstest/' + this.key;
    }
  }
});

songSchema.statics.findAllMatchingTitle = function (title, cb) {
  Song
  .find({ _type: 'Song', title: new RegExp('^'+title, "i") })
  .sort('title')
  .exec(cb);
}

songSchema.statics.findAllMatchingArtist = function (artist, cb) {
  Song
  .find({ _type: 'Song', artist: new RegExp('^'+artist, "i") })
  .sort('title')
  .exec(cb);
}

songSchema.statics.keywordSearch = function (keywords, cb) {
  // create an array of regex's
  var keywordsArray = keywords.split(' ');
  var keywordsRegexs = [];
  for (var i=0; i<keywordsArray.length; i++) {
    keywordsRegexs.push(new RegExp(keywordsArray[i], "i"));
  }

  // build the query
  var query = { '_type': 'Song',
                $and: [] };
  for (var i=0; i<keywordsRegexs.length; i++) {
    query['$and'].push({ $or: [{ title: keywordsRegexs[i] }, { artist: keywordsRegexs[i] }] });
  }

  Song
  .find(query)
  .sort({ artist: 1, title: 1 })
  .limit(20)
  .exec(cb);
}

songSchema.statics.findAllByTitleAndArtist = function (queryObject, cb) {
  queryObject["_type"] = "Song";

  Song
  .find(queryObject)
  .sort({ artist: 1, title: 1 })
  .exec(cb);
}

songSchema.statics.all = function (cb) {
  Song
  .find({ "_type": 'Song' })
  .sort({ artist: 1, title: 1 })
  .exec(cb);
}

// *************************************
songSchema.plugin(random);
var Song = mongoose.model('Song', songSchema);
module.exports = Song;