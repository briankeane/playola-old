var config = require('../../config/environment');
var s3HighLevel = require('s3').createClient(config.s3Options);
var AWS = require('aws-sdk');
AWS.config.region = 'us-west-2';
var s3 = new AWS.S3();
var expect = require('chai').expect;
var Station = require('../../api/station/station.model');
var fs = require('fs');
var audioSH = require('./audioFileStorageHandler');

describe('audioFileStorageHandler', function (done) {

  beforeEach(function (done) {  
    this.timeout(30000);
    audioSH.clearBucket('playolasongstest', function () {
      audioSH.clearBucket('playolacommentariestest', function () {
        audioSH.clearBucket('playolaunprocessedsongstest', function () {
          done();
        });
      });
    });
  });

  afterEach(function (done) {  
    this.timeout(10000);
    audioSH.clearBucket('playolasongstest', function () {
      audioSH.clearBucket('playolacommentariestest', function () {
        audioSH.clearBucket('playolaunprocessedsongstest', function () {
          done();
        });
      });
    });
  });

  it('gets metadata from a stored song', function (done) {
    var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                    s3Params: {
                                      Bucket: 'playolasongstest',
                                      Key: 'test.txt',
                                      Metadata: {
                                        pl_title       : "Stepladder",
                                        pl_artist      : "Rachel Loy",
                                        pl_album       : "Broken Machine",
                                        pl_duration    : "55",
                                        pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                      }
                                    }
                                  });
    uploader.on('end', function () {
      audioSH.getStoredSongMetadata('test.txt', function (err, data) {
        expect(data.title).to.equal('Stepladder');
        expect(data.artist).to.equal('Rachel Loy');
        expect(data.album).to.equal('Broken Machine');
        expect(data.duration).to.equal(55);
        expect(data.echonestId).to.equal('SOOWAAV13CF6D1B3FA');
        done();
      });
    });
  });

  it('stores a song', function (done) {
    this.timeout(100000);
    audioSH.storeSong({ title: 'Look At That Girl',
                        artist: 'Rachel Loy',
                        album: 'Broken Machine',
                        duration: 9999,
                        echonestId: 'test_echonest_id',
                        filepath: process.cwd() + '/server/data/testFiles/lookTest.mp3' 
                      }, function (err, key) {
      expect(err).to.equal(null);
      expect(key).to.be.a('string');
      s3.headObject({ Bucket: 'playolasongstest', Key: key}, function (err, data) {
        expect(data.ContentLength).to.equal('71970');
        expect(data.Metadata.pl_title).to.equal('Look At That Girl');
        expect(data.Metadata.pl_artist).to.equal('Rachel Loy');
        expect(data.Metadata.pl_album).to.equal('Broken Machine');
        expect(data.Metadata.pl_duration).to.equal('9999');
        expect(data.Metadata.pl_echonest_id).to.equal('test_echonest_id');
        done();
      });
    });
  });

  it('stores a commentary', function (done) {
    this.timeout(100000);
    station = new Station({ secsOfCommercialsPerHour: 360 });
    station.save(function (err, savedStation) {
      audioSH.storeCommentary({ stationId: station.id,
                                duration: 9999,
                                filepath: process.cwd() + '/server/data/testFiles/testCommentary.mp3' 
                              }, function (err, key) {
        expect(err).to.equal(null);
        expect(key).to.be.a('string');
        s3.headObject({ Bucket: 'playolacommentariestest', Key: key }, function (err, data) {
          expect(data.Metadata.pl_duration).to.equal('9999');
          expect(data.Metadata.pl_station_id).to.equal(station.id);
          expect(data.ContentLength).to.equal('497910');
          done();
        });
      });
    });
  });

  it('stores an unprocessed song', function (done) {
    this.timeout(10000);
    audioSH.storeUnprocessedSong(process.cwd() + '/server/data/testFiles/lookTest.mp3', function (err, key) {
      expect(err).to.equal(null);
      expect(key).to.equal('lookTest.mp3');
      s3.headObject({ Bucket: 'playolaunprocessedsongstest', Key: key }, function (err, data) {
        console.log(key);
        console.log(err);
        console.log(data);
        expect(data.ContentLength).to.equal('71970');
        done();
      });
    });
  });

  it('updates the metadata on a song', function (done) {
    this.timeout(10000);
    var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                    s3Params: {
                                      Bucket: 'playolasongstest',
                                      Key: 'test.txt',
                                      Metadata: {
                                        pl_title       : "Stepladder",
                                        pl_artist      : "Rachel Loy",
                                        pl_album       : "Broken Machine",
                                        pl_duration    : "55",
                                        pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                      }
                                    }
    });
    uploader.on('end', function () {
      audioSH.updateMetadata({ key: 'test.txt',
                                          title: 'FAKEtitle',
                                          artist: 'FAKEartist',
                                          duration: 1,
                                          echonestId: 'FAKEid'
                                        }, function (err) {
        s3.headObject({ Bucket: 'playolasongstest', Key: 'test.txt'}, function (err, data) {
          expect(data.ContentLength).to.equal('14');
          expect(data.Metadata.pl_title).to.equal('FAKEtitle');
          expect(data.Metadata.pl_artist).to.equal('FAKEartist');
          expect(data.Metadata.pl_album).to.equal('Broken Machine');
          expect(data.Metadata.pl_duration).to.equal('1');
          expect(data.Metadata.pl_echonest_id).to.equal('FAKEid');
          done();
        });
      });
    });
  });
  
  describe('fileFunctions', function (done) {
    after(function (done) {
      fs.unlink(process.cwd() + '/server/data/test.txt', function (err) {
        done();
      });
    });

    it('gets unprocessed song audio', function (done) {
      var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                      s3Params: {
                                        Bucket: 'playolaunprocessedsongstest',
                                        Key: 'test.txt',
                                        Metadata: {
                                          pl_title       : "Stepladder",
                                          pl_artist      : "Rachel Loy",
                                          pl_album       : "Broken Machine",
                                          pl_duration    : "55",
                                          pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                        }
                                      }
      });
      uploader.on('end', function () {
        audioSH.getUnprocessedSong('test.txt', function (err, filepath) {
          fs.stat(filepath, function (err, stats) {
            expect(stats.size).to.equal(14);
            done();
          });
        });
      });
    });
  });

  it('deletes unprocessed song', function (done) {
    var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                      s3Params: {
                                        Bucket: 'playolaunprocessedsongstest',
                                        Key: 'test.txt',
                                        Metadata: {
                                          pl_title       : "Stepladder",
                                          pl_artist      : "Rachel Loy",
                                          pl_album       : "Broken Machine",
                                          pl_duration    : "55",
                                          pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                        }
                                      }
    });
    uploader.on('end', function () {
      audioSH.deleteUnprocessedSong('test.txt', function (err, deleteData) {

        s3.getObject({ Bucket: 'playolaunprocessedsongstest',
                        Key: 'test.txt'}, function (err, data) {
          expect(err.code).to.equal('NoSuchKey');
          done();
        });
      });
    });

  });

  it('returns an array of all stored songs as objects', function (done) {
    this.timeout(10000);
    
    audioSH.clearBucket('playolasongstest', function () {

      var uploadedCount = 0;
      var uploader1 = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                        s3Params: {
                                          Bucket: 'playolasongstest',
                                          Key: 'test.txt',
                                          Metadata: {
                                            pl_title       : "Stepladder",
                                            pl_artist      : "Rachel Loy",
                                            pl_album       : "Broken Machine",
                                            pl_duration    : "55",
                                            pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                          }
                                        }
      });
      var uploader2 = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                        s3Params: {
                                          Bucket: 'playolasongstest',
                                          Key: 'test2.txt',
                                          Metadata: {
                                            pl_title       : "Stepladder2",
                                            pl_artist      : "Rachel Loy2",
                                            pl_album       : "Broken Machine2",
                                            pl_duration    : "552",
                                            pl_echonest_id : 'SOOWAAV13CF6D1B3FA2'
                                          }
                                        }
      });
      var uploader3 = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                        s3Params: {
                                          Bucket: 'playolasongstest',
                                          Key: 'test3.txt',
                                          Metadata: {
                                            pl_title       : "Stepladder3",
                                            pl_artist      : "Rachel Loy3",
                                            pl_album       : "Broken Machine3",
                                            pl_duration    : "553",
                                            pl_echonest_id : 'SOOWAAV13CF6D1B3FA3'
                                          }
                                        }
      });
      uploader1.on('end', function () {
        if (++uploadedCount === 3) continueTest();
      });
      uploader2.on('end', function () {
        if (++uploadedCount === 3) continueTest();
      })
      uploader3.on('end', function () {
        if (++uploadedCount === 3) continueTest();
      });
    });

    function continueTest() {
      audioSH.getAllSongs(function (err, allSongsArray) {
        expect(allSongsArray.length).to.equal(3);
        expect(allSongsArray[0].artist).to.equal('Rachel Loy');
        expect(allSongsArray[0].title).to.equal('Stepladder');
        expect(allSongsArray[0].echonestId).to.equal('SOOWAAV13CF6D1B3FA');
        expect(allSongsArray[0].duration).to.equal(55);
        expect(allSongsArray[0].key).to.equal('test.txt');
        expect(allSongsArray[0].album).to.equal('Broken Machine');
        expect(allSongsArray[2].title).to.equal('Stepladder3');

        done();
      });
    }
  });

  it('deletes a song', function (done) {
    this.timeout(5000);
    var uploader = s3HighLevel.uploadFile({ localFile: process.cwd() + '/server/data/testFiles/test.txt',
                                      s3Params: {
                                        Bucket: 'playolasongstest',
                                        Key: 'test.txt',
                                        Metadata: {
                                          pl_title       : "Stepladder",
                                          pl_artist      : "Rachel Loy",
                                          pl_album       : "Broken Machine",
                                          pl_duration    : "55",
                                          pl_echonest_id : 'SOOWAAV13CF6D1B3FA'
                                        }
                                      }
    });
    uploader.on('end', function () {
      audioSH.deleteUnprocessedSong('test.txt', function (err, deleteData) {

        s3.getObject({ Bucket: 'playolaunprocessedsongstest',
                        Key: 'test.txt'}, function (err, data) {
          expect(err.code).to.equal('NoSuchKey');
          done();
        });
      });
    });
  });
});