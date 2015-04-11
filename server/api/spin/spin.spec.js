//'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var Station = require('../station/station.model');
var Commentary = require('../commentary/commentary.model');
var Song = require('../song/song.model');
var Spin = require('./spin.model');
var expect = require('chai').expect;
var SpecHelper = require('../../utilities/helpers/specHelper');

describe('GET /api/v1/spins', function() {

});


describe('a spin', function (done) { 
  var song;
  var station;
  var commentary;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {
      station = new Station ({ timezone: 'US Central Time',
                               secsOfCommercialPerHour: 180 });

      station.save(function (err, savedStation) {
        commentary = new Commentary({ _station: station.id,
                                      key: 'commentarykey.mp3',
                                      duration: 100 });

        song = new Song({ artist: 'Rachel Loy',
                          title: 'Stepladder',
                          album: 'Broken Machine',
                          duration: 180000,
                          key: 'ThisIsAKey.mp3',
                          echonestId: 'ECHONEST_ID' });

        SpecHelper.saveAll([song, commentary], function (err, models) {
          spin1 = new Spin({ _station: station.id,
                             playlistPosition: 2,
                             _audioBlock: song.id,
                             airtime: new Date(2014,1,1,12) 
                           });
          spin2 = new Spin({ _station: station.id,
                             playlistPosition: 3,
                             _audioBlock: commentary.id,
                             airtime: (new Date(2014,1,1,12)) 
                           });
          spin3 = new Spin({ _station: station.id,
                             playlistPosition: 4,
                             _audioBlock: song.id,
                             airtime: (new Date(2014,1,1,12)) 
                           });

          SpecHelper.saveAll([spin1, spin2, spin3], function (err, models) {
            done();
          });
        });
      });
    });
  });

  it('is created with playlistPosition, airtime, and populatable station & audioBlock', function (done) {
    Spin.findById(spin1)
    .populate('_station _audioBlock')
    .exec(function (err, foundSpin) {
      expect(foundSpin.playlistPosition).to.equal(2)
      expect(foundSpin._audioBlock.title).to.equal('Stepladder');
      expect(foundSpin._station.timezone).to.equal('US Central Time');
      expect(foundSpin.airtime.getTime()).to.equal(new Date(2014,1,1,12).getTime());
      Spin.findById(spin2)
      .populate('_station _audioBlock')
      .exec(function (err, foundSpin) {
        expect(foundSpin._audioBlock.key).to.equal('commentarykey.mp3');
        done();
      })
    });
  });

  xit("can be updated", function (done) {

  });

  it("calculates it's duration & returns null if not populated", function (done) {
    expect(spin1.duration).to.equal(null);  // null before population
    
    spin1.populate('_audioBlock', function (err, spin1Populated) {
      expect(spin1Populated.duration).to.equal(180000);
      
      // check for change wiith durationOffset change
      spin1.durationOffset = 10;
      expect(spin1Populated.duration).to.equal(180010);
      done();
    });
  });

  it("overides its duration if manualDuration is provided", function (done) {
    spin1.manualDuration = 5;
    spin1.save(function (err) {
      Spin.findById(spin1.id, function (err, spin1) {
        expect(spin1.duration).to.equal(5);
        done();
      });
    });
  });

  it("calculates it's endtime & returns null if not populated", function (done) {
    expect(spin1.endTime).to.equal(null);  // null before population
    
    spin1.populate('_audioBlock', function (err, spin1Populated) {
      expect(spin1Populated.endTime.getTime()).to.equal(new Date(2014,1,1,12,3).getTime());
      
      // check for change wiith durationOffset change
      spin1.durationOffset = 10;
      expect(spin1Populated.endTime.getTime()).to.equal(new Date(2014,1,1,12,3,0,10).getTime());
      done();
    });
  });

  it('can tell if a commercial follows', function (done) {
    expect(spin1.commercialsFollow).to.equal(null);
    spin1.airtime = new Date(2014,1,1,12,1);   // set date for no commercial
    spin1.save(function (spin1Saved) {
      spin1.populate('_audioBlock', function (err, spin1Populated) {
        expect(spin1.commercialsFollow).to.equal(false);
        
        spin1.airtime = new Date(2014,1,1,11,59);   // set date for commercial
        spin1.save(function (spin1Saved) {
          spin1.populate('_audioBlock', function (spin1Populated) {
            expect(spin1.commercialsFollow).to.equal(true);
            done();
          });
        });
      });
    });
  });
});

