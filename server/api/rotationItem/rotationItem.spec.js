//'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var SpecHelper = require('../../utilities/helpers/specHelper');
var Song = require('../song/song.model');
var Station = require('../station/station.model');
var RotationItem = require('./rotationItem.model');
var expect = require('chai').expect;
var async = require('async');

describe('GET /api/v1/rotationItems', function() {
});



describe('a rotationItem', function () {
  var rotationItem;
  var song;
  var station;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {
      song = new Song({ artist: 'Rachel Loy',
                        title: 'Stepladder',
                        album: 'Broken Machine',
                        eom: 999,
                        boo: 555,
                        duration: 180000,
                        key: 'ThisIsAKey.mp3',
                        echonestId: 'ECHONEST_ID' });

      station = new Station({ secsOfCommercialPerHour: 3 });
      
      SpecHelper.saveAll([song, station], function (err, moreResults) {
        rotationItem = new RotationItem({ _song: song._id,
                                          _station: station._id,
                                          _eom: 111,
                                          bin: 'trash' });
        rotationItem.save(function (err) {
          done();
        }); 
      });
    });
  });

  it("stores a song's station, song, and bin", function (done) {
    expect(rotationItem.bin).to.equal('trash');
    //expect(rotationItem._station).to.equal(station.id);
    RotationItem.findByIdAndPopulate(rotationItem.id, function (err, item) {
      expect(item._song.title).to.equal('Stepladder');
      expect(item._song.id).to.equal(song.id);
      expect(item._station.id).to.equal(station.id);
      done();   
    });
  });

  it('grabs its own eom first, then falls back to the _song', function (done) {
    RotationItem.findByIdAndPopulate(rotationItem.id, function (err, item) {
      expect(item.eom).to.equal(111);
      expect(item.boo).to.equal(555);
      done();
    });
  });

  it("can find all rotationItems for a station and populate them", function (done) {
    var newRotationItems = []
    var newStation = new Station({ secsOfCommercialPerHour: 10 });
    newStation.save(function (err, savedStation) {
      SpecHelper.loadSongs(10, function (err, loadedSongs) {
        for(var i=0;i<10;i++) {
          newRotationItems.push(new RotationItem({ _song: loadedSongs[i].id,
                                  _station: newStation.id,
                                  bin: 'test' }));
        }
        SpecHelper.saveAll(newRotationItems, function (err, savedRotationItems) {
          RotationItem.findAllForStation(newStation.id, function (err, foundRotationItems) {
            expect(foundRotationItems.length).to.equal(10);
            RotationItem.findAllForStation(station.id, function (err, otherFoundRotationItems) {
              expect(otherFoundRotationItems.length).to.equal(1);
              expect(otherFoundRotationItems[0]._song.title).to.equal('Stepladder');
              done();
            });
          });        
        });
      });
    });
  });
  
  it("updates via songId if there is already a rotationItem", function (done) {
    RotationItem.addSongToBin({ _station: station._id,
                                  _song: song._id,
                                  bin: 'newBin' }, function (err, updatedRotationItem) {
      expect(updatedRotationItem._id.equals(rotationItem.id)).to.equal(true);
      expect(updatedRotationItem.bin).to.equal('newBin');
      expect(updatedRotationItem.history[0].bin).to.equal('trash');
      done();
    });
  });

  it("updates via songId if the song is new to the station", function (done) {
    var newSong = new Song({ artist: 'Rachel Loy',
                      title: 'Broken Machine',
                      album: 'Broken Machine',
                      duration: 180000,
                      key: 'ThisIsAKey.mp3',
                      echonestId: 'ECHONEST_ID' });
    newSong.save(function (err, newSongSaved) {
      RotationItem.addSongToBin({ _station: station._id,
                                _song: newSongSaved._id,
                                bin: 'newBin' }, function (err, updatedRotationItem) {
        expect(updatedRotationItem._song).to.equal(newSongSaved._id);
        expect(updatedRotationItem.bin).to.equal('newBin');
        expect(updatedRotationItem.history.length).to.equal(0);
        done();
      });
    });
  });

  it("can update bin and log it's own history", function (done) {
    var oldDate = rotationItem.assignedAt;
    rotationItem.updateBin('recycle', function (err, updatedItem) {
      expect(updatedItem.bin).to.equal('recycle');
      expect(updatedItem.history[0].bin).to.equal('trash');
      expect(updatedItem.history[0].assignedAt.getTime()).to.equal(oldDate.getTime());
      expect(updatedItem.assignedAt.getTime()).to.be.above(oldDate.getTime());
      done();
    });
  });

  it("does not update if bin is the same", function (done) {
    rotationItem.updateBin('trash', function (err, updatedItem) {
      expect(updatedItem.history.length).to.equal(0);
      done();
    });
  });
});