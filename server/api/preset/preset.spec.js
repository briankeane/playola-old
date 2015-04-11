'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var expect = require('chai').expect;
var Preset = require('./preset.model');
var User = require('../user/user.model');
var Station = require('../station/station.model');
var SpecHelper = require('../../utilities/helpers/specHelper');


describe('Presets', function() {
  var users = [];
  var stations = [];
  var preset1;
  var preset2;
  var preset3;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {
      users = [];
      stations = [];

      users.push(new User({ twitterHandle: 'Bob' }));
      users.push(new User({ twitterHandle: 'Cindy' }));
      users.push(new User({ twitterHandle: 'SamJackson' }));
      users.push(new User({ twitterHandle: 'JohnTravolta' }));

      SpecHelper.saveAll(users, function (err, savedUsers) {
        for(var i=0; i<4; i++) {
          stations.push(new Station({ _user: users[i]._id }));
        }

        SpecHelper.saveAll(stations, function (err, savedStations)   {

          preset1 = new Preset({ _user: users[1]._id, _station: stations[0]._id });
          preset2 = new Preset({ _user: users[2]._id, _station: stations[0]._id });
          preset3 = new Preset({ _user: users[2]._id, _station: stations[3]._id });

          SpecHelper.saveAll([preset1, preset2, preset3], function (err, savedPresets) {
            done();
          });
        });
      });
    });
  });

  it('returns a list of followers in order by twitterHandle', function (done) {
    Preset.getFollowers(stations[0]._id, function (err, followers) {
      expect(followers.length).to.equal(2);
      expect(followers[0].twitterHandle).to.equal('Cindy');
      expect(followers[1].twitterHandle).to.equal('SamJackson');
      done();
    });
  });

  it('returns a list of presets for a user', function (done) {
    Preset.getPresets(users[2]._id, function (err, presets) {
      expect(presets.length).to.equal(2);
      expect(presets[0]._user.twitterHandle).to.equal('Bob');
      expect(presets[1]._user.twitterHandle).to.equal('JohnTravolta');
      done();
    })
  })
});