describe('playlist functions', function (done) {
  var spins;
  var station;
  var songs;

  beforeEach(function (done) {
    songs = [];
    spins = [];

    SpecHelper.clearDatabase(function() {
      for (var i=0;i<20;i++) {
        songs.push(new Song({ title: "Song #:" + i }));
      }
      SpecHelper.saveAll(songs, function (err, savedSongs) {
        station = new Station({});
        station.save(function (err, savedStation) {
          startingAirtime = new Date(2014,1,1,10);
          for (var i=0;i<20;i++) {
            spins.push(new Spin({ _station: station.id,
                                  playlistPosition: i+1,
                                  _audioBlock: songs[i].id, 
                                  airtime: startingAirtime }));
            startingAirtime = new Date(startingAirtime.getTime() + 180000);
          }
          SpecHelper.saveAll(spins, function (err, savedSpins) {
            done();
          });
        });
      });
    });
  });

  it("returns the playlist in the correct order", function (done) {
    Spin.getFullPlaylist(station.id, function (err, gottenPlaylist) {
      expect(gottenPlaylist.length).to.equal(20);
      expect(gottenPlaylist[0].playlistPosition).to.equal(1);
      expect(gottenPlaylist[2].playlistPosition).to.equal(3);
      expect(gottenPlaylist[3].playlistPosition).to.equal(4);
      done();
    });
  });

  it("gets a partial playlist with endTime and startTime", function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              startTime: new Date(2014,1,1,10,5),
                              endTime: new Date(2014,1,1,10,15)
                            }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(4);
      expect(partialPlaylist[0].playlistPosition).to.equal(3);
      expect(partialPlaylist[3].playlistPosition).to.equal(6);
      Spin.getPartialPlaylist({ _station: station.id,
                                startTime: new Date(2014,1,1,10,10),
                                endTime: new Date (2014,1,1,10,16) 
                                }, function (err, partialPlaylist) {
        expect(partialPlaylist.length).to.equal(2);
        expect(partialPlaylist[0].playlistPosition).to.equal(5);
        expect(partialPlaylist[1].playlistPosition).to.equal(6);
        done();
      });
    });
  });

  it('gets a partial playlist with only endTime', function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              endTime: new Date(2014,1,1,10,14) 
                            }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(5);
      expect(partialPlaylist[0].playlistPosition).to.equal(1);
      expect(partialPlaylist[4].playlistPosition).to.equal(5);
      done();
    });
  });

  it('gets a partial playlist with only startTime', function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              startTime: new Date(2014,1,1,10,5) 
                            }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(18);
      expect(partialPlaylist[0].playlistPosition).to.equal(3);
      expect(partialPlaylist[17].playlistPosition).to.equal(20);
      done();
    });
  });

  it("gets a partial playlist by starting playlistPosition", function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              startingPlaylistPosition: 10
                             }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(11);
      expect(partialPlaylist[0].playlistPosition).to.equal(10);
      expect(partialPlaylist[10].playlistPosition).to.equal(20);
      done();
    });
  });

  it("gets a partial playlist by ending playlistPosition", function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              endingPlaylistPosition: 10
                             }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(10);
      expect(partialPlaylist[0].playlistPosition).to.equal(1);
      expect(partialPlaylist[9].playlistPosition).to.equal(10);
      done();
    });
  });

  it("gets a partial playlist by starting and ending playlistPositions", function (done) {
    Spin.getPartialPlaylist({ _station: station.id,
                              startingPlaylistPosition: 10,
                              endingPlaylistPosition: 15
                             }, function (err, partialPlaylist) {
      expect(partialPlaylist.length).to.equal(6);
      expect(partialPlaylist[0].playlistPosition).to.equal(10);
      expect(partialPlaylist[5].playlistPosition).to.equal(15);
      done();
    });
  });

  it("gets a spin by its playlistPosition", function (done) {
    Spin.getByPlaylistPosition({ _station: station.id,
                                  playlistPosition: 10
                                }, function (err, foundSpin) {
      expect(foundSpin.playlistPosition).to.equal(10);
      expect(foundSpin._audioBlock.title).to.equal(songs[9].title);
      done();
    });
  });
});