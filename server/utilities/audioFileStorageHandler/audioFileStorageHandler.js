console.log(process.env)


var config = require('../../config/environment/');
var s3HighLevel = require('s3').createClient(config.s3Options);
var AWS = require('aws-sdk');
AWS.config.region = 'us-west-2';
var s3 = new AWS.S3();
var _ = require('lodash');
var unidecode = require('unidecode');
var Station = require('../../api/station/station.model');

function Handler() {
  var self = this;

  // makes sure filenames are legal
  this.cleanFilename = function (filename) {
    var cleanedFilename = unidecode(filename)
                            .replace(/[^a-zA-Z0-9\-\.]/g, '')
                            .replace(/_/g, '-')
                            .replace(/ /g, '-');
    return cleanedFilename;
  }

  // clears the entire bucket
  this.clearBucket = function (bucket, callback) {
    var listGetter = s3HighLevel.listObjects({ s3Params: { Bucket: bucket } });

    var objects = [];
    listGetter.on('data', function (newData) {
      objects.concat(newData.Contents);
    });

    listGetter.on('end', function () {
      
      // IF the bucket is not already empty
      var objectKeys = [];
      if (objects.length > 0) {

        for(var i=0;i<objects.length;i++) {
          objectKeys.push({ Key: objects[i].Key });
        }
        var deleter = s3HighLevel.deleteObjects({ Bucket: bucket, Delete: { Objects: objectKeys } });
        deleter.on('end', function () {
          callback();
        })
      } else {
        callback ();
      }
    });
  }

  this.getStoredSongMetadata = function (key, callback) {
    var params = {
      Bucket: config["s3Buckets"].SONGS_BUCKET,
      Key: key
    };

    s3.headObject(params, function (err, data) {
      if (err) {
        callback(err, null);
      } else {
        var metadata = {
          title:      data.Metadata.pl_title,
          artist:     data.Metadata.pl_artist,
          album:      data.Metadata.pl_album,
          duration:   parseInt(data.Metadata.pl_duration, 10),
          echonestId: data.Metadata.pl_echonest_id
        }
        callback (null, metadata);
      }
    });
  }

  this.storeSong = function (attrs, callback) {
    // build key
    var listGetter = s3HighLevel.listObjects({ s3Params: { Bucket: config["s3Buckets"].SONGS_BUCKET } });
    
    var objects = [];
    
    // add objects to the array as they come in
    listGetter.on('data', function (newData) {
      objects.concat(newData.Contents);
    });

    // after all objects have been gotten
    listGetter.on('end', function () {
      var nextKeyValue;
      
      if (!objects.length) {
        nextKeyValue = 0;
      } else {
        var objectKeyNumbers = _.map(objects, function (obj) { return parseInt(obj["Key"].substr(4,10)) });

        // grab the next available key value from the keys strings
        nextKeyValue = Math.max.apply(Math, objectKeyNumbers);
      }

      nextKeyValue++;

      var key = '-pl-' + 
                ('0' * (7 - nextKeyValue.toString())) + 
                nextKeyValue + '-' +
                attrs.artist + '-' + 
                attrs.title  +
                '.mp3';

      key = self.cleanFilename(key);
      var metadata = {
                        pl_artist: (attrs.artist || ''),
                        pl_title: (attrs.title || ''),
                        pl_duration: (attrs.duration.toString() || ''),
                        pl_album: (attrs.album || ''),
                        pl_echonest_id: (attrs.echonestId || '')
                      };

      var uploader = s3HighLevel.uploadFile({ localFile: attrs.filepath,
                                              s3Params: { 
                                                Bucket: config["s3Buckets"].UNPROCESSED_SONGS_BUCKET,
                                                Key: key,
                                                ContentType: 'audio/mpeg',
                                                Metadata: metadata
                                              }
                                            });
      uploader.on('end', function (data) {
        callback(null, key);
      });
    });    
  };

this.storeUnprocessedSong = function (filepath, callback) {
    var key = self.cleanFilename(filepath.split('/').pop());

    var uploader = s3HighLevel.uploadFile({ localFile: filepath,
                                            s3Params: { 
                                              Bucket: config["s3Buckets"].UNPROCESSED_SONGS_BUCKET,
                                              Key: key,
                                              ContentType: 'audio/mpeg'
                                            }
                                          });
    uploader.on('end', function (data) {
      callback(null, key);
    });
  };

  this.storeCommentary = function (attrs, callback) {
    // build key
    Station.findById(attrs.stationId, function (err, station) {
      if (err) callback(err);
      if (!station) return new Error('Station Not Found');

      var nextKeyValue = station.commentaryCounter + 1;

      var key = attrs.stationId +
                '-com-' + 
                nextKeyValue + '-' +
                '.mp3';

      key = self.cleanFilename(key);

      var metadata = {
                        pl_station_id: attrs.stationId,
                        pl_duration: (attrs.duration.toString() || ''),
                      };
      var uploader = s3HighLevel.uploadFile({ localFile: attrs.filepath,
                                              s3Params: { 
                                                Bucket: config["s3Buckets"].COMMENTARIES_BUCKET,
                                                Key: key,
                                                Metadata: metadata
                                              }
                                            });
      uploader.on('end', function (data) {

        // increment key on station
        station.commentaryCounter = nextKeyValue;
        station.save(function (err) {
          if (err) callback(err);
          callback(null, key);
        });
      });
    });    
  };

  this.getUnprocessedSong = function (key, callback) {
    var filepath = process.cwd() + '/server/data/' + key
    var downloader = s3HighLevel.downloadFile({   localFile: filepath,
                                                  s3Params: { Bucket: config["s3Buckets"].UNPROCESSED_SONGS_BUCKET,
                                                               Key: key } });
    downloader.on('end', function () {
      callback(null, filepath);
    });
  }

  this.deleteUnprocessedSong = function (key, callback) {
    s3.deleteObject({ Bucket: config["s3Buckets"].UNPROCESSED_SONGS_BUCKET,
                      Key: key }, function (err, data) {
      callback(err, data);
    });
  }

  this.deleteSong = function (key, callback) {
    s3.deleteObject({ Bucket: config['s3Buckets'].SONGS_BUCKET,
                      Key: key }, function (err, data) {
      callback(err, data);
    });
  }

  this.updateMetadata = function (attrs, callback) {
    self.getStoredSongMetadata(attrs.key, function (err, oldMetadata) {

      // format duration if it's been given
      if (attrs.duration) {
        attrs.duration = attrs.duration.toString();
      }

      var metadata = {
        pl_title:      attrs.title || oldMetadata.title,
        pl_artist:     attrs.artist || oldMetadata.artist,
        pl_album:      attrs.album || oldMetadata.album,
        pl_duration:   attrs.duration || oldMetadata.duration,
        pl_echonest_id: attrs.echonestId || oldMetadata.echonestId
      }

      s3.copyObject({ Bucket: config["s3Buckets"].SONGS_BUCKET,
                      CopySource: config["s3Buckets"].SONGS_BUCKET + '/' + attrs.key,
                      Key: attrs.key,
                      MetadataDirective: 'REPLACE',
                      Metadata: metadata,
                      ContentType: 'audio/mpeg'
        }, callback
      );
    });
  };

  this.getAllSongs = function (callback) {

    var objects = [];
    var listGetter = s3HighLevel.listObjects({ s3Params: { Bucket: config["s3Buckets"].SONGS_BUCKET } });

    listGetter.on('data', function (data) {
      objects = objects.concat(data.Contents);
    });

    listGetter.on('end', function () {
      var formattedObjects = [];
      getHeadFunction(objects.length-1);

      // must be recursive because of echonest API cursor setup
      function getHeadFunction(index) {
        if (index < 0) {
          continueFunction();
          return;
        }

        var params = {
          Bucket: config["s3Buckets"].SONGS_BUCKET,
          Key: objects[index].Key
        };

        s3.headObject(params, function (err, data) {
          if (err) {
            callback(err, null);
          } else {
            formattedObjects.push({
              title:      data.Metadata.pl_title,
              artist:     data.Metadata.pl_artist,
              album:      data.Metadata.pl_album,
              duration:   parseInt(data.Metadata.pl_duration, 10),
              echonestId: data.Metadata.pl_echonest_id,
              key:        objects[index].Key 
            });
            
            if (formattedObjects.length === objects.length) {
              continueFunction();
            } else {
              process.stdout.clearLine();
              process.stdout.cursorTo(0);
              process.stdout.write(index + ' songs to go');
              getHeadFunction(index - 1);
            }
          }
        });
      }

      // 
      function continueFunction() {
        formattedObjects = _.sortBy(formattedObjects, function(song) {
          return [song.artist, song.title];
        });

        callback(null, formattedObjects);
      }
    });
  }
}

module.exports = new Handler();