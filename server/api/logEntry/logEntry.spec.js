var should = require('should');
var app = require('../../app');
var request = require('supertest');
var LogEntry = require('../logEntry/logEntry.model');
var Station = require('../station/station.model');
var Commentary = require('../commentary/commentary.model');
var Song = require('../song/song.model');
var Spin = require('../spin/spin.model');
var expect = require('chai').expect;
var async = require('async');
var SpecHelper = require('../../utilities/helpers/specHelper');

describe('GET /api/v1/logEntries', function() {

});


describe('a logEntry', function (done) { 
  var song;
  var station;
  var logEntry;
  
  beforeEach(function (done) {
    SpecHelper.clearDatabase(function () {
      
      station = new Station ({ });  
      song  = new Song({ duration: 1000 });
      SpecHelper.saveAll([station, song], function (err, savedModels) {
        logEntry = new LogEntry({ _station: station.id,
                                  playlistPosition: 76,
                                  _audioBlock: song.id,
                                  airtime: new Date(1983,4,15,18),
                                  listenersAtStart: 55,
                                  listenersAtFinish: 57,
                                  durationOffset: 10 });
        logEntry.save(function (err, savedLogEntry) {
          done();
        });
      });
    });
  });

  it('can be created', function (done) {
    expect(logEntry._station.equals(station.id)).to.equal(true);
    expect(logEntry.playlistPosition).to.equal(76);
    expect(logEntry._audioBlock.equals(song.id)).to.equal(true);
    expect(logEntry.airtime.getTime()).to.equal(new Date(1983,4,15,18).getTime());
    expect(logEntry.listenersAtStart).to.equal(55);
    expect(logEntry.listenersAtFinish).to.equal(57);
    expect(logEntry.durationOffset).to.equal(10);
    done();
  });

  it('calculates duration and endTime', function (done) {
    logEntry.populate('_audioBlock', function (err, foundLogEntry) {
      expect(logEntry.duration).to.equal(1010);
      expect(logEntry.endTime.getTime()).to.equal(new Date(1983,4,15,18,00,01,10).getTime());
      done();
    });
  });
});

describe('Log Methods', function (done){
  var logEntries = [];
  var song = [];
  var station;
  
  beforeEach(function (done) {

    SpecHelper.clearDatabase(function () {
      station = new Station({});
      station.save(function (err, savedStation) {
        song = new Song({ duration: 180000 });
        song.save(function (err, savedSong) {
          for (var i=0;i<30;i++) {
            logEntries.push(new LogEntry({  _station: station.id,
                                            _audioBlock: song.id,
                                            playlistPosition: 76 + i,
                                            airtime: new Date(new Date(1983,4,15,18).getTime() + (i*360000)),
                                            listenersAtStart: i + 55,
                                            listenersAtFinish: i+57 }));
          }
          SpecHelper.saveAll(logEntries, function (err, savedLogEntries) {
            done();
          });
        });
      })
    });
  });

  it('can get recent entries', function (done) {
    LogEntry.getRecent({ _station: station.id, count: 15 }, function (err, gottenEntries) {
      expect(gottenEntries.length).to.equal(15);
      expect(gottenEntries[0].playlistPosition).to.equal(105);
      expect(gottenEntries[14].playlistPosition).to.equal(91);
      done();
    });
  });

  it('can get the full station log', function (done) {
    LogEntry.getFullStationLog(station.id, function (err, gottenEntries) {
      expect(gottenEntries.length).to.equal(30);
      expect(gottenEntries[0].playlistPosition).to.equal(105);
      expect(gottenEntries[29].playlistPosition).to.equal(76);
      done();
    });
  });

  it('can get a logEntry by its playlistPosition and _station', function (done) {
    LogEntry.getEntryByPlaylistPosition({ _station: station.id,
                                          playlistPosition: 76
                                        }, function (err, entry) {
      expect(entry.listenersAtStart).to.equal(logEntries[0].listenersAtStart);
      done();
    });
  });

  it('can get logEntries by date range', function (done) {
    nextDayLogEntry = new LogEntry({ _station: station.id,
                                     _audioBlock: song.id,
                                     playlistPosition: 300,
                                     airtime: new Date(1983,4,16,18),
                                     listenersAtStart: 10,
                                     listenersAtFinish: 12 });
    nextDayLogEntry.save(function (err, savedNextDayEntry) {
      LogEntry.getLog({ startDate: new Date(1983,4,15),
                                       endDate: new Date(1983,4,16),
                                       _station: station.id
                                     }, function (err, gottenEntries) {
        expect(gottenEntries.length).to.equal(31);
        LogEntry.getLog({ startDate: new Date(1983,4,14),
                                          endDate: new Date(1983,4,15),
                                          _station: station.id 
                                    }, function (err, gottenEntries) {
          expect(gottenEntries.length).to.equal(30);
          LogEntry.getLog({ startDate: new Date(1983,4,16),
                                            endDate: new Date(1983,4,16),
                                           _station: station.id
                                         }, function (err, gottenEntries) {
            expect(gottenEntries.length).to.equal(1);
            done();
          });
        });
      });
    });
  });
  
  it('can create a version of itself from a spin', function (done) {
    var spin = new Spin({ _station: station.id,
                          playlistPosition: 100,
                          _audioBlock: song.id,
                          airtime: new Date(2014,3,15, 12) });
    spin.save(function (err, newSpin) {
      var createdLogEntry = LogEntry.newFromSpin(newSpin);
      expect(createdLogEntry._station.equals(station.id)).to.equal(true);
      expect(createdLogEntry._audioBlock.equals(song.id)).to.equal(true);
      expect(createdLogEntry.airtime.getTime()).to.equal(spin.airtime.getTime());
      expect(createdLogEntry.playlistPosition).to.equal(100);
      done();
    });
  });

  xit('getMostRecent gets the most recently played logEntry', function (done) {
    done();
  });

  it('can create a version of itself from a populated spin', function (done) {
    var spin = new Spin({ _station: station.id,
                          playlistPosition: 100,
                          _audioBlock: song.id,
                          airtime: new Date(2014,3,15, 12) });
    spin.save(function (err, newSpin) {
      Spin.findById(newSpin.id)
      .populate('_station, _audioBlock')
      .exec(function (err, populatedSpin) {
        var createdLogEntry = LogEntry.newFromSpin(populatedSpin);
        expect(createdLogEntry._station.equals(station.id)).to.equal(true);
        expect(createdLogEntry._audioBlock.equals(song.id)).to.equal(true);
        expect(createdLogEntry.airtime.getTime()).to.equal(spin.airtime.getTime());
        expect(createdLogEntry.playlistPosition).to.equal(100);
        done();
      });
    });
  });
});