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
    // get tags
    self.getTags(originalFilepath, function (err, tags) {
      // handle problems
      if (err) {
        console.log(err);
        callback(err);
        return;
      } else if (!tags.title || !tags.artist) {
        callback(new Error('No Id Info in File'));
        return;
      }

      // get closest echonest tags
      self.getEchonestInfo({ title: tags.title, artist: tags.artist }, function (err, match) {
        if (err) {
          callback(err);
          return;
        }

        // if a suitable match was not found, store the file for future use
        if ((match.titleMatchRating < 0.75) || (match.artistMatchRating < 0.75)) {
          
          // convert the song
          Converter.convertFile(originalFilepath, function (err, filepath) {
            if (err) {
              callback(err);
              return;
            }

            // store it on s3
            


          })


          var error = new Error('Song info not found');
          error.tags = tags;

          // convert the song and store it on 

          callback(err);
          return;
        }

        // if the song already exists, callback with song exists error
        Song.findAllByTitleAndArtist( { title: match.title,
                                      artist: match.artist 
                                      }, function (err, songs) {
          if (err) {
            callback(err);
            return;
          }

          if (songs.length) {
            var err = new Error('Song Already Exists');
            err.song = songs[0];
            callback(err);
            return;
          }
        
          // convert the song
          Converter.convertFile(originalFilepath, function (err, filepath) {
            if (err) {
              callback(err);
              return;
            }

            // grab itunes artwork
            self.getItunesInfo({ title: match.title, artist: match.artist }, function (err, itunesInfo) {
              if (err) {
                itunesInfo = {};
              }
              
              // store the song
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

                // add to DB
                varsong = new Song({ title: match.title,
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
                  if (err) callback(err);

                  // delete file 
                  if (fs.exists(filepath)) fs.unlink(filepath);

                  // add song to Echonest
                  SongPool.addSong(newSong)
                  .on('finish', function () {
                    callback(null, newSong);
                    return;
                  })
                  .on('error', function(err) {
                    callback(err);
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
    // convert the song
    Converter.convertFile(info.filepath, function (err, filepath) {
      if (err) {
        callback(err);
        return;
      }

      // grab itunes artwork
      self.getItunesInfo({ title: info.title, artist: info.artist }, function (err, itunesInfo) {
        if (err) {
          var itunesInfo = {};
        }
        
        // store the song
        Storage.storeSong({ title: info.title,
                            artist: info.artist,
                            album: info.album,
                            duration: info.duration,
                            echonestId: info.echonestId,
                            filepath: filepath,
                            }, function (err, key) {
          if (err) {
            callback(new Error('Audio File Storage Error'));
            return;
          }

          // add to DB
          song = new Song({ title: info.title,
                        artist: info.artist,
                        album: info.album,
                        duration: info.duration,
                        echonestId: info.echonestId,
                        key: key,
                        albumArtworkUrl: itunesInfo.albumArtworkUrl,
                        trackViewUrl: itunesInfo.trackViewUrl,
                        itunesInfo: itunesInfo })
          song.save(function (err, newSong) {
            if (err) callback(err);

            // delete file 
            if (fs.exists(filepath)) fs.unlink(filepath);

            // add song to Echonest
            SongPool.addSong(newSong)
            .on('finish', function () {
              callback(null, newSong);
              return;
            })
            .on('error', function(err) {
              console.log('echonest error');
              callback(err);
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