'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var Thing = require('./thing.model');

describe('GET /api/things', function() {
  Thing.create({}, function (err, thingy) {


    it('should respond with JSON array', function(done) {
      request(app)
        .get('/api/things')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) return done(err);
          res.body.should.be.instanceof(Array);
          done();
        });
    });
  })
});