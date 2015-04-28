var config = require('../server/config/environment');
var User = require('../server/api/user/user.model');
var Song = require('../server/api/song/song.model');
var Storage = require('../server/utilities/audioFileStorageHandler/audioFileStorageHandler');
var SongPool = require('../server/utilities/songPoolHandlerEmitter/songPoolHandlerEmitter');
var Helper = require('../server/utilities/helpers/helper');
var _ = require('lodash');
var mongoose = require('mongoose');
var SongProcessor = require('../server/utilities/songProcessor/songProcessor');
var CommercialBlock = require('../server/api/commercialBlock/commercialBlock.model');

module.exports = function(grunt) {
  grunt.registerTask('loadDatabase', function() {
    var done = this.async();
    var messedUpSongs = [];

    // Connect to database
    mongoose.connect(config.mongo.uri, config.mongo.options);
    
    Song.remove({}, function (err) {

      console.log('getting stored songs...');
      Storage.getAllSongs(function (err, songObjects) {
        if (err) { console.log(err); }
        
        if (!songObjects.length) {
          console.log('no songs found in storage');
          done();
          return;
        }
        for(var i=songObjects.length-1;i>=0;i--) {
          if (isNaN(songObjects[i].duration) || 
            (!songObjects[i].title || (songObjects[i].title == 'undefined') || !songObjects[i].title.trim().length) ||
              (!songObjects[i].artist || (songObjects[i].artist == 'undefined')|| !songObjects[i].artist.trim().length)) {
            messedUpSongs.push(songObjects.splice(i,1));
          }
        }

        // itunes api acting up -- uncomment later
        // add the itunes info
        // for (var i=0;i<songObjects.length;i++) {
        //   var completed = 0;

        //   (function(index) {

        //     SongProcessor.getItunesInfo(songObjects[index], function (err, info) {
        //       if (err) {
        //         console.log(err);
        //         console.log(songObjects[index]);
        //         console.log('index: ' + index);
        //       } else {
        //         songObjects[index].itunesInfo = info;
        //         songObjects[index].albumArtworkUrl = info.albumArtworkUrl;
        //         songObjects[index].albumArtworkUrlSmall = info.artworkUrl100;
        //       }
        //       completed++;
        //       console.log('completed: ' + index;);

        //       // when all have been saved, continue
        //       if (completed == songObjects.length) {
        //         continueFunction();
        //       }
        //     });
        //   })(i);
        // }

        continueFunction();

        function continueFunction() {
          console.log('' + songObjects.length + ' songs found');
          var songs = _.map(songObjects, function (attrs) { 
            var newSong = new Song(attrs);
            newSong.save();
            return newSong;
          });
          console.log(songs[0]);

          console.log("stored songs: " + songs.length);
          console.log('song1: ');
          console.log(songs[0]);
          console.log('songObject1: ');
          console.log(songObjects[0]);
          done();
        }
      });
    });
  });

  grunt.registerTask('updateItunesInfo', function () {
    console.log('running here')

    var done = this.async();
    // Connect to database
    mongoose.connect(config.mongo.uri, config.mongo.options);

    console.log('still running');


    Song.all(function (err, songObjects) {
      // add the itunes info
      console.log(err);
      console.log(songObjects.length);
      for (var i=0;i<songObjects.length;i++) {
        var completed = 0;
        
        if (!songObjects[i].albumArtworkUrl) {

          (function(index) {

              
            SongProcessor.getItunesInfo(songObjects[index], function (err, info) {
              if (err) {
                console.log(err);
                console.log(songObjects[index]);
                console.log('index: ' + index);
              } else {
                songObjects[index].itunesInfo = info;
                songObjects[index].albumArtworkUrl = info.albumArtworkUrl;
                songObjects[index].albumArtworkUrlSmall = info.artworkUrl100;
                songObjects[index].save();
                console.log(songObjects[index].title + ' saved');;
              }
              completed++;

              // when all have been saved, continue
              if (completed == songObjects.length) {
                console.log('done');
                done();
              }
            });
          })(i);
        } else {
          // no need to get info, so just increment completed
          completed++;
        }
      } 

    });
  });
  
  grunt.registerTask('loadEchonestFromDB', function() {
    var done = this.async();
    
    // Connect to database
    mongoose.connect(config.mongo.uri, config.mongo.options);

    Song.all(function (err, songs) {
      console.log(songs.length);
      console.log(songs[827])
      var songArrays = [];
      
      // break it up into chunks of 300
      while(songs.length) {
        songArrays.push(songs.splice(0,300));
      }

      console.log('songArrayCount: ' + songArrays.length);

      SongPool.clearAllSongs()
      .on('finish', function (err) {
        if (err) { console.log(err); }

        var totalChunks = songArrays.length;
        var totalChunksReturned = 0;

        function addChunk() {
          SongPool.addSongs(songArrays[totalChunksReturned])
          .on('finish', function (err) {
            if (err) { 
              console.log(err);
              done();
            }
            totalChunksReturned++;
            console.log('chunk ' + totalChunksReturned + ' returned');
            SongPool.getAllSongs()
            .on('finish', function(err, allSongs) {
              console.log('count: ' + allSongs.length);
              if (err) { console.log(err); }
              if (totalChunksReturned == totalChunks) {
                done();
              } else {
                addChunk();
              }
            });
          });
        }
        addChunk();
      });
    });
  });
}