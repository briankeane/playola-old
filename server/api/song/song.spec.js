//'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var User = require('../user/user.model');
var Song = require('./song.model');
var expect = require('chai').expect;
var async = require('async');
var SpecHelper = require('../../utilities/helpers/specHelper');

describe('GET /api/v1/songs', function() {


});

describe('a song', function () {
  var song;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {
      song = new Song({ artist: 'Rachel Loy',
                        title: 'Stepladder',
                        album: 'Broken Machine',
                        duration: 180000,
                        key: 'ThisIsAKey.mp3',
                        echonestId: 'ECHONEST_ID' });
      song.save(function (err, savedSong) {
        done();
      });
    });
  });

  it ('persists a song', function (done) {
    song.save(function (err, user) {
      expect(err).to.equal(null);
      Song.findOne({ artist: 'Rachel Loy' }, function (err, gottenUser) {
        expect(err).to.equal(null);
        expect(song.artist).to.equal('Rachel Loy');
        expect(song.title).to.equal('Stepladder');
        expect(song.album).to.equal('Broken Machine');
        expect(song.duration).to.equal(180000);
        expect(song.key).to.equal('ThisIsAKey.mp3');
        expect(song.echonestId).to.equal('ECHONEST_ID');
        done();
      });
    });
  });

  it ('can be retrieved by id', function (done) {
    song.save(function (err, savedSong) {
      Song.findById(savedSong.id, function (err, gottenSong) {
        expect(err).to.equal(null);
        expect(gottenSong.artist).to.equal('Rachel Loy');
        done();
      });
    });
  });

  it ('can be updated', function (done) {
      song.save(function (err, savedSong) {
      Song.findByIdAndUpdate(savedSong.id, { $set: { artist: 'Adam Hood',
                                                title: 'He Did',
                                                album: 'Welcome to the Big World',
                                                duration: 1990,
                                                key: 'ThisIsADifferentKey',
                                                echonestId: 'anotherEchonestId' } }, function (err, updatedSong) {
        expect(err).to.equal(null);
        expect(updatedSong.artist).to.equal('Adam Hood');
        expect(updatedSong.title).to.equal('He Did');
        expect(updatedSong.album).to.equal('Welcome to the Big World');
        expect(updatedSong.duration).to.equal(1990);
        expect(updatedSong.key).to.equal('ThisIsADifferentKey');
        expect(updatedSong.echonestId).to.equal('anotherEchonestId');
        done();
      });
    });
  });
  
  xit ('finds out if a song exists', function (done) {
    Song.findOne({ title: 'Rachel Loy' }, function (err, noSong) {
      expect(noSong).to.equal(null);
      song.save(function (err, savedSong) {
        Song.findOne({ title: 'Stepladder' }, function (err, foundSong) {
          expect(foundSong._id).to.equal(song._id);
          done();
        });
      });
    });
    song.save(function (err, savedSong) {
    });
  });

  describe ('song retrieval tests', function (done) {
    var songs = [];

    beforeEach(function (done) {
      Song.remove({}, function (err) {
        songs.push(new Song({ artist: 'Brian Keane',
                              title: 'Bar Lights',
                              duration: 226000,
                              key: 'ThisIsAKey1.mp3',
                              echonestId: 'ECHONEST_ID1' }));
        songs.push(new Song({ artist: 'Brian Keane',
                              title: 'Bar Nights',
                              duration: 226000,
                              key: 'ThisIsAKey2.mp3',
                              echonestId: 'ECHONEST_ID2' }));
        songs.push(new Song({ artist: 'Brian Keane',
                              title: 'Bar Brights',
                              duration: 226000,
                              key: 'ThisIsAKey3.mp3',
                              echonestId: 'ECHONEST_ID3' }));
        songs.push(new Song({ artist: 'Bob Dylan',
                              title: 'Bar First',
                              duration: 226000,
                              key: 'ThisIsAKey4.mp3',
                              echonestId: 'ECHONEST_ID4' }));
        songs.push(new Song({ artist: 'Bob Dylan',
                              title: 'Hell',
                              duration: 226000,
                              key: 'ThisIsAKey5.mp3',
                              echonestId: 'ECHONEST_ID5' }));

        var songSaveFunctions = []
        for (var i=0; i<songs.length; i++) {
          songSaveFunctions.push((function (song) {
            return function (callback) {
              song.save(callback);
            };
          })(songs[i]));
        }

        async.parallel(songSaveFunctions, function (err, results) {
          done();
        });
      });
    });

    it ('gets a list of songs by title', function (done) {
      Song.findAllMatchingTitle('Bar', function (err, foundSongs) {
        expect(foundSongs.length).to.equal(4);
        expect(foundSongs[0].title).to.equal("Bar Brights");
        expect(foundSongs[3].title).to.equal("Bar Nights");
        done();
      });
    });

    it ('gets a list of songs by artist', function (done) {
      Song.findAllMatchingArtist('Brian Keane', function (err, foundSongs) {
        expect(foundSongs.length).to.equal(3);
        expect(foundSongs[0].title).to.equal("Bar Brights");
        expect(foundSongs[2].title).to.equal("Bar Nights");
        done();
      });
    });

    it ('gets a list of songs by keywords', function (done) {
      Song.keywordSearch('Bar kea', function (err, foundSongs) {
        expect(err).to.equal(null);
        expect(foundSongs.length).to.equal(3);
        expect(foundSongs[0].title).to.equal('Bar Brights');
        expect(foundSongs[2].title).to.equal('Bar Nights');
        done();
      });
    });

    it ('gets a list of songs by artist and title', function (done) {
      Song.findAllByTitleAndArtist({ artist: 'Bob Dylan',
                                        title: 'Bar First' }, function (err, foundSongs) {
        expect(err).to.equal(null);
        expect(foundSongs.length).to.equal(1);
        expect(foundSongs[0].title).to.equal(songs[3].title)
        expect(foundSongs[0].artist).to.equal(songs[3].artist)
        done();
      });
    });

    it ('gets another list of songs by artist and title', function (done) {
      Song.findAllByTitleAndArtist({ artist: 'Bob Dylan',
                                        title: 'Hell' }, function (err, foundSongs) {
        expect(err).to.equal(null);
        expect(foundSongs.length).to.equal(1);
        expect(foundSongs[0].title).to.equal(songs[4].title)
        expect(foundSongs[0].artist).to.equal(songs[4].artist)
        done();
      });
    });

    it ('gets a song by its echonest_id', function (done) {
      Song.findOne({ echonestId: songs[1].echonestId }, function (err, foundSong) {
        expect(err).to.equal(null);
        expect(foundSong.title).to.equal(songs[1].title);
        expect(foundSong.artist).to.equal(songs[1].artist);
        done();
      });
    });

    it ('gets a song by its key', function (done) {
      Song.findOne({ key: songs[2].key }, function (err, foundSong) {
        expect(err).to.equal(null);
        expect(foundSong.title).to.equal(songs[2].title);
        expect(foundSong.artist).to.equal(songs[2].artist);
        done();
      });
    });
    it ('returns a list of all songs in the database in the proper order', function (done) {
      Song.all(function (err, songList) {
        expect(err).to.equal(null);
        expect(songList.length).to.equal(5);
        expect(songList[0].title).to.equal('Bar First');
        expect(songList[1].title).to.equal('Hell');
        expect(songList[2].title).to.equal('Bar Brights');
        expect(songList[3].title).to.equal('Bar Lights');
        expect(songList[4].title).to.equal('Bar Nights');
        done();
      })  
    });
  });
});
