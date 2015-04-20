var should = require('should');
var app = require('../../app');
var request = require('supertest');
var SpecHelper = require('../helpers/specHelper');
var TimezoneFinder = require('./timezoneFinder');
var expect = require('chai').expect;

describe('timezoneFinder', function (done) {
  this.timeout(10000);
  it('returns a correct timezone', function (done) {
    TimezoneFinder.findByZip('78704', function (err, timezone) {
      expect(timezone).to.equal('America/Chicago')
      TimezoneFinder.findByZip('90027', function (err, timezone) {
        expect(timezone).to.equal('America/Los_Angeles');
        TimezoneFinder.findByZip('80012', function (err, timezone) {
          expect(timezone).to.equal('America/Denver');
          TimezoneFinder.findByZip('02215', function (err, timezone) {
            expect(timezone).to.equal('America/New_York');
            done();
          });
        });
      });
    });
  });

  it('calls bullshit if timezone does not exist', function (done) {
    TimezoneFinder.findByZip('99999', function(err, timezone) {
      expect(timezone).to.equal(null);
      expect(err.message).to.equal('Zipcode not found');
      done();
    })
  })
});