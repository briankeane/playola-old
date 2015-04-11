'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');

describe('GET /api/listeningSessions', function() {

  xit('should respond with JSON array', function(done) {
    request(app)
      .get('/api/listeningSessions')
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        if (err) return done(err);
        res.body.should.be.instanceof(Array);
        done();
      });
  });

  xit('test update listeningSessions', function (done) {

  });

  xit('test create listeningSessions', function (done) {

  });
});