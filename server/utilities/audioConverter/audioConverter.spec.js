var fs = require('fs');
var child = require('child_process');
var app = require('../../app');
var request = require('supertest');
var SpecHelper = require('../helpers/specHelper');
var expect = require('chai').expect;
var converter = require('./audioConverter');
var taglib = require('taglib');

var testFilesArray = [];

describe('AudioConverter', function (done) {
  
  before(function (done) {
    var finishedCount = 0;
    

    // copy the file from test folder to unprocessedAudio folder
    var readpath = process.cwd() + '/server/data/testFiles/lonestarTest.m4a';
    var writepath = process.cwd() + '/server/data/unprocessedAudio/lonestarTest.m4a';
    var read = fs.createReadStream(readpath)
    var write = fs.createWriteStream(writepath);
    testFilesArray.push(process.cwd() + '/server/data/processedAudio/lonestarTest.mp3');
    testFilesArray.push(writepath);
    read.pipe(write)
    .on('finish', function () {
      finishedOperation();
    });


    var readpath2 = process.cwd() + '/server/data/testFiles/stepladderTest.wav';
    var writepath2 = process.cwd() + '/server/data/unprocessedAudio/stepladderTest.wav';
    var read2 = fs.createReadStream(readpath2);
    var write2 = fs.createWriteStream(writepath2);
    testFilesArray.push(process.cwd() + '/server/data/processedAudio/stepladderTest.mp3');
    testFilesArray.push(writepath2);
    read2.pipe(write2)
    .on('finish', function () {
      finishedOperation();
    });

    var readpath3 = process.cwd() + '/server/data/testFiles/downtown.m4p';
    var writepath3 = process.cwd() + '/server/data/unprocessedAudio/downtown.m4p';
    var read3 = fs.createReadStream(readpath3)
    var write3 = fs.createWriteStream(writepath3);
    testFilesArray.push(process.cwd() + '/server/data/processedAudio/downtown.mp3');
    testFilesArray.push(writepath3);
    read3.pipe(write3)
    .on('finish', function () {
      finishedOperation();
    });

    function finishedOperation () {
      finishedCount++;

      if (finishedCount >= 3) {
        done();
      }
    }
  });

  it('converts an m4a file', function (done) {
    this.timeout(15000);

    converter.convertFile(process.cwd() + '/server/data/unprocessedAudio/lonestarTest.m4a', function (err, filepath) {
    if (err) { console.log(err); }
      expect(fs.existsSync(filepath)).to.equal(true);
      var tag = taglib.tagSync(filepath);
      expect(tag.artist).to.equal('Delbert McClinton');
      expect(tag.album).to.equal('Room to Breathe');
      expect(tag.title).to.equal('Lone Star Blues');
      done();
    });
  });

  it('converts a wav file', function (done) {
    this.timeout(15000);
    converter.convertFile(process.cwd() + '/server/data/unprocessedAudio/stepladderTest.wav', function (err, filepath) {
      if (err) { console.log(err); }
      var tag = taglib.tagSync(filepath);
      expect(tag.artist).to.equal('Rachel Loy');
      expect(tag.album).to.equal('Broken Machine');
      expect(tag.title).to.equal('Stepladder');
      done();
    });
  });

  it('does not convert a protected file', function (done) {
    this.timeout(5000);
    converter.convertFile(process.cwd() + '/server/data/unprocessedAudio/downtown.m4p', function (err, filepath) {
      expect(err.message).to.equal('File is Copy-Protected');
      done();
    });
  });

  after(function (done) {
    for (var i=0;i<testFilesArray.length;i++) {
      try {
        fs.unlinkSync(testFilesArray[i]);
      } catch (e) {
        // just in case it doesn't exist
      }
    }
    done();
  });
});