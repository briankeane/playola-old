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

  this.processUploadWithUpdatedTags = function (upload, callback) {
    //  get new possible matches
    self.getSongMatchPossibilities(upload.tags, function (err, matches) {
      if (err) {
        callback(err);
        return;
      }
      var closestMatch = matches.closestMatch;

      // if a match was found
      if (closestMatch && (closestMatch.matchRating >= 1.8)) {
        // get the itunes info
        self.getItunesInfo({ artist: closestMatch.artist,
                              title: closestMatch.title 
                            }, function (err, itunesInfo) {
          // finalize the upload
          Storage.finalizeUpload({ title: closestMatch.title,
                                  artist: closestMatch.artist,
                                  album: upload.tags.album || closestMatch.album || '',
                                  duration: upload.duration || itunesInfo.trackTimeMillis,
                                  key: upload.key,
                                  echonestId: closestMatch.echonestId
                                }, function (err, newKey) {

            // add the song to the db
            Song.create({ artist: closestMatch.artist,
                          title: closestMatch.title,
                          album: upload.tags.album || closestMatch.album || itunesInfo.album,
                          echonestId: closestMatch.echonestId,
                          duration: upload.duration || itunesInfo.trackTimeMillis,
                          albumArtworkUrl: itunesInfo.albumArtworkUrl,
                          albumArtworkUrlSmall: itunesInfo.albumArtworkUrlSmall,
                          trackViewUrl: itunesInfo.trackViewUrl,
                          itunesInfo: itunesInfo,
                          key: newKey
                        }, function (err, newSong) {
              // add the song to the songpool
              SongPool.addSong(newSong)
              .on('finish', function () {
                callback(null, newSong);
              });
            });
          });
        });
      }
    });
  };

  this.getItunesInfo = function (attrs, callback) {
    var url = 'https://itunes.apple.com/search?' + qs.stringify( { term: ((attrs.artist || '') + ' ' + (attrs.title || '')) });

    request(url, function (error, response, body) {

      // wait 1/2 sec and try again if iTunes is unhappy with us
      if (response.statusCode === 403) {
        console.log(response.statusCode);
        setTimeout(self.getItunesInfo(attrs, callback), 500);
        return;
      }

      var match;
      var responseObj = JSON.parse(body);

      // if there was no match found, return an error
      if (responseObj.resultCount === 0) {
        var err = new Error('iTunes match not found');
        callback(err);
        return;
      }

      // otherwise get the closest match
      var bestMatchIndex = 0;
      for (i=0;i<responseObj.results.length;i++) {
        responseObj.results[i].titleMatchRating = natural.JaroWinklerDistance(attrs.title.toLowerCase(), responseObj.results[i].trackName.toLowerCase());
        responseObj.results[i].artistMatchRating = natural.JaroWinklerDistance(attrs.artist.toLowerCase(), responseObj.results[i].artistName.toLowerCase());
        responseObj.results[i].matchRating = responseObj.results[i].titleMatchRating + responseObj.results[i].artistMatchRating;
        
        // if this is a better match, mark it down
        if (responseObj.results[i].matchRating > responseObj.results[bestMatchIndex].matchRating) {
          bestMatchIndex = i;
        }
      }
      match = responseObj.results[bestMatchIndex];

      // add the 600x600 albumArtwork
      if (match.artworkUrl100) {
        match.albumArtworkUrl = match.artworkUrl100.replace('100x100-75.jpg', '600x600-75.jpg');
      }

      // rename album for consistency
      match.album = match.collectionName;

      callback(null, match);
      return;
    });
  };

  this.addSongViaEchonestId = function (info, callback) {
    // check to see if new song is in database
    Song.find( { echonestId: info.echonestId, 
               }, function (err, songs) {
      if (err) {
        callback(err);
        return;
      }

      // if the song already exists, callback with song exists error
      if (songs.length) {
        var err = new Error('Song Already Exists');
        err.song = songs[0];
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
                              album: info.album || itunesInfo.collectionName,
                              duration: info.duration,
                              echonestId: info.echonestId,
                              key: info.key,
                            }, function (err, newKey) {
          if (err) {
            console.log(err);
            callback(new Error('Audio File Storage Error'));
            return;
          }

          // add to DB
          song = new Song({ title: info.title,
                            artist: info.artist,
                            album: info.album || itunesInfo.collectionName,
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

  this.getSongMatchPossibilities = function (attrs, callback) {
    // create search string
    var searchString = (attrs.artist || '') + ' ' + (attrs.title || '');

    // grab matches
    echo('song/search').get({ combined: searchString,
                              bucket: ['id:rdio-US', 'tracks'],
                            }, function (err, json) {

      if (err) callback(err);
      var matches = json.response.songs;
      
      // return null if no songs found
      if (!matches.length) return null;

      var closestMatchIndex = 0;
      var closestMatchRating = 0;

      // calculate the artist & title match accuracy
      for (var i=0;i<matches.length;i++) {
        matches[i].artistMatchRating = natural.JaroWinklerDistance(matches[i].artist_name.toLowerCase(), attrs.artist.toLowerCase());
        matches[i].titleMatchRating = natural.JaroWinklerDistance(matches[i].title.toLowerCase(), attrs.title.toLowerCase());
        matches[i].matchRating = matches[i].artistMatchRating + matches[i].titleMatchRating;
      
        // rename for consistency
        matches[i].echonestId = matches[i].id;
        matches[i].artist = matches[i].artist_name;

        // grab album name if available
        for (var j=0;j<matches[i].tracks.length;j++) {
          if (matches[i].tracks[j].album_name) {
            matches[i].album = matches[i].tracks[j].album_name
            break;
          }
        }
      }

      // SORT the matches... here's the 'compare' function
      function compareMatches(a,b) {
        if (a.matchRating < b.matchRating)
          return 1;
        if (a.matchRating > b.matchRating)
          return -1;
        return 0;
      }

      // and... the sort
      matches = matches.sort(compareMatches);
      
      var closestMatch = matches[0];
      closestMatch.genres = [];

      // add genere tags to closest match
      echo('artist/profile').get({ name: closestMatch.artist, bucket: 'genre' }, function (err, artistProfile) {
        if (err) {
          callback(null, { closestMatch: closestMatch, possibleMatches: matches });
        } else {
          // add the genres
          var genres = artistProfile.response.artist.genres;

          for (var i=0;i<genres.length;i++) {
            closestMatch.genres.push(genres[i].name);
          }
        
          callback(null, { closestMatch: closestMatch, possibleMatches: matches });
        }
      });
    });
  };

  this.addSongToSystem = function (originalFilepath, callback) {
    // ******** THIS FUNCTION IS NOW HANDLED BY THE RAILS APP ****************


//     // convert file
//     Converter.convertFile(originalFilepath, function (err, filepath) {
//       // if it's unconvertable.. no use left for file. just return
//       if (err) {
//         callback(err);
//         return;
//       }
// console.log('conversion done at ' + (Date.now() - startTime) + 'ms')
//       // otherwise grab the tags
//       self.getTags(filepath, function (err, tags) {
//         // if it's unreadable, delete it and fuggettaboutit
//         if (err) {
//           callback(err);
//           return;
//         } 
// console.log('tags done in ' + (Date.now() - startTime) + 'ms')
//         // if there's not enough info, store the file for future use
//         if (!tags.title || !tags.artist) {
//           Storage.storeUnprocessedSong(filepath, function (err, key) {
//             if (err) { 
//               callback (err); 
//               return;
//             } else {
//               var error = new Error('No Id Info in File');
//               error.key = key;
//               error.filepath = filepath;
//               callback(error);
//               return;
//             }
//           });
//           //return;
//         }
//         // get closest echonest tags
//         self.getEchonestInfo({ title: tags.title, artist: tags.artist }, function (err, match) {
//           if (err || !match) {
//             callback(err);
//             return;
//           }

// console.log('echonest info done in ' + (Date.now() - startTime) + 'ms')
//           // if a suitable match was not found...
//           if ((match.titleMatchRating < 0.75) || (match.artistMatchRating < 0.75)) {
            
//             // store it on s3
//             Storage.storeUnprocessedSong(filepath, function (err, key) {
//               var error = new Error('Song info not found');
//               error.tags = tags;
//               error.key = key;
//               error.filepath = filepath;
//               callback(error);
//               return;
//             });
//           }
//           Song.findAllByTitleAndArtist( { title: match.title,
//                                         artist: match.artist 
//                                         }, function (err, songs) {
//             if (err) {
//               callback(err);
//               return;
//             }
// console.log('database check done in ' + (Date.now() - startTime) + 'ms')
//             // if the song already exists, callback with song exists error
//             if (songs.length) {
//               var err = new Error('Song Already Exists');
//               err.song = songs[0];
//               err.filepath = filepath;
//               callback(err);
//               return;
//             }

//             // if it made it here... we're good!
            
//             // grab the itunes artwork
//             self.getItunesInfo({ title: match.title, artist: match.artist }, function (err, itunesInfo) {
//               if (err) {
//                 itunesInfo = {};
//               }
// console.log('itunes done in ' + (Date.now() - startTime) + 'ms')
//               // store the song on S3
//               Storage.storeSong({ title: match.title,
//                                   artist: match.artist,
//                                   album: match.album,
//                                   duration: tags.duration,
//                                   echonestId: match.echonestId,
//                                   filepath: filepath,
//                                   }, function (err, key) {
//                 if (err) {
//                   callback(new Error('Audio File Storage Error'));
//                   return;
//                 }
// console.log('song store done in ' + (Date.now() - startTime) + 'ms')
//                 // add to DB
//                 var song = new Song({ title: match.title,
//                                      artist: match.artist,
//                                      album: match.album,
//                                      duration: tags.duration,
//                                      echonestId: match.echonestId,
//                                      key: key,
//                                      albumArtworkUrl: itunesInfo.albumArtworkUrl,
//                                      albumArtworkUrlSmall: itunesInfo.artworkUrl100,
//                                      trackViewUrl: itunesInfo.trackViewUrl,
//                                      itunesInfo: itunesInfo })
                
//                 song.save(function (err, newSong) {
//                   if (err) {
//                     callback(err);
//                     return;
//                   }
// console.log('song save done in ' + (Date.now() - startTime) + 'ms')
//                   // delete the file 
//                   if (fs.exists(filepath)) fs.unlink(filepath, function () {});

//                   // add song to Echonest
//                   SongPool.addSong(newSong)
//                   .on('finish', function () {
// console.log('conversion finish in ' + (Date.now() - startTime) + 'ms')
//                     callback(null, newSong);
//                     return;
//                   })
//                   .on('error', function(err) {
// console.log('songpool error done in ' + (Date.now() - startTime) + 'ms')
//                     var error = new Error('Song Added to System but not to Song Pool');
//                     callback(err, newSong);
//                     return;
//                   });
//                 });
//               });
//             });
//           });
//         });
//       });
//     });
  };
}

module.exports = new SongProcessor();