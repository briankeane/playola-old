var Song = require('../../api/song/song.model');
var taglib = require('taglib');
var https = require('https');
var qs = require('querystring');
var config = require('../../config/environment');
var echojs = require('echojs');
var natural = require('natural');
var Converter = require('../audioConverter/audioConverter');
var Storage = require('../audioFileStorageHandler/audioFileStorageHandler');
var SongPool = require('../songPoolHandlerEmitter/songPoolHandlerEmitter');
var fs = require('fs');
var request = require('request');

function SongProcessor() {
  var self = this;
  var echo = echojs({ key: config.ECHONEST_KEY });

  this.getTags = function (filepath, callback) {
    taglib.read(filepath, function (err, tag, audioProperties) {
      if (err) callback(err);
      
      // combine objects
      tag.duration = audioProperties.length * 1000;
      tag.bitrate = audioProperties.bitrate;
      tag.sampleRate = audioProperties.sampleRate;
      tag.channels = audioProperties.channels;

      callback(null, tag);

    });
  };

  this.writeTags = function (attrs, callback) {
    taglib.tag(attrs.filepath, function (err, tag) {
      if (err) callback(err);

      // prevent overwriting with a blank string ''
      if (!attrs.artist) delete attrs.artist;
      if (!attrs.title) delete attrs.title;
      if (!attrs.album) delete attrs.album;

      tag.artist = attrs.artist || tag.artist;
      tag.title = attrs.title || tag.title;
      tag.album = attrs.album || tag.album;
      tag.saveSync();                       // INSERTED TO DEAL WITH TAGLIB KNOWN BUG. WORKAROUND OR FIX NEEDED
      tag.save(function (err) {
        if (err) callback(err);
        callback(null, tag);
      });
    });
  };

  this.getItunesInfo = function (attrs, callback) {
    var url = 'https://itunes.apple.com/search?' + qs.stringify( { term: ((attrs.artist || '') + ' ' + (attrs.title || '')) });

    request(url, function (error, response, body) {
      console.log('error: ' + error);
      console.log('response: ' + response);

      if (response.statusCode === 403) {
        console.log(response.statusCode);
        setTimeout(self.getItunesInfo(attrs, callback), 500);
        return;
      }

      var match;
      var responseObj = JSON.parse(body);
      if (responseObj.resultCount === 0) {
        var err = new Error('iTunes match not found');
        callback(err);
        return;
      } else {
        match = responseObj.results[0];
      }

      // add the 600x600 albumArtwork
      if (match.artworkUrl100) {
        match.albumArtworkUrl = match.artworkUrl100.replace('100x100-75.jpg', '600x600-75.jpg');
      }
      callback(null, match);
      return;
    })
  };


  this.getSongMatchPossibilities = function (attrs, callback) {
    echo('song/search').get({ combined: attrs.artist + ' ' + attrs.title 
                            }, function (err, json) {
      var songsArray = json.response.songs;

      for(var i=0;i<songsArray.length;i++) {
        songsArray[i].artist = songsArray[i].artist_name;
        songsArray[i].echonestId = songsArray[i].id;
      }

      callback(null, songsArray);
    });
  };

  this.addSongToSystem = function (originalFilepath, callback) {
var startTime = Date.now();
    // convert file
    Converter.convertFile(originalFilepath, function (err, filepath) {
      // if it's unconvertable.. no use left for file. just return
      if (err) {
        callback(err);
        return;
      }
console.log('conversion done at ' + (Date.now() - startTime) + 'ms')
      // otherwise grab the tags
      self.getTags(filepath, function (err, tags) {
        // if it's unreadable, delete it and fuggettaboutit
        if (err) {
          callback(err);
          return;
        } 
console.log('tags done in ' + (Date.now() - startTime) + 'ms')
        // if there's not enough info, store the file for future use
        if (!tags.title || !tags.artist) {
          Storage.storeUnprocessedSong(filepath, function (err, key) {
            if (err) { 
              callback (err); 
              return;
            } else {
              var error = new Error('No Id Info in File');
              error.key = key;
              error.filepath = filepath;
              callback(error);
              return;
            }
          });
          //return;
        }
        // get closest echonest tags
        self.getEchonestInfo({ title: tags.title, artist: tags.artist }, function (err, match) {
          if (err || !match) {
            callback(err);
            return;
          }

console.log('echonest info done in ' + (Date.now() - startTime) + 'ms')
          // if a suitable match was not found...
          if ((match.titleMatchRating < 0.75) || (match.artistMatchRating < 0.75)) {
            
            // store it on s3
            Storage.storeUnprocessedSong(filepath, function (err, key) {
              var error = new Error('Song info not found');
              error.tags = tags;
              error.key = key;
              error.filepath = filepath;
              callback(error);
              return;
            });
          }
          Song.findAllByTitleAndArtist( { title: match.title,
                                        artist: match.artist 
                                        }, function (err, songs) {
            if (err) {
              callback(err);
              return;
            }
console.log('database check done in ' + (Date.now() - startTime) + 'ms')
            // if the song already exists, callback with song exists error
            if (songs.length) {
              var err = new Error('Song Already Exists');
              err.song = songs[0];
              err.filepath = filepath;
              callback(err);
              return;
            }

            // if it made it here... we're good!
            
            // grab the itunes artwork
            self.getItunesInfo({ title: match.title, artist: match.artist }, function (err, itunesInfo) {
              if (err) {
                itunesInfo = {};
              }
console.log('itunes done in ' + (Date.now() - startTime) + 'ms')
              // store the song on S3
              Storage.storeSong({ title: match.title,
                                  artist: match.artist,
                                  album: match.album,
                                  duration: tags.duration,
                                  echonestId: match.echonestId,
                                  filepath: filepath,
                                  }, function (err, key) {
                if (err) {
                  callback(new Error('Audio File Storage Error'));
                  return;
                }
console.log('song store done in ' + (Date.now() - startTime) + 'ms')
                // add to DB
                var song = new Song({ title: match.title,
                                     artist: match.artist,
                                     album: match.album,
                                     duration: tags.duration,
                                     echonestId: match.echonestId,
                                     key: key,
                                     albumArtworkUrl: itunesInfo.albumArtworkUrl,
                                     albumArtworkUrlSmall: itunesInfo.artworkUrl100,
                                     trackViewUrl: itunesInfo.trackViewUrl,
                                     itunesInfo: itunesInfo })
                
                song.save(function (err, newSong) {
                  if (err) {
                    callback(err);
                    return;
                  }
console.log('song save done in ' + (Date.now() - startTime) + 'ms')
                  // delete the file 
                  if (fs.exists(filepath)) fs.unlink(filepath, function () {});

                  // add song to Echonest
                  SongPool.addSong(newSong)
                  .on('finish', function () {
console.log('conversion finish in ' + (Date.now() - startTime) + 'ms')
                    callback(null, newSong);
                    return;
                  })
                  .on('error', function(err) {
console.log('songpool error done in ' + (Date.now() - startTime) + 'ms')
                    var error = new Error('Song Added to System but not to Song Pool');
                    callback(err, newSong);
                    return;
                  });
                });
              });
            });
          });
        });
      });
    });
  };

  this.addSongViaEchonestId = function (info, callback) {
    // check to see if new song is in database
    Song.findAllByTitleAndArtist( { title: info.title,
                                        artist: info.artist 
                                        }, function (err, songs) {
      if (err) {
        callback(err);
        return;
      }

      // if the song already exists, callback with song exists error
      if (songs.length) {
        var err = new Error('Song Already Exists');
        err.song = songs[0];
        err.filepath = filepath;
        callback(err);
        return;
      }

      // grab itunes artwork
      self.getItunesInfo({ title: info.title, artist: info.artist }, function (err, itunesInfo) {
        if (err) {
          var itunesInfo = {};
        }
        
        // store the song
        Storage.finalizeUpload({ title: info.title,
                              artist: info.artist,
                              album: info.album,
                              duration: info.duration,
                              echonestId: info.echonestId,
                              key: info.filename,
                            }, function (err, newKey) {
          if (err) {
            console.log(err);
            console.log(info.filename);
            callback(new Error('Audio File Storage Error'));
            return;
          }

          // add to DB
          song = new Song({ title: info.title,
                            artist: info.artist,
                            album: info.album,
                            duration: info.duration,
                            echonestId: info.echonestId,
                            key: newKey,
                            albumArtworkUrl: itunesInfo.albumArtworkUrl,
                            trackViewUrl: itunesInfo.trackViewUrl,
                            itunesInfo: itunesInfo })
          song.save(function (err, newSong) {
            if (err) callback(err);

            // add song to Echonest
            SongPool.addSong(newSong)
            .on('finish', function () {
              callback(null, newSong);
              return;
            })
            .on('error', function(err) {
              console.log('echonest error');
              callback(err, newSong);
              return;
            });
          });
        });
      });
    });
  }

  this.getEchonestInfo = function (attrs, callback) {
    echo('song/search').get({ combined: attrs.artist + ' ' + attrs.title
                            }, function (err, json) {
      if (err) callback(err);
      var matches = json.response.songs;
      
      // return null if no songs found
      if (!matches.length) return null;

      var closestMatchIndex = 0;
      var closestMatchRating = 0;

      // find the closest match
      for (var i=0;i<matches.length;i++) {
        matches[i].artistMatchRating = natural.JaroWinklerDistance(matches[i].artist_name.toLowerCase(), attrs.artist.toLowerCase());
        matches[i].titleMatchRating = natural.JaroWinklerDistance(matches[i].title.toLowerCase(), attrs.title.toLowerCase());

        if ((matches[i].artistMatchRating + matches[i].titleMatchRating) > closestMatchRating) {
          closestMatchIndex = i;
          closestMatchRating = matches[i].artistMatchRating + matches[i].titleMatchRating;
        } 
      }

      var closestMatch = matches[closestMatchIndex];

      // rename for consistency
      closestMatch.echonestId = closestMatch.id;
      closestMatch.artist = closestMatch.artist_name;
      closestMatch.genres = [];

      // add genere tags
      echo('artist/profile').get({ name: closestMatch.artist, bucket: 'genre' }, function (err, artistProfile) {
        if (err) {
          callback(null, closestMatch);
        } else {
          // add the genres
          var genres = artistProfile.response.artist.genres;

          for (var i=0;i<genres.length;i++) {
            closestMatch.genres.push(genres[i].name);
          }
        
          callback(null, closestMatch);
        }
      });
    });
  };
}

module.exports = new SongProcessor();