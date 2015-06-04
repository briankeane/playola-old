//'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var User = require('../user/user.model');
var Song = require('../song/song.model');
var Station = require('../station/station.model');
var expect = require('chai').expect;
var async = require('async');
var SpecHelper = require('../../utilities/helpers/specHelper');
var ListeningSession = require('../listeningSession/listeningSession.model');
var tk = require('timekeeper');


describe('a station', function () {
  var song;
  var user;
  var station;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {

      user = new User({ twitterHandle: 'BrianKeaneTunes',
                          twitterUID: '756',
                          email: 'lonesomewhistle@gmail.com',
                          birthYear: 1977,
                          gender: 'male',
                          profileImageUrl: 'http://badass.jpg' });

      station = new Station ({ _user: user.id,
                              timezone: 'US Central Time',
                               secsOfCommercialPerHour: 3 }) 


      SpecHelper.saveAll([user, station], function (err, objects) {
        done();
      });
    });
  });

  it ('is created', function (done) {
    expect(station.id).to.not.equal(null);
    expect(station.secsOfCommercialPerHour).to.equal(3);
    expect(station.timezone).to.equal('US Central Time');
    expect(station._user.equals(user._id)).to.equal(true);
    done();
  });

  it ('can be updated', function (done) {
    user2 = new User ({ twitterHandle: 'bla' });
    user2.save(function (err, savedUser) {
      Station.findByIdAndUpdate(station.id, { $set: { _user: user2.id, 
                                                    secsOfCommercialPerHour: 10,
                                                    timezone: 'UK Central Time' } },
                                  function (err, updatedStation) {
        expect(updatedStation.secsOfCommercialPerHour).to.equal(10)
        expect(updatedStation._user.equals(user2.id)).to.equal(true);
        expect(updatedStation.timezone).to.equal('UK Central Time');
        done();
      });
      
    })
  });

  it('gets a clock', function (done) {
    var clock = station.getClock();
    expect(clock.items.length).to.equal(22);
    expect(clock.syncs.length).to.equal(1);
    expect(clock.end).to.equal(60*60);
    done();
  });

  xit ('returns a genre hash', function (done) {

  });
});


describe('station rankings', function (done) {
  var stations = [];
  var listeningSessions = [];
  
  before(function (done) {


    tk.freeze(new Date(2000,3,16, 12,30));
    for(var i=0;i<5;i++) {
      stations.push(new Station({ dailyListenTimeCalculationDate: new Date() }));
    }

    SpecHelper.saveAll(stations, function (err, savedStations) {
      listeningSessions.push(new ListeningSession({ _station: stations[0]._id,
                                                    startTime: new Date(2000, 3, 15, 13),
                                                    endTime: new Date(2000, 3, 15, 14) }));
      listeningSessions.push(new ListeningSession({ _station: stations[0]._id,
                                                    startTime: new Date(2000, 3, 15, 13),
                                                    endTime: new Date(2000, 3, 15, 14) }));
      listeningSessions.push(new ListeningSession({ _station: stations[1]._id,
                                                    startTime: new Date(2000, 3, 15, 13),
                                                    endTime: new Date(2000, 3, 15, 16) }));
      listeningSessions.push(new ListeningSession({ _station: stations[2]._id,
                                                    startTime: new Date(2000, 3, 15, 13),
                                                    endTime: new Date(2000, 3, 15, 13, 30) }));
      listeningSessions.push(new ListeningSession({ _station: stations[3]._id,
                                                    startTime: new Date(2000, 3, 15, 13),
                                                    endTime: new Date(2000, 3, 15, 13, 1) }));
      SpecHelper.saveAll(listeningSessions, function (err, savedListeningSessions) {
        done();
      });
    });
  });
    
  it('returns a list of stations in order of most listened to', function (done) {
    tk.travel(new Date(2000,3,16,12));
    Station.listByRank({}, function (err, stationList) {
      expect(stationList[0]._id.equals(stations[1]._id)).to.equal(true);
      // TODO, test for calculation date
      expect(stationList[0].dailyListenTimeMS).to.equal(10800000);
      expect(stationList[1]._id.equals(stations[0]._id)).to.equal(true);
      expect(stationList[1].dailyListenTimeMS).to.equal(7200000);
      expect(stationList[2]._id.equals(stations[2]._id)).to.equal(true);
      done();
    });
  });

  after(function (done) {
    tk.reset();
    done();
  });
});

describe ('make_log_current', function () {

  xit ('gets the average number of listeners', function (done) {

  });
});