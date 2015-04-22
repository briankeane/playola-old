 'use strict';

var _ = require('lodash');
var Upload = require('./upload.model');
var SongProcessor = require('../../utilities/songProcessor/songProcessor');
var Song = require('../song/song.model');
var fs = require('fs');

// Get list of things
exports.index = function(req, res) {
  Upload.find(function (err, things) {
    if(err) { return handleError(res, err); }
    return res.json(200, things);
  });
};

exports.show = function(req, res) {
  Upload.findById(req.params.id, function (err, thing) {
    if(err) { return handleError(res, err); }
    if(!thing) { return res.send(404); }
    return res.json(thing);
  });
};

exports.create = function(req, res) {
  var originalFilepath = process.cwd() + '/server/data/unprocessedAudio/' + req.files.file.name;
  SongProcessor.addSongToSystem(originalFilepath, function (err, newSong) {
    if (err) {
      if (err.message === 'File is Copy-Protected') {
        // delete the song
        fs.unlink(originalFilepath, function () {} );
        return res.json(200, { status: 'File is Copy-Protected' });

      } else if (err.message === 'No Id Info in File') {
        // delete the song
        fs.unlink(originalFilepath, function () {});

        // create an upload for this
        var upload = Upload.create( { key: err.key, 
                                      status: 'No Id Info in File' 
                                    }, function (err, savedUpload) {
          return res.json(200, savedUpload);
        });

      } else if (err.message === 'Song info not found') {
        // delete the file since it's been processed
        console.log(err.filepath);
        fs.unlink(err.filepath, function () {} );

        // get possible matches for response
        SongProcessor.getSongMatchPossibilities({ artist: err.tags.artist,
                                                  title: err.tags.title,
                                                  key: err.key 
                                                }, function (matchErr, matches) {
          Upload.create({ tags: err.tags,
                          possibleMatches: matches,
                          filename: req.files.file.name,
                          status: 'info needed'
                        }, function (err, savedUpload) {
            return res.json(200, savedUpload);
          });
        });
      } else if (err.message === 'Song Already Exists') {
        fs.unlink(err.filepath, function () {} );
        return res.json(200, { status: 'Song Already Exists',
                               song: err.song });
      }
    } else {
      return res.json(200, { status: 'added',
                              song: newSong });
    }
  })
}

exports.resubmitWithEchonestId = function(req, res) {
  Upload.findById(req.params.id, function (err, upload) {
    if (!upload) return res.send(404);

    SongProcessor.addSongViaEchonestId({ title: req.query.title,
                                         artist: req.query.artist,
                                         album: req.query.album,
                                         duration: upload.tags.duration,
                                         echonestId: req.query.echonestId,
                                         filename: upload.filename
                                         }, function (err, newSong) {
      if (err) {
        if (err.message === 'Song Already Exists') {
          upload.remove();
          return res.json(200, { status: 'Song Already Exists',
                               song: err.song });
        }
        res.json(500, err);
      } else {
        upload.remove();
        res.json(newSong);
      }

    });
  });
}

exports.resubmitWithUpdatedTags = function (req, res) {
  Upload.findById(req.params.id, function (err, upload) { 
    if (!upload) return res.send(404);

    var tags = JSON.parse(req.query.tags);

    SongProcessor.writeTags({ filepath: process.cwd() + '/server/data/unprocessedAudio/' + upload.filename,
                              artist: tags.artist,
                              title: tags.title,
                              album: tags.album 
                            }, function (err, newTags) {
      SongProcessor.addSongToSystem(process.cwd() + '/server/data/unprocessedAudio/' + upload.filename, function (err, newSong) {
        if (err) {
          if (err.message === 'Song info not found') {
            // get possible matches for response
            SongProcessor.getSongMatchPossibilities({ artist: err.tags.artist,
                                                      title: err.tags.title 
                                                    }, function (matchErr, matches) {
              upload.tags =  err.tags;
              upload.possibleMatches = matches;
              upload.save(function (err, savedUpload) {
                return res.send(200, savedUpload);
              });
            });

          } else if (err.message === 'Song Already Exists') {
            return res.json(200, { status: 'Song Already Exists',
                                   song: err.song });
          }

        // song has been added
        } else {
          return res.send(200, { status: 'added',
                                  song: newSong });
        }
      });
    });
  });
};

// Updates an existing thing in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Upload.findById(req.params.id, function (err, thing) {
    if (err) { return handleError(res, err); }
    if(!thing) { return res.send(404); }
    var updated = _.merge(thing, req.body);
    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      return res.json(200, thing);
    });
  });
};

// Deletes a thing from the DB.
exports.destroy = function(req, res) {
  Upload.findById(req.params.id, function (err, thing) {
    if(err) { return handleError(res, err); }
    if(!thing) { return res.send(404); }
    thing.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}