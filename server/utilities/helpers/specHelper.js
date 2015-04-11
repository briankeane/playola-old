var async = require('async');

var AudioBlock = require('../../api/audioBlock/audioBlock.model');
var LogEntry = require('../../api/logEntry/logEntry.model');
var Commentary = require('../../api/commentary/commentary.model');
var RotationItem = require('../../api/rotationItem/rotationItem.model');
var Song = require('../../api/song/song.model');
var Spin = require('../../api/spin/spin.model');
var Station = require('../../api/station/station.model');
var User = require('../../api/user/user.model');
var Preset = require('../../api/preset/preset.model');
var _ = require('lodash');

function Helper() {
  
  var self = this;

  this.saveAll = function (objects, callback) {
    var functions = [];
    
    for (var i=0; i < objects.length; i++) {
      functions.push((function(obj) {
          return function(callback) {
              obj.save(callback);
          };
        })(objects[i]));
    }

    async.parallel(functions, function (err, results) {
      // format results
      results = _.map(results, function(result) { return result[0]; });
      callback(err, results);
    });
  };
  
  this.clearDatabase = function (callback) {
    models = [
              AudioBlock, 
              RotationItem, 
              Spin, 
              Station, 
              User,
              LogEntry,
              Preset
              ]

    var functions = [];

    for (var i=0; i < models.length; i++) {
      functions.push((function(model) {
          return function(callback) {
              model.remove({}, callback);
          };
      })(models[i]));
    }

    async.parallel(functions, function (err, results) {
      callback(err, results);
    });
  };
  
  this.loadSongs = function (count, callback) {
    var songs = [];

    for (var i=0;i<count;i++) {
      songs.push(new Song({ artist: 'artist#: ' + i,
                            title: 'title#: '+ i,
                            album: 'album#: ' + i,
                            duration: 181000,
                            key: 'key#: '+ i,
                            echonestId: 'echonestId#:' + i }));
    }
    self.saveAll(songs, function (err, results) {
      callback(err, results);
    });
  }
}

module.exports = new Helper();