var app = require('../../app.js');
var Rules = require('./rules');
var Station = require('../../api/station/station.model');
var AudioBlock = require('../../api/audioBlock/audioBlock.model');
var LogEntry = require('../../api/logEntry/logEntry.model');
var Commentary = require('../../api/commentary/commentary.model');
var RotationItem = require('../../api/rotationItem/rotationItem.model');
var Song = require('../../api/song/song.model');
var Spin = require('../../api/spin/spin.model');
var User = require('../../api/user/user.model');
var Scheduler = require('../scheduler/scheduler');
var expect = require('chai').expect;
var SpecHelper = require('../helpers/specHelper');
var tk = require('timekeeper');
var _ = require('lodash');
var Helper = require('../helpers/helper');

describe('radio rules', function (done) {
  var songs;
  var songToRemove1;
  var songToRemove2;
  var user;
  var station;
  var rotationItems;
  var fullSchedule = [];
  var lightRotationItems;
  var mediumRotationItems;
  var heavyRotationItems;

  beforeEach(function (done) {
    this.timeout(5000);
    SpecHelper.clearDatabase(function() {
      user = new User({ twitter: 'BrianKeaneTunes',
                        twitterUID: '756',
                        email: 'lonesomewhistle@gmail.com',
                        birthYear: 1977,
                        gender: 'male',
                        zipcode: '78748',
                        profileImageUrl: 'http://badass.jpg' });
      station = new Station({ _user: user.id,
                              secsOfCommercialPerHour: 360 });
      station.save(function (err, savedStation) {
        user._station = station.id;
        user.save(function (err, savedUser) {

          songToRemove1 = new Song({ artist: 'removableArtist',
                                       title: 'removableTitle',
                                       duration: 3000 });
          songToRemove2 = new Song({ artist: 'removableArtist',
                                        title: 'removableTitle2',
                                        duration: 4000 });
          SpecHelper.saveAll([songToRemove1, songToRemove2], function (err, removableSongsArray) {


            SpecHelper.loadSongs(101, function (err, songsArray) {
              songs = songsArray;
              
              rotationItems = [];
              for(var i=0;i<50;i++) {
                rotationItems.push(new RotationItem({ _song: songs[i],
                                                      _station: station.id,
                                                      bin: 'light'}));
              }
              for(var i=50;i<80;i++) {
                rotationItems.push(new RotationItem({ _song: songs[i],
                                                      _station: station.id,
                                                      bin: 'medium' }));
              }
              for(var i=80;i<100;i++) {
                rotationItems.push(new RotationItem({ _song: songs[i],
                                                      _station: station.id,
                                                      bin: 'heavy' }));
              }

              SpecHelper.saveAll(rotationItems, function (err, savedRotationItems) {
                RotationItem.findAllForStation(station.id, function (err, gottenRotationItems) {
                  rotationItems = gottenRotationItems;
                  lightRotationItems = _.filter(rotationItems, function (ri) { return ri.bin === 'light' });
                  mediumRotationItems = _.filter(rotationItems, function (ri) { return ri.bin === 'medium' });
                  heavyRotationItems = _.filter(rotationItems, function (ri) { return ri.bin === 'heavy' });

                  tk.freeze(new Date(2014,3,15, 12,46));

                  // make a schedule
                  var timeTracker = new Date(2014,3,14, 11,46);
                  var playlistPositionTracker = 1;

                  // create fullSchedule with just one song not in the lists
                  while (timeTracker < new Date(2014,3,15, 1,46)) {
                    fullSchedule.push({ playlistPosition: playlistPositionTracker,
                                      _audioBlock: songs[100],
                                      _station: station,
                                      airtime: timeTracker,
                                      duration: 240000,
                                      commercialsFollow: false });
                    timeTracker = new Date(timeTracker.getTime() + 240000);
                    playlistPositionTracker += 1;
                  }
                  tk.travel(new Date(2014,3,15, 12,46,01));
                  done();
                })
              });
            });
          });
        });
      });
    });
  });

  it ('removes songs that were played yesterday in the same hour', function (done) {
    // insert the songs yesterday in the same hour
    fullSchedule.unshift({ playlistPosition: 1,
                          _audioBlock: songToRemove1,
                          _station: station,
                          airtime: new Date(2014,3,14, 12,22),
                          durationOffset: 0,
                          commercialsFollow: false,
                          manualEndTime: new Date(2014,3,14 ,12,18) });
    fullSchedule.unshift({ playlistPosition:100,
                           _audioBlock: songToRemove2,
                           _station: station,
                           airtime: new Date(2014,3,14, 13,10),
                           durationOffset: 0,
                           commercialsFollow: false,
                           manualEndTime: new Date(2014,3,14,13,14) });
    // add the removable song to the list
    lightRotationItems.unshift({ _song: songToRemove1,
                                _station: station.id,
                                bin: 'light' });
    lightRotationItems.unshift({ _song: songToRemove2,
                                _station: station.id,
                                bin: 'light' });
    var list = Rules.dayOffset({ airtime: new Date(2014,3,15, 12,46),
                              windowSizeMinutes: 60,
                                 station: station, 
                                 songs: _.map(lightRotationItems, function (ri) { return ri._song }),
                                 schedule: fullSchedule
                                });
    // make sure both were removed
    expect(list.length).to.equal(50);
    expect(list[0].id).to.equal(lightRotationItems[2]._song.id);
    done();
  });

  it ('artist minimum rest', function (done) {
    fullSchedule.push({ playlistPosition:100,
                           _audioBlock: songToRemove1,
                           _station: station,
                           airtime: new Date(2014,3,15, 11,48),
                           durationOffset: 0,
                           commercialsFollow: false,
                           manualEndTime: new Date(2014,3,15,11,52) });
    fullSchedule.push( { playlistPosition:100,
                           _audioBlock: songToRemove2,
                           _station: station,
                           airtime: new Date(2014,3,15, 12,18),
                           durationOffset: 0,
                           commercialsFollow: false,
                           manualEndTime: new Date(2014,3,15, 12,22) });
    lightRotationItems.unshift({ _song: songToRemove1,
                                _station: station.id,
                                bin: 'light' });
    lightRotationItems.unshift({ _song: songToRemove2,
                                _station: station.id,
                                bin: 'light' });
    var list = Rules.artistMinimumRest({ station: station,
                                        airtime: new Date(2014,3,15,12,46),
                                        schedule: fullSchedule,
                                        minutesOfRest: 60,
                                        songs: _.map(lightRotationItems, function (ri) { return ri._song } ) 
                                      });
    expect(list.length).to.equal(50);
    expect(list[0].id).to.equal(lightRotationItems[2]._song.id);
    done();
  });

  it ('song minimum rest', function (done) {
    fullSchedule.push({ playlistPosition:100,
                           _audioBlock: songToRemove1,
                           _station: station,
                           airtime: new Date(2014,3,15, 11,48),
                           durationOffset: 0,
                           commercialsFollow: false,
                           manualEndTime: new Date(2014,3,15,11,52) });
    fullSchedule.push( { playlistPosition:100,
                           _audioBlock: songToRemove2,
                           _station: station,
                           airtime: new Date(2014,3,14, 12,18),
                           durationOffset: 0,
                           commercialsFollow: false,
                           manualEndTime: new Date(2014,3,14, 12,22) });
    lightRotationItems.unshift({ _song: songToRemove1,
                                _station: station.id,
                                bin: 'light' });
    lightRotationItems.unshift({ _song: songToRemove2,
                                _station: station.id,
                                bin: 'light' });
    var list = Rules.songMinimumRest({ airtime: new Date(2014,3,15,12,46),
                                       schedule: fullSchedule,
                                      minutesOfRest: 180,
                                      songs: _.map(lightRotationItems, function (ri) { return ri._song } ) 
                                      });
    expect(list.length).to.equal(51);
    expect(list[0].id).to.equal(songToRemove2.id);
    done();
  });
});