var config = require('../../config/environment');
var echojs = require('echojs');
var _ = require('lodash');
var Song = require('../../api/song/song.model');
var events = require('events');
var Helper = require('../helpers/helper');
var Q = require('q');

function Handler() {
  var self = this;
  var echo = echojs({ key: config.ECHONEST_KEY });

  this.addSong = function (song) {
    return this.addSongs([song]);
  };

  this.getAllSongs = function() {
    var echo = echojs({ key: config.ECHONEST_KEY });
    var emitter = new events.EventEmitter();
    var allSongs = [];

    function getChunkOfSongs(startingIndex) {
      echo('tasteprofile/read').get({ id: config.ECHONEST_TASTE_PROFILE_ID, results: 300, start: startingIndex }, function (err, json) {
        if (err) { 
          emitter.emit('finish', err, null);
          return;
        }

        var items = json.response["catalog"]["items"];
        for(var i=0;i<items.length;i++) {
          allSongs.push({ artist: items[i]["item_keyvalues"]["pl_artist"],
                          title: items[i]["item_keyvalues"]["pl_title"],
                          album: items[i]["item_keyvalues"]["pl_album"] || null,
                          key: items[i]["item_keyvalues"]["pl_key"],
                          duration: parseInt(items[i]["item_keyvalues"]["pl_duration"]),
                          echonestId: items[i]["song_id"] 
                        });
        }
        var newStartingIndex = startingIndex + 300;
        if (newStartingIndex < json.response["catalog"]["total"]) {
          getChunkOfSongs(newStartingIndex);
        } else {
          allSongs = _.sortBy(allSongs, function (song) { return [song.artist, song.title] });
          emitter.emit('finish', null, allSongs);
        }
      });
    }

    getChunkOfSongs(0);
    return emitter;
  };

  this.clearAllSongs = function () {
    echo = echojs({ key: config.ECHONEST_KEY })
    var emitter = new events.EventEmitter();

    function deleteChunkOfSongs() {
      echo('tasteprofile/read').get({ id: config.ECHONEST_TASTE_PROFILE_ID, results: 1000 }, function (err, json) {

        // if there's an error, exit with error
        if (err) { 
          emitter.emit('finish', err);
          return;
         }

         // if there are no songs, finish and leave
        if (!json.response["catalog"]["items"].length) { 
          emitter.emit('finish');
          return;
        }

        // map array of strings
        var deleteObjectArray = _.map(json.response["catalog"]["items"], function (item) {
          var deleteItem = '{' +
                              '"action": "delete",' + 
                              '"item": { ' +
                              '"item_id": "' + item["request"]["item_id"] + '"' +
                              '}' + 
                            '}';
          return deleteItem;
        });

        // create string json-array
        var data = '[' + deleteObjectArray.join(', ') + ']';

        echo('tasteprofile/update').post({ id: config.ECHONEST_TASTE_PROFILE_ID, data: data }, function (err, json) {
          if (err) { emitter.emit('finish', err); }

          waitForCompletedTicket(json.response["ticket"], function () {
            echo('tasteprofile/read').get({ id: config.ECHONEST_TASTE_PROFILE_ID, results: 1000 }, function (err, newJson) {
              if (newJson.response["catalog"]["items"].length) {
                deleteChunkOfSongs();
              } else {
                emitter.emit('finish');
              }
            });
          });
        })
      });
    }
    deleteChunkOfSongs();
    return emitter;
  }

  this.addSongs = function (songsToAdd) {
    var emitter = new events.EventEmitter();

    self.getAllSongs()
    .on('finish', function (err, allSongs) {
      if (err) throw err; //emitter.emit('finish', err);

      // remove songs without echonestId
      var count=0;
      var total = songsToAdd.length;
      for(var i=songsToAdd.length-1;i>=0;i--) {
        if (!songsToAdd[i].echonestId) {
          songsToAdd.splice(i,1);
          count++;
        }
      }
      
      // check for duplicates
      var duplicateSongs = allSongs.filter(function (song) {
        var included = false;
        for (var i=0; i<songsToAdd.length; i++) {
          if (song.echonestId === songsToAdd[i].echonestId) {
            return true;
          }
        }
        return false;
      });

      // remove the duplicates from songsToAdd
      for (var i=duplicateSongs.length-1;i>=0;i--) {
        for(var j=songsToAdd.length-1;j>=0;j--) {
          if (duplicateSongs[i]["song_id"] === songsToAdd.echonestId) {
            songsToAdd.splice(j,1);
          }
        }
      }

      // add the songs
      var addSongsJson = _.map(songsToAdd, function (song) {
        return '{ "item": {' +
                    '"item_id": "' + song.key + '", ' +
                    '"song_id" : "' + song.echonestId + '", ' +
                    '"item_keyvalues" : { ' + 
                      '"pl_artist" :"' + Helper.cleanTitleString(song.artist) + '", ' + 
                      '"pl_key" : "' + song.key + '", ' + 
                      '"pl_title" : "' + Helper.cleanTitleString(song.title) + '", ' + 
                      '"pl_album" : "' + Helper.cleanTitleString(song.album || '') + '", ' + 
                      '"pl_duration" : "' + song.duration + '" ' +
                    '}' +
                  '}' +
                '}'
        
      });

      // create a string json array
      var data = "[" + addSongsJson.join(", ") + "]";

      // make the call
      echo('tasteprofile/update').post({ id: config.ECHONEST_TASTE_PROFILE_ID, data: data }, function (err, json) {
        if (err) { 
console.log(err);
          emitter.emit('finish', err); 
          return;
        }
        waitForCompletedTicket(json.response["ticket"], function() {  
          emitter.emit('finish', null);
        });
      });
    });
    
    return emitter;
  }

  this.deleteSong = function (itemId, callback) {
    // build string
    var emitter = new events.EventEmitter();

    var data = '[{ "action": "delete", "item": {' + 
                                  '"item_id": "' + itemId + '"' + 
                                  '}' +
               '}]'

    echo('tasteprofile/update').post({ id: config.ECHONEST_TASTE_PROFILE_ID, data: data }, function (err, json) {

      emitter.emit('finish', err, json);
     });
     return emitter;
  }

  this.getSongSuggestions = function (artists, callback) {
    
    // give echonest a blank if no artists provided
    if (!artists.length) {
      artists = ['Rachel Loy'];
    }

    var suggestedSongs = [];

    var getSuggestionFunctions = [];

    // get suggestsions from echonest
    function makeEchonestRequest() {
      echo('playlist/static').get({ artist: artists, type: 'artist-radio', results: 100, limit: true,
                                  bucket: 'id:' + config.ECHONEST_TASTE_PROFILE_ID } ,function (err, json) {
console.log(json.response["songs"]);
        if (err) { 
          console.log(err);
          setTimeout(makeEchonestRequest, 1000);
          return;
        }

        var songsJson = json.response["songs"];
        var songEchonestIds = _.map(songsJson, function (song) {return song["id"] });
        var songs = [];
        var finalList = [];
        var count = 0;

        // pre-grab songs from artists
        var grabSongFunctions = [];
        for (var i=0;i<artists.length;i++) {
          grabSongFunctions.push((function () {
            var deferred = Q.defer();
            Song.findAllMatchingArtist(artists[i], function (err, artistSongs) {
              if (err) {
                deferred.reject(new Error(err));
              } else {
                deferred.resolve(artistSongs);
              }
            });
            return deferred.promise;
          })(i));
        }

        Q.all(grabSongFunctions)
        .done(function (results) {
          // add the songs
          for(var i=0;i<results.length;i++) {
            // add up to 4 songs from each artist
            for(var j=0;((j<=5) && (j<results[i].length));j++) {
              finalList.push(results[i][j]);

              // remove duplicate if it exists
              var index = songEchonestIds.indexOf(results[i][j].echonestId);
              if (index > -1) {
                songEchonestIds.splice(index,1);
              }
            }  
          }
          // build a query object
          var query = _.map(songEchonestIds, function (echonestId) {
            return { echonestId: echonestId }
          });

          // grab all the suggested songs from their echonestIds
          Song.find({ $or: query }, function (err, suggestedSongs) {

            if (!err) {
              finalList = finalList.concat(suggestedSongs);
            }
console.log('suggested songs: ' + finalList.length);
            // if there's enough, exit
            if (finalList.length > 150) {
              callback(null, finalList);
            } else {
              // for now, fill with random songs
              Song.findRandom({ _type: 'Song' }, {}, { limit: 150 }, function (err, randomSongs) {
                if (err) throw err;
                var i=0;

                while ((finalList.length < 150) && (i < randomSongs.length)) {
                  var alreadyIncluded = false;
                  for (j=0; j<finalList.length; j++) {
                    if (finalList.length && (finalList[j].echonestId === randomSongs[i].echonestId)) {
                      alreadyIncluded = true;
                      break;
                    }
                  }
                  if (!alreadyIncluded) {
                    finalList.push(randomSongs[i]);
                  }
                  
                  i++;
                }
                // callback with list
                callback(null, finalList);
              });
            }
          });
        });
      });
    }
    makeEchonestRequest();
  };


  function waitForCompletedTicket(ticket, callback) {
    if (!ticket) {
      callback();
      return;
    }
    echo('tasteprofile/status').get({ ticket: ticket }, function (err, json) {
      if (json.response["ticket_status"] !== 'complete') {
        setTimeout(function () {
          waitForCompletedTicket(ticket, callback);
        }, 1500);
      } else {
console.log(json.response);
        callback();
      }
    });
  }
}

module.exports = new Handler();