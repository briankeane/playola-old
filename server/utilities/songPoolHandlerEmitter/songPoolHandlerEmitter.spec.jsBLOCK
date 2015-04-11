var config = require('../../config/environment');
var SpecHelper = require('../helpers/specHelper');
var echojs = require('echojs');
var echo = echojs({ key: process.env.ECHONEST_KEY });
var SongPool = require('./songPoolHandlerEmitter');
var Song = require('../../api/song/song.model');
var expect = require('chai').expect;
var fs = require('fs');
var _ = require('lodash');

describe('songPoolHandler', function (done) {

  var songs;
  
  beforeEach(function (done) { 
    this.timeout(10000);
    songs = [];
    songs.push(new Song({ artist: 'Rachel Loy',
                          title: 'Stepladder',
                          album: 'Broken Machine',
                          duration: 999,
                          key: 'test_key.mp3',
                          echonestId: 'SOOWAAV13CF6D1B3FA' }));
    songs.push(new Song({ artist: 'Rachel Loy',
                          title: 'Cheater',
                          album: 'Broken Machine',
                          duration: 888,
                          key: 'test_key2.mp3',
                          echonestId: 'SOTWSLV13CF6D275AF' }));
    SpecHelper.saveAll(songs, function (err, savedSongs) {
      SongPool.clearAllSongs()
      .on('finish', function () {
        done();
      });
    });
  });

  it('adds a song to the song pool', function (done) {
    this.timeout(10000);
    //SongPool.clearAllSongs()
    //.on('finish', function () {
      SongPool.addSong(songs[0])
      .on('finish', function() {
        SongPool.getAllSongs()
        .on('finish', function (err, allSongs) {
          expect(err).to.eq(null);
          expect(allSongs.length).to.equal(1);
          expect(allSongs[0].artist).to.equal('Rachel Loy');
          expect(allSongs[0].title).to.equal('Stepladder');
          expect(allSongs[0].album).to.equal('Broken Machine');
          expect(allSongs[0].duration).to.equal(999);
          expect(allSongs[0].key).to.equal('test_key.mp3');
          expect(allSongs[0].echonestId).to.equal('SOOWAAV13CF6D1B3FA');
          done();
        });
      });
    //});
  });

  it('deletes a song from the song pool', function (done) {
    this.timeout(5000);
    //SongPool.clearAllSongs()
    //.on('finish', function() {
      SongPool.addSongs(songs)
      .on('finish', function (err, ticket) {
        SongPool.getAllSongs()
        .on('finish', function (err, allSongs) {
          expect(allSongs.length).to.equal(2);
          SongPool.deleteSong(songs[0].key)
          .on('finish', function (err, ticket) {
            SongPool.getAllSongs()
            .on('finish', function (err, newAllSongs) {
              expect(err).to.equal(null);
              expect(newAllSongs.length).to.equal(1);
              expect(newAllSongs[0].title).to.equal('Cheater');
              done();
            })
          });
        });
      });
    //});
  });

  it('adds and retrieves an array of all songs in the song pool', function (done) {
    this.timeout(5000);
    SongPool.addSongs(songs)
    .on('finish', function () {
      SongPool.getAllSongs()
      .on('finish', function (err, allSongs) {
        expect(err).to.equal(null);
        expect(allSongs.length).to.equal(2)
        expect(allSongs[0].title).to.equal('Cheater');
        expect(allSongs[1].title).to.equal('Stepladder');
        done();
      });
    });
  });

  it('clears all songs from the song pool', function (done) {
    this.timeout(6000); 
    SongPool.addSongs(songs)
    .on('finish', function () {
      SongPool.getAllSongs()
      .on('finish', function (err, allSongs) {
        expect(err).to.equal(null);
        expect(allSongs.length).to.equal(2);
        SongPool.clearAllSongs()
        .on('finish', function() {
          SongPool.getAllSongs()
          .on('finish', function (err, allSongsWereDeleted) {
            expect(err).to.equal(null);
            expect(allSongsWereDeleted.length).to.equal(0);
            done();
          });
        });
      });
    });
  });


  describe('songPoolHandler - getSuggestions', function (done) {
    before(function (done) {
      this.timeout(30000);
      var data = fs.readFileSync(process.cwd() + '/server/data/testFiles/echonest_cat.json', 'utf8');
      SongPool.clearAllSongs()
      .on('finish', function () {
        console.log('cleared');
        echo('tasteprofile/update').post({ id: 'CAIQEUO1473A654C51', data: data }, function (err, json) {
          if (err) console.log(err);
          console.log('waiting');
          waitAndGetSongs(json.response["ticket"], function (err, allSongsAsObjects) {
            console.log('done waiting');
            // seed the db
            if (err) console.log(err);
            var allSongs = _.map(allSongsAsObjects, function(attrs) { return new Song(attrs); });
              SpecHelper.saveAll(allSongs, function(err, songs) {
                Song.find({}, function (err, allSongs) {
                done();
                })
            });
          });
        });
      });
    });

    it('suggests a playlist based on an artist', function (done) {
      this.timeout(5000);
      SongPool.getSongSuggestions(['Rachel Loy'], function (err, playlist) {
        Song.find({}, function (err, allSongs) {
          expect(playlist.length >= 57).to.equal(true);
          expect(playlist[0].artist).to.be.a('String');
          expect(playlist[0].title).to.be.a('String');
          done();
        })
      });
    });

    it('suggests a playlist based on multiple artists', function (done) {
      this.timeout(5000);
      SongPool.getSongSuggestions(['Rachel Loy', 'Lily Allen', 'Miranda Lambert'], function (err, playlist) {
        expect(playlist.length >= 57).to.equal(true);
        expect(playlist[0].artist).to.be.a('String');
        expect(playlist[0].title).to.be.a('String');
        done();
      });
    });

    after(function (done) {
      this.timeout(5000);
      SongPool.clearAllSongs()
      .on('finish', function () {
        done();
      });
    });
  });
});

function waitAndGetSongs(ticket, callback) {
  echo('tasteprofile/status').get({ ticket: ticket }, function (err, json) {
    if (json.response["ticket_status"] != 'complete') {
      setTimeout(function () {
        waitAndGetSongs(ticket, callback);
      }, 1000);
    } else {
      SongPool.getAllSongs()
      .on('finish', function (err, allSongs) {
        callback(err, allSongs);
      });
    }
  });
}

function waitUntilFinished(ticket, callback) {
  echo('tasteprofile/status').get({ ticket: ticket }, function (err, json) {
    if (err) { console.log(err); }
    if (json.response["ticket_status"] != 'complete') {
      setTimeout(function () {
        waitUntilFinished(ticket, callback);
      }, 1000);
    } else {
      callback(err, allSongs);
    }
  });
}