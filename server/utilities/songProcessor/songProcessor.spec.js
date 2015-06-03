var config = require('../../config/environment');
var s3HighLevel = require('s3').createClient(config.s3Options);
var app = require('../../app');
var expect = require('chai').expect;
var fs = require('fs');
var Song = require('../../api/song/song.model');
var Upload = require('../../api/upload/upload.model');
var Storage = require('../audioFileStorageHandler/audioFileStorageHandler');
var SongPool = require('../songPoolHandlerEmitter/songPoolHandlerEmitter');
var SongProcessor = require('./songProcessor');
var AWS = require('aws-sdk');
AWS.config.region = 'us-west-2';
var s3 = new AWS.S3();
var SpecHelper = require('../helpers/specHelper');

var testFilesArray = [];

describe('songProcessor', function (done) {
  
  it('gets id3 tags from an mp3 file', function (done) {
    this.timeout(5000);
    SongProcessor.getTags(process.cwd() + '/server/data/testFiles/look.mp3', function (err, tags) {
      expect(tags.title).to.equal('Look At That Girl');
      expect(tags.artist).to.equal('Rachel Loy');
      expect(tags.duration).to.equal(241000);
      expect(tags.sampleRate).to.equal(44100);
      expect(tags.channels).to.equal(2);
      expect(tags.bitrate).to.equal(160);
      expect(tags.album).to.equal('Broken Machine');
      done();
    });
  });

  it('gets id4 tags from an encrypted m4a file', function (done) {
    this.timeout(5000);
    SongProcessor.getTags(process.cwd() + '/server/data/testFiles/downtown.m4p', function (err, tags) {
      expect(tags.title).to.equal('Girl Downtown');
      expect(tags.artist).to.equal('Hayes Carll');
      expect(tags.album).to.equal('Trouble In Mind');
      expect(tags.duration).to.equal(207000);
      done();
    });
  });

  it('gets id4 tags from a non-encrypted m4a file', function (done) {
    this.timeout(5000);
    SongProcessor.getTags(process.cwd() + '/server/data/testFiles/lonestar.m4a', function (err, tags) {
      if (err) { console.log(err);}
      expect(tags.title).to.equal('Lone Star Blues');
      expect(tags.artist).to.equal('Delbert McClinton');
      expect(tags.album).to.equal('Room to Breathe');
      done();
    });
  });

  it('gets itunes info', function (done) {
    this.timeout(10000);
    SongProcessor.getItunesInfo({ artist: 'Miranda Lambert',
                                  title: 'Little Red Wagon'
                                }, function (err, match) {
      expect(match.albumArtworkUrl).to.equal('http://is1.mzstatic.com/image/pf/us/r30/Music/v4/e5/22/a0/e522a052-63eb-d71e-7fbd-ccff670a399d/886444518710.600x600-75.jpg');
      expect(match.trackViewUrl).to.equal('https://itunes.apple.com/us/album/little-red-wagon/id849069497?i=849069513&uo=4');
      expect(match.album).to.equal('Platinum');
      done();
    });
  });

  it('getsSongMatchPossibilities', function (done) {
    this.timeout(30000);
    SongProcessor.getSongMatchPossibilities({ artist: 'The Beatles',
                                              title: 'Eleanor Rigby' 
                                            }, function (err, result) {                              
      expect(result.possibleMatches.length).to.equal(15);
      expect(result.possibleMatches[0].artist).to.equal('The Beatles');
      expect(result.possibleMatches[0].title).to.equal('ELEANOR RIGBY');
      expect(result.possibleMatches[0].echonestId).to.equal('SOKTZBX12B20E5E4AB');
      SongProcessor.getSongMatchPossibilities({ artist: 'Rachel Loy',
                                                title: 'Stepladder' 
                                              }, function (err, result) {
        expect(result.possibleMatches[0].artist).to.equal('Rachel Loy');
        expect(result.possibleMatches[0].title).to.equal('Stepladder');
        done();
      });
    }); 
  });

  it('gets the echonest info', function (done) {
    this.timeout(60000);
    SongProcessor.getSongMatchPossibilities({ title: 'Stepladder', artist: 'Rachel Loy'
                                            }, function (err, result) {
      var song = result.closestMatch;
      expect(song.title).to.equal('Stepladder');
      expect(song.artist).to.equal('Rachel Loy');
      expect(song.echonestId).to.equal('SOOWAAV13CF6D1B3FA');
      expect(song.genres.length).to.equal(0);
      SongProcessor.getSongMatchPossibilities({ title: 'Kiss Me In The Dark',
                                      artist: 'Randy Rogers'
                                    }, function (err, result2) {

        expect(result2.closestMatch.title.toLowerCase()).to.equal('kiss me in the dark');
        expect(result2.closestMatch.artist).to.equal('Randy Rogers Band');
        done();
      });
    });
  });

  describe('adds a song to the system', function (done) {

    beforeEach(function (done) {
      SpecHelper.clearDatabase(function () {
        done();
      });
    });

    before(function (done) {
      this.timeout(20000);
      var finishedCount = 0;
    
      // copy the file from test folder to unprocessedAudio folder

      var readpath = process.cwd() + '/server/data/testFiles/lonestarTest.m4a';
      var writepath = process.cwd() + '/server/data/unprocessedAudio/lonestarTest.m4a';
      var read = fs.createReadStream(readpath)
      var write = fs.createWriteStream(writepath);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/lonestarTest.mp3');
      testFilesArray.push(writepath);
      read.pipe(write)
      .on('finish', function () {
        finishedOperation();
      });

      // copy the file from test folder to unprocessedAudio folder
      var readpath2 = process.cwd() + '/server/data/testFiles/lonestar.m4a';
      var writepath2 = process.cwd() + '/server/data/unprocessedAudio/lonestar.m4a';
      var read2 = fs.createReadStream(readpath2)
      var write2 = fs.createWriteStream(writepath2);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/lonestar.mp3');
      testFilesArray.push(writepath2);
      read2.pipe(write2)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath3 = process.cwd() + '/server/data/testFiles/downtown.m4p';
      var writepath3 = process.cwd() + '/server/data/unprocessedAudio/downtown.m4p';
      var read3 = fs.createReadStream(readpath3)
      var write3 = fs.createWriteStream(writepath3);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/downtown.mp3');
      testFilesArray.push(writepath3);
      read3.pipe(write3)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath4 = process.cwd() + '/server/data/testFiles/faithTest.mp3';
      var writepath4 = process.cwd() + '/server/data/unprocessedAudio/faithTest.mp3';
      var read4 = fs.createReadStream(readpath4);
      var write4 = fs.createWriteStream(writepath4);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/faithTest.mp3');
      testFilesArray.push(writepath4);
      read4.pipe(write4)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath5 = process.cwd() + '/server/data/testFiles/lonestarTest2.m4a';
      var writepath5 = process.cwd() + '/server/data/unprocessedAudio/lonestarTest2.m4a';
      var read5 = fs.createReadStream(readpath5)
      var write5 = fs.createWriteStream(writepath5);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/lonestarTest2.mp3');
      testFilesArray.push(writepath5);
      read5.pipe(write5)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath6 = process.cwd() + '/server/data/testFiles/lonestarTest2.m4a';
      var writepath6 = process.cwd() + '/server/data/unprocessedAudio/lonestarTest3.m4a';
      var read6 = fs.createReadStream(readpath6)
      var write6 = fs.createWriteStream(writepath6);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/lonestarTest3.mp3');
      testFilesArray.push(writepath6);
      read6.pipe(write6)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath7 = process.cwd() + '/server/data/testFiles/faithTest.mp3';
      var writepath7 = process.cwd() + '/server/data/unprocessedAudio/faithTest2.mp3';
      var read7 = fs.createReadStream(readpath7)
      var write7 = fs.createWriteStream(writepath7);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/faithTest2.mp3');
      testFilesArray.push(writepath7);
      read7.pipe(write7)
      .on('finish', function () {
        finishedOperation();
      });

      var readpath8 = process.cwd() + '/server/data/testFiles/noTags.mp3';
      var writepath8 = process.cwd() + '/server/data/unprocessedAudio/noTags.mp3';
      var read8 = fs.createReadStream(readpath8)
      var write8 = fs.createWriteStream(writepath8);
      testFilesArray.push(process.cwd() + '/server/data/processedAudio/noTags.mp3');
      testFilesArray.push(writepath8);
      read8.pipe(write8)
      .on('finish', function () {
        finishedOperation();
      });
      
      Storage.clearBucket('playolasongstest', function () {
        finishedOperation();
      });

      SongPool.clearAllSongs()
      .on('finish', function() {
        finishedOperation();
      });
      
      function finishedOperation() {
        finishedCount++;

        if (finishedCount >= 10) {
          done();
        }
      }
    });

    it ('writes id3 tags', function (done) {
      this.timeout(5000);
      var filepath = process.cwd() + '/server/data/unprocessedAudio/faithTest2.mp3'
      SongProcessor.writeTags({ filepath: filepath,
                                  title: 'titleGoesHere',
                                  artist: 'artistGoesHere',
                                  album: 'albumGoesHere'
                              }, function (err, tags) {
        
        // proper tags are returned from function
        expect(tags.title).to.equal('titleGoesHere');
        expect(tags.artist).to.equal('artistGoesHere');
        expect(tags.album).to.equal('albumGoesHere');

        SongProcessor.getTags(filepath, function (err, storedTags) {

          // and actually stored in the file
          expect(storedTags.title).to.equal('titleGoesHere');
          expect(storedTags.artist).to.equal('artistGoesHere');
          expect(storedTags.album).to.equal('albumGoesHere');

          SongProcessor.writeTags({ filepath: filepath,
                                    artist: 'New Artist',
                                  }, function (err, newTags) {
            expect(newTags.title).to.equal('titleGoesHere');
            expect(newTags.artist).to.equal('New Artist');
            expect(newTags.album).to.equal('albumGoesHere');
            done();
          });
        });
      })  
    });

    it('writes id4 tags', function (done) {
      this.timeout(5000);
      var filepath = process.cwd() + '/server/data/unprocessedAudio/lonestarTest3.m4a'
      SongProcessor.writeTags({ filepath: filepath,
                                  title: 'titleGoesHere',
                                  artist: 'artistGoesHere',
                                  album: 'albumGoesHere'
                              }, function (err, tags) {
        
        // proper tags are returned from function
        expect(tags.title).to.equal('titleGoesHere');
        expect(tags.artist).to.equal('artistGoesHere');
        expect(tags.album).to.equal('albumGoesHere');

        SongProcessor.getTags(filepath, function (err, storedTags) {

          // and actually stored in the file
          expect(storedTags.title).to.equal('titleGoesHere');
          expect(storedTags.artist).to.equal('artistGoesHere');
          expect(storedTags.album).to.equal('albumGoesHere');

          SongProcessor.writeTags({ filepath: filepath,
                                    artist: 'New Artist',
                                  }, function (err, newTags) {
            expect(newTags.title).to.equal('titleGoesHere');
            expect(newTags.artist).to.equal('New Artist');
            expect(newTags.album).to.equal('albumGoesHere');
            done();
          });
        });
      });      
    });

    it('processes a resubmitted upload with new tags', function (done) {
      this.timeout(40000);
      Song.remove({}, function () {

        var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                                s3Params: {
                                                  Bucket: 'playolaunprocessedsongstest',
                                                  Key: 'test.txt'
                                                }
                                              });
        uploader.on('end', function () {
          SongPool.clearAllSongs()
          .on('finish', function () {
            Upload.create({ key: 'test.txt',
                            status: 'More Info Needed',
                            tags: { artist: 'Sting', title: 'If I Ever Lose My Faith In You', album: "Ten Summoner's Tales" } 
                          }, function (err, newUpload) {
              SongProcessor.processUploadWithUpdatedTags(newUpload, function (err, newSong) {
                expect(newSong.title).to.equal('If I Ever Lose My Faith In You');
                expect(newSong.artist).to.equal('Sting');
                expect(newSong.album).to.equal("Ten Summoner's Tales");
                expect(newSong.echonestId).to.equal('SOIWTGS137608A4D58');
                expect(newSong.albumArtworkUrl).to.equal('http://is1.mzstatic.com/image/pf/us/r30/Features/11/af/6e/dj.dertmkus.600x600-75.jpg');
                expect(newSong.trackViewUrl).to.equal('https://itunes.apple.com/us/album/if-i-ever-lose-my-faith-in-you/id110871?i=110861&uo=4');
                // make sure it was stored properly
                Storage.getStoredSongMetadata(newSong.key, function (err, data) {
                  expect(data.title).to.equal(newSong.title);
                  expect(data.artist).to.equal(newSong.artist);
                  expect(data.duration).to.equal(newSong.duration);
                  expect(data.echonestId).to.equal(newSong.echonestId);

                  // make sure it was added to echonest
                  SongPool.getAllSongs()
                  .on('finish', function (err, allSongs) {
                    expect(allSongs[0].echonestId).to.equal(newSong.echonestId);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
    
    it('calls bullshit if the resubmitted tags do not find a match', function (done) {
      this.timeout(30000);
      Upload.create({ key: 'test.txt',
                          status: 'More Info Needed',
                          tags: { artist: 'Sting', title: 'Prologue (If I Ever Lose My', album: "Ten Summoner's Tales" } 
                        }, function (err, newUpload) {
        SongProcessor.processUploadWithUpdatedTags(newUpload, function (err, newProcessedSong) {
          expect(err.message).to.equal('More Info Needed');
          expect(err.upload.possibleMatches[0]).to.not.equal(undefined);
          done();
        });
      });
    });

    it('does not add a resubmitted song that already exists', function (done) {
      this.timeout(30000);
      var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                              s3Params: {
                                                Bucket: 'playolaunprocessedsongstest',
                                                Key: 'test.txt'
                                              }
                                            });
      uploader.on('end', function () {
        SongPool.clearAllSongs()
        .on('finish', function () {
          Upload.create({ key: 'test.txt',
                          status: 'More Info Needed',
                          tags: { artist: 'Sting', title: 'If I Ever Lose My Faith In You', album: "Ten Summoner's Tales" } 
                        }, function (err, newUpload) {
            Song.create({ artist: 'Sting', title: 'If I Ever Lose My Faith In You', echonestId: 'SOIWTGS137608A4D58'
                        }, function (err, newSong) {
              SongProcessor.processUploadWithUpdatedTags(newUpload, function (err, newProcessedSong) {
                expect(err.message).to.equal('Song Already Exists');
                expect(err.song._id.equals(newSong._id)).to.equal(true);
                done();
              });
            });
          });
        });
      });
    });

    it('allows resubmission with chosen echonestId', function (done) {
      this.timeout(20000);
      var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                    s3Params: {
                                      Bucket: 'playolaunprocessedsongstest',
                                      Key: 'test.txt'
                                    }
                                  });
      uploader.on('end', function () {
        SongPool.clearAllSongs()
        .on('finish', function () {
          SongProcessor.addSongViaEchonestId({  echonestId: 'SOPUMUC14373D95FA3',
                                                artist: 'Sting',
                                                title: 'If I Ever Lose My Faith In You',
                                                album: "Ten Summoner's Tales",
                                                duration: 500,
                                                key: 'test.txt'
                                              }, function (err, newSong) {

            if (err) console.log(err);

            expect(newSong.title).to.equal('If I Ever Lose My Faith In You');
            expect(newSong.artist).to.equal('Sting');
            expect(newSong.album).to.equal("Ten Summoner's Tales");
            expect(newSong.echonestId).to.equal('SOPUMUC14373D95FA3');
            expect(newSong.albumArtworkUrl).to.equal('http://is1.mzstatic.com/image/pf/us/r30/Features/11/af/6e/dj.dertmkus.600x600-75.jpg');
            expect(newSong.trackViewUrl).to.equal('https://itunes.apple.com/us/album/if-i-ever-lose-my-faith-in-you/id110871?i=110861&uo=4');

            // make sure it was stored properly
            Storage.getStoredSongMetadata(newSong.key, function (err, data) {
              expect(data.title).to.equal(newSong.title);
              expect(data.artist).to.equal(newSong.artist);
              expect(data.duration).to.equal(newSong.duration);
              expect(data.echonestId).to.equal(newSong.echonestId);

              // make sure it was added to echonest
              SongPool.getAllSongs()
              .on('finish', function (err, allSongs) {
                expect(allSongs[0].echonestId).to.equal(newSong.echonestId);
                done();
              });
            });
          });
        });
      });
    });



    after(function (done) {
      this.timeout(20000);
      for (var i=0;i<testFilesArray.length;i++) {
        try {
          fs.unlinkSync(testFilesArray[i]);
        } catch (e) {
          // just in case it doesn't exist
        }
      }

      SpecHelper.clearDatabase(function () {
        //Storage.clearBucket('playolasongstest', function () {
          SongPool.clearAllSongs()
          .on('finish', function() {
            done();
          });
        //});
      });

    });
  });
});