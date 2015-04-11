//'use strict';

var should = require('should');
var app = require('../../app');
var request = require('supertest');
var CommercialBlock = require('./commercialBlock.model');
var expect = require('chai').expect;
var SpecHelper = require('../../utilities/helpers/specHelper');

describe('GET /api/v1/commercialBlocks', function() {

  it('should respond with JSON array', function(done) {
    request(app)
      .get('/api/v1/commercialBlocks')
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        if (err) return done(err);
        res.body.should.be.instanceof(Array);
        done();
      });
  });
});


describe('a commercialBlock', function (done) { 
  var commercialBlock;

  beforeEach(function (done) {
    SpecHelper.clearDatabase(function() {
      commercialBlock = new CommercialBlock({ duration: 360 });

      commercialBlock.save(function (err, savedCommercialBlock) {
        done();
      });
    });
  });

  it("is created with id, key, duration, and populatable station", function (done) {
    CommercialBlock.findById(commercialBlock.id)
    .exec(function (err, foundCommercialBlock) {
      expect(foundCommercialBlock.duration).to.equal(360);
      done();
    });
  });

  it("can be updated", function (done) {
    CommercialBlock.findByIdAndUpdate(commercialBlock.id, { $set: { duration: 200 } 
    }, function (err, updatedCommercialBlock) {
      expect(updatedCommercialBlock.duration).to.equal(200);
      done();
    });
  });
});