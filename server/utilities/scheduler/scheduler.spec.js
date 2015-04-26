
var app = require('../../app.js');
var Station = require('../../api/station/station.model');
var AudioBlock = require('../../api/audioBlock/audioBlock.model');
var LogEntry = require('../../api/logEntry/logEntry.model');
var Commentary = require('../../api/commentary/commentary.model');
var RotationItem = require('../../api/rotationItem/rotationItem.model');
var Song = require('../../api/song/song.model');
var Spin = require('../../api/spin/spin.model');
var User = require('../../api/user/user.model');
var Scheduler = require('./scheduler');
var expect = require('chai').expect;
var SpecHelper = require('../helpers/specHelper');
var tk = require('timekeeper');
var _ = require('lodash');
var Helper = require('../helpers/helper');

describe('playlist functions', function (done) {
  var songs;
  var station;
  var user;
  var rotationItems;

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
          
          SpecHelper.loadSongs(100, function (err, songsArray) {
            songs = songsArray;
            
            rotationItems = [];
            for(var i=0;i<50;i++) {
              rotationItems.push(new RotationItem({ _song: songs[i].id,
                                                    _station: station.id,
                                                    bin: 'light',
                                                    weight: 45 }));
            }
            for(var i=50;i<80;i++) {
              rotationItems.push(new RotationItem({ _song: songs[i].id,
                                                    _station: station.id,
                                                    bin: 'medium',
                                                    weight: 25 }));
            }
            for(var i=80;i<100;i++) {
              rotationItems.push(new RotationItem({ _song: songs[i].id,
                                                    _station: station.id,
                                                    bin: 'heavy',
                                                    weight: 10 }));
            }

            SpecHelper.saveAll(rotationItems, function (err, savedRotationItems) {
              rotationItems = savedRotationItems;
              tk.freeze(new Date(2014,3,15, 12,46));
              Scheduler.generatePlaylist({ station: station }, function (err, returnedStation) {
                tk.travel(new Date(2014,3,15, 12,46,01));
                done();
              });
            });
          });
        });
      });
    });
  });

  // it('updates the restHistory object from scratch', function (done) {
  //   Scheduler.updateRestHistory(station, function(err, station) {
  //     LogEntry.getMostRecent(station.id, function (err, logEntry) {
  //       expect(station.restHistory.artists[logEntry._audioBlock.artist].getTime()).to.equal(logEntry.airtime.getTime());
  //       expect(station.restHistory.audioBlocks[logEntry._audioBlock.id].getTime()).to.equal(logEntry.airtime.getTime());
  //       expect(station.restHistory.finalPlaylistPosition).to.equal(1);
  //       LogEntry.create({ _station: station.id,
  //                         airtime: new Date(2014,3,20, 12,30),
  //                         _audioBlock: songs[0].id,
  //                         playlistPosition: 1000
  //                       }, function (err, savedLogEntry) {
  //         Scheduler.updateRestHistory(station, function (err, savedStation) {
  //           expect(savedStation.restHistory.finalPlaylistPosition).to.equal(1000);
  //           expect(savedStation.restHistory.audioBlocks[songs[0].id].getTime()).to.equal(new Date(2014,3,20, 12,30).getTime());
  //           expect(savedStation.restHistory.artists[songs[0].artist].getTime()).to.equal(new Date(2014,3,20, 12,30).getTime());
  //           done();
  //         });
  //       });
  //     })
  //   });
  // });
  
  it('generatePlaylist creates a first playlist', function (done) {
    Spin.getFullPlaylist(station.id, function (err, spins) {
      LogEntry.getFullStationLog(station.id, function (err, logEntries) {

        // make sure all logEntry values stored
        expect(logEntries.length).to.equal(1);
        expect(logEntries[0].playlistPosition).to.equal(1);
        expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15, 12,46).getTime());
        expect(logEntries[0]._audioBlock.title).to.exist;
        expect(logEntries[0]._station).to.exist;
        expect(logEntries[0].durationOffset).to.equal(-1000);
        
        // make sure all spin values stored
        expect(spins.length).to.equal(36);
        expect(spins[0].playlistPosition).to.equal(2);
        expect(spins[0].airtime.getTime()).to.equal(new Date(2014,3,15, 12,49).getTime());
        expect(spins[0]._audioBlock.title).to.exist;
        expect(spins[0]._station).to.exist;
        expect(spins[0].durationOffset).to.equal(-1000);
  
        // make sure commercials are in the right place
        expect(spins[0].commercialsFollow).to.equal(false);
        expect(spins[3].commercialsFollow).to.equal(true);
        expect(spins[12].commercialsFollow).to.equal(true);
        expect(spins[21].commercialsFollow).to.equal(true);
        done();
      });
    });
  });
  
  it('updates the lastAccuratePlaylistPosition', function (done) {
    Station.findById(station.id, function (err, foundStation) {
      expect(station.lastAccuratePlaylistPosition).to.equal(37);
      expect(foundStation.lastAccuratePlaylistPosition).to.equal(37);
      done();
    });
  });

  describe('updateAirtimes', function (done) {
    
    it('just returns if there is no playlist', function (done) {
      station2 = new Station({ secsOfCommercialPerHour: 30 });
      station2.save(function (err, savedNewStation) {
        Scheduler.updateAirtimes({ station: savedNewStation }, function (err, station2) {
          expect(err).to.equal(null);
          expect(station2.lastAccuratePlaylistPosition).to.be.an('undefined');
          done();
        });
      });
    });

    it('updates the airtimes', function (done) {
      Spin.getFullPlaylist(station.id, function (err, fullPlaylist) {
        // screw up some airtimes
        for (var i=10; i<fullPlaylist.length; i++) {
          fullPlaylist[i].airtime = new Date(1983,3,15);
        }

        station.lastAccuratePlaylistPosition = fullPlaylist[9].playlistPosition;
        
        // group all objects to be saved and save them
        var toSave = fullPlaylist.slice(10,100);
        toSave.push(station);
        SpecHelper.saveAll(toSave, function (err, savedObjects) {
          // grab the updated station

          station = savedObjects[26];

          Scheduler.updateAirtimes({ station: station }, function (err, returnedStation) {
            Spin.getFullPlaylist(station.id, function (err, fixedPlaylist) {
              expect(fixedPlaylist[22].airtime.getTime()).to.equal(new Date(2014,3,15, 14,04).getTime());
              expect(fixedPlaylist[21].commercialsFollow).to.equal(true);
              expect(fixedPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
              expect(fixedPlaylist[10].airtime.getTime()).to.equal(new Date(2014,3,15, 13,22).getTime());
              expect(fixedPlaylist[11].airtime.getTime()).to.equal(new Date(2014,3,15, 13,25).getTime());
              done();
            });
          });
        });
      });
    });

    it('updates the airtimes if commercial leads in', function (done) {
      Spin.getFullPlaylist(station.id, function (err, fullPlaylist) {
        // screw up some airtimes -- starting with a commercialsFollow=true spin
        for (var i=5; i<fullPlaylist.length; i++) {
          fullPlaylist[i].airtime = new Date(1983,3,15);
        }

        station.lastAccuratePlaylistPosition = fullPlaylist[4].playlistPosition;
        
        // group all objects to be saved and save them
        var toSave = fullPlaylist.slice(10,100);
        toSave.push(station);
        SpecHelper.saveAll(toSave, function (err, savedObjects) {
          // grab the updated station
          station = savedObjects[26];

          Scheduler.updateAirtimes({ station: station }, function (err, returnedStation) {
            Spin.getFullPlaylist(station.id, function (err, fixedPlaylist) {
              expect(fixedPlaylist[22].airtime.getTime()).to.equal(new Date(2014,3,15, 14,04).getTime());
              expect(fixedPlaylist[21].commercialsFollow).to.equal(true);
              expect(fixedPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
              expect(fixedPlaylist[4].airtime.getTime()).to.equal(new Date(2014,3,15, 13,04).getTime());
              expect(fixedPlaylist[5].airtime.getTime()).to.equal(new Date(2014,3,15, 13,07).getTime());
              done();
            });
          });
        });
      });
    });

    it('updates the airtimes if only the log is correct', function (done) {
      Spin.getFullPlaylist(station.id, function (err, fullPlaylist) {
        // screw up some airtimes -- starting with a commercialsFollow=true spin
        for (var i=0; i<fullPlaylist.length; i++) {
          fullPlaylist[i].airtime = new Date(1983,3,15);
        }

        station.lastAccuratePlaylistPosition = fullPlaylist[4].playlistPosition;
        
        // group all objects to be saved and save them
        var toSave = fullPlaylist.slice(10,100);
        toSave.push(station);
        SpecHelper.saveAll(toSave, function (err, savedObjects) {
          // grab the updated station
          station = savedObjects[26];

          Scheduler.updateAirtimes({ station: station }, function (err, returnedStation) {
            Spin.getFullPlaylist(station.id, function (err, fixedPlaylist) {
              expect(fixedPlaylist[22].airtime.getTime()).to.equal(new Date(2014,3,15, 14,04).getTime());
              expect(fixedPlaylist[21].commercialsFollow).to.equal(true);
              expect(fixedPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
              expect(fixedPlaylist[4].airtime.getTime()).to.equal(new Date(2014,3,15, 13,04).getTime());
              expect(fixedPlaylist[5].airtime.getTime()).to.equal(new Date(2014,3,15, 13,07).getTime());
              done();
            });
          });
        });
      });
    });

  it('updates the airtimes starting from the log, commercialsFollow is true', function (done) {
      Spin.getFullPlaylist(station.id, function (err, fullPlaylist) {
        // screw up some airtimes -- starting with a commercialsFollow=true spin
        for (var i=0; i<fullPlaylist.length; i++) {
          fullPlaylist[i].airtime = new Date(1983,3,15);
        }

        LogEntry.getEntryByPlaylistPosition({ _station: station.id,
                                              playlistPosition: 1
                                            }, function (err, logEntry) {

          logEntry.airtime = new Date(2014,3,15, 12,58);
          logEntry.commercialsFollow = true;
          station.lastAccuratePlaylistPosition = logEntry.playlistPosition;
          
          // group all objects to be saved and save them
          var toSave = fullPlaylist.slice(10,100);
          toSave.push(station);
          toSave.push(logEntry);
          SpecHelper.saveAll(toSave, function (err, savedObjects) {
            // grab the updated station
            station = savedObjects[26];

            Scheduler.updateAirtimes({ station: station }, function (err, returnedStation) {
              Spin.getFullPlaylist(station.id, function (err, fixedPlaylist) {
                expect(fixedPlaylist[22].airtime.getTime()).to.equal(new Date(2014,3,15, 14,16).getTime());
                expect(fixedPlaylist[8].commercialsFollow).to.equal(true);
                expect(fixedPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,55).getTime());
                expect(fixedPlaylist[4].airtime.getTime()).to.equal(new Date(2014,3,15, 13,16).getTime());
                expect(fixedPlaylist[5].airtime.getTime()).to.equal(new Date(2014,3,15, 13,19).getTime());
                done();
              });
            });
          });
        });
      });
    });
  });
  
  it('does not extend the playlist past 24hrs', function (done) {
    Scheduler.generatePlaylist({ station: station,
                                playlistEndTime: new Date(2014,3,25, 16,46)
                              }, function (err, updatedStation) {
      Spin.getFullPlaylist(station.id, function (err, newPlaylist) {
        expect(newPlaylist.length).to.equal(432)
        expect(newPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
        expect(newPlaylist[35].airtime.getTime()).to.equal(new Date(2014,3,15, 14,46).getTime());
        done();
      })
    });
  });

  it('extends the playlist 4 hours', function (done) {
    Scheduler.generatePlaylist({ station: station,
                                playlistEndTime: new Date(2014,3,15, 16,46)
                              }, function (err, updatedStation) {
      Spin.getFullPlaylist(station.id, function (err, newPlaylist) {
        expect(newPlaylist.length).to.equal(72)
        expect(newPlaylist[71].airtime.getTime()).to.equal(new Date(2014,3,15, 16,46).getTime());
        expect(newPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
        expect(newPlaylist[35].airtime.getTime()).to.equal(new Date(2014,3,15, 14,46).getTime());
        done();
      });
    });
  });

  it('extends the playlist if a commercial leads in', function (done) {
    // remove enough for a commercialsFollow spin to be last
    Spin.find({ _station: station.id, playlistPosition: { $gte: 34 } }).remove().exec(function (err, removedSpins) {

      Scheduler.generatePlaylist({ station: station,
                                  playlistEndTime: new Date(2014,3,15, 16,46)
                                }, function (err, updatedStation) {
        Spin.getFullPlaylist(station.id, function (err, newPlaylist) {
          expect(newPlaylist.length).to.equal(72)
          expect(newPlaylist[71].airtime.getTime()).to.equal(new Date(2014,3,15, 16,46).getTime());
          expect(newPlaylist[34].airtime.getTime()).to.equal(new Date(2014,3,15, 14,43).getTime());
          expect(newPlaylist[35].airtime.getTime()).to.equal(new Date(2014,3,15, 14,46).getTime());
          done();
        });
      });
    });
  });

  it('brings the station current', function (done) {
    //tk.reset();
    tk.freeze(new Date(2014,3,15, 14,05));
    Scheduler.bringCurrent(station, function (err) {
      Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {
        LogEntry.getFullStationLog(station.id, function (err, logEntries) {
          
          expect(currentPlaylist[0].airtime.getTime()).to.equal(new Date(2014,3,15, 14,07).getTime());
          expect(currentPlaylist[0].playlistPosition).to.equal(25);
          expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15,14,04).getTime());
          expect(logEntries.length).to.equal(24);
          expect(logEntries[0].commercialsFollow).to.equal(false);
          done();
        });
      }); 
    });
  });

  it('brings the station current if a spin with commercialsFollow=true leads in', function (done) {
    tk.freeze(new Date(2014,3,15, 14,30));
    Scheduler.bringCurrent(station, function (err) {
      tk.freeze(new Date(2014,3,15, 15,11));
      Scheduler.bringCurrent(station, function (err) {
        LogEntry.getFullStationLog(station.id, function (err, logEntries) {
          Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {
            expect(currentPlaylist[0].playlistPosition).to.equal(45);
            expect(currentPlaylist[0].airtime.getTime()).to.equal(new Date(2014,3,15, 15,13).getTime());
            expect(logEntries[0].playlistPosition).to.equal(44);
            expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15, 15,10).getTime());
            done();
          });
        });
      });
    });
  });

  it('brings the station current if a commercialBlock leads in', function (done) {
    tk.freeze(new Date(2014,3,15, 14,32));
    Scheduler.bringCurrent(station, function (err) {
      tk.freeze(new Date(2014,3,15, 15,11));
      Scheduler.bringCurrent(station, function (err) {
        LogEntry.getFullStationLog(station.id, function (err, logEntries) {
          Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {
            expect(currentPlaylist[0].playlistPosition).to.equal(45);
            expect(currentPlaylist[0].airtime.getTime()).to.equal(new Date(2014,3,15, 15,13).getTime());
            expect(logEntries[0].playlistPosition).to.equal(44);
            expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15, 15,10).getTime());
            done();
          });
        });
      });
    });
  });

  it ('gets the full schedule -- played and not played', function (done) {
    tk.freeze(new Date(2014,3,15, 14,32));
    Scheduler.bringCurrent(station, function (err) {
      tk.freeze(new Date(2014,3,15, 15,11));
      Scheduler.bringCurrent(station, function (err) {
        Scheduler.getFullSchedule({ station: station }, function (err, fullSchedule) {
          expect(fullSchedule.length).to.equal(81);
          expect(fullSchedule[0].playlistPosition).to.equal(1);
          
          done();
        });
      });
    });
  });

  it('brings the station current if a commercialBlock should be nowPlaying', function (done) {
    tk.freeze(new Date(2014,3,15, 13,32));
    Scheduler.bringCurrent(station, function (err) {
      LogEntry.getFullStationLog(station.id, function (err, logEntries) {
        Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {
          expect(currentPlaylist[0].playlistPosition).to.equal(15);
          expect(currentPlaylist[0].airtime.getTime()).to.equal(new Date(2014,3,15, 13,34).getTime());
          expect(logEntries[0].playlistPosition).to.equal(14);
          expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15, 13,28).getTime());
          expect(logEntries[0].commercialsFollow).to.equal(true);
          done();
        });
      });
    });
  });

  it('brings the station current if nowPlaying precedes a commercialBlock', function (done) {
    tk.freeze(new Date(2014,3,15, 13,30));
    Scheduler.bringCurrent(station, function (err) {
      LogEntry.getFullStationLog(station.id, function (err, logEntries) {
        Spin.getFullPlaylist(station.id, function (err, currentPlaylist) {
          var logMap = _.map(logEntries, function (spin) { return { playlistPosition: spin.playlistPosition,
                                                  airtime: spin.airtime } });
          var spinMap = _.map(currentPlaylist, function (spin) { return { playlistPosition: spin.playlistPosition,
                                                  airtime: spin.airtime } });

          expect(currentPlaylist[0].playlistPosition).to.equal(15);
          expect(currentPlaylist[0].airtime.getTime()).to.equal(new Date(2014,3,15, 13,34).getTime());
          expect(logEntries[0].playlistPosition).to.equal(14);
          expect(logEntries[0].airtime.getTime()).to.equal(new Date(2014,3,15, 13,28).getTime());
          expect(logEntries[0]._audioBlock._type).to.equal('Song');
          expect(logEntries[0].commercialsFollow).to.equal(true);

          done();
        });
      });
    });
  });

  xit('brings the station current if nowPlaying follows a commercialBlock', function (done) {
    
  });

  xit('getProgram gets a program', function (done) {
  });




  xit('getCommercialBlock tests', function (done) {
  });

  after(function (done) {
    tk.reset();
    done();
  });
});

describe('moving spin tests', function (done) {
  var spins;
  var user;
  var station;

  beforeEach(function (done) {
    user = new User({ twitter: 'BrianKeaneTunes',
                      twitterUID: '756',
                      email: 'lonesomewhistle@gmail.com',
                      birthYear: 1977,
                      gender: 'male',
                      zipcode: '78748',
                      profileImageUrl: 'http://badass.jpg' });
    station = new Station({ _user: user.id,
                          lastAccuratePlaylistPosition: 1,
                            secsOfCommercialPerHour: 360 });
    station.save(function (err, savedStation) {

      song = new Song({ duration: 180000 })
      song.save(function (err, newSong) {

        var modelsToSave = [];
        var timeTracker = new Date(1983, 3, 15, 12);

        // 1 log entry
        modelsToSave.push( new LogEntry({ _station: station.id,
                                          _audioBlock: song.id,
                                          airtime: timeTracker,
                                          duration: 180000,
                                          playlistPosition: 1 }));


        for (var i=2;i<22;i++) {
          timeTracker = new Date(timeTracker.getTime() + 180000);
          modelsToSave.push(new Spin({ _station: station.id,
                                _audioBlock: song.id,
                                playlistPosition: i,
                                duration: 180000,
                                airtime: timeTracker }));
        }
        Helper.saveAll(modelsToSave, function (err, models) {
          Scheduler.updateAirtimes({ station: station }, function (err, updatedStation) {
            done();
          });
        });
      });
    });
  });
  
  it('moves a spin earlier', function (done) {
    Spin.getFullPlaylist(station.id, function (err, beforePlaylist) {
      var beforePlaylistIds = _.map(beforePlaylist, function (spin) { return spin.id });
      var beforePlaylistPositions = _.map(beforePlaylist, function (spin) { return spin.playlistPosition });
      Scheduler.moveSpin({ spinId: beforePlaylist[10].id, newPlaylistPosition: 4 
                        }, function (err, attrs) {
        Spin.getFullPlaylist(station.id, function (err, afterPlaylist) {
          
          // unadjusted front spins
          expect(afterPlaylist[0].id).to.equal(beforePlaylist[0].id);
          expect(afterPlaylist[1].id).to.equal(beforePlaylist[1].id);

          //moved spin
          expect(afterPlaylist[2].id).to.equal(beforePlaylist[10].id);

          // adjusted spins
          for (var i=3;i<=10;i++) {
            expect(afterPlaylist[i].id).to.equal(beforePlaylistIds[i-1]);
          }

          // unadjusted after spins
          for(var i=11;i<afterPlaylist.length;i++) {
            expect(afterPlaylist[i].id).to.equal(beforePlaylist[i].id);
          }

          // playlistPositions
          for (var i=0;i<afterPlaylist.length;i++) {
            expect(afterPlaylist[i].playlistPosition).to.equal(i+2);
          }
          done();
        });
      });
    });
  });

  it('moves a spin later', function (done) {
    Spin.getFullPlaylist(station.id, function (err, beforePlaylist) {
      var beforePlaylistIds = _.map(beforePlaylist, function (spin) { return spin.id });
      var beforePlaylistPositions = _.map(beforePlaylist, function (spin) { return spin.playlistPosition });
      Scheduler.moveSpin({ spinId: beforePlaylist[2].id, newPlaylistPosition: 12
                        }, function (err, attrs) {
        Spin.getFullPlaylist(station.id, function (err, afterPlaylist) {
          
          // unadjusted front spins
          expect(afterPlaylist[0].id).to.equal(beforePlaylist[0].id);
          expect(afterPlaylist[1].id).to.equal(beforePlaylist[1].id);

          //moved spin
          expect(afterPlaylist[10].id).to.equal(beforePlaylist[2].id);

          // adjusted spins
          for (var i=2;i<=9;i++) {
            expect(afterPlaylist[i].id).to.equal(beforePlaylistIds[i+1]);
          }

          // unadjusted after spins
          for(var i=11;i<afterPlaylist.length;i++) {
            expect(afterPlaylist[i].id).to.equal(beforePlaylist[i].id);
          }

          // playlistPositions all in the right order
          expect(afterPlaylist[0].playlistPosition).to.equal(2);

          for (var i=0;i<afterPlaylist.length;i++) {
            expect(afterPlaylist[i].playlistPosition).to.equal(i+2);
          }
          done();
        });
      });
    });
  });
  
  it('insertSpin tests', function (done) {
    var songToInsert = new Song({ duration: 1000 });
      songToInsert.save(function (err) {
        Spin.getFullPlaylist(station.id, function (err, beforePlaylist) {
          var beforePlaylistIds = _.map(beforePlaylist, function (spin) { return spin.id });
          var beforePlaylistPositions = _.map(beforePlaylist, function (spin) { return spin.playlistPosition });
          Scheduler.insertSpin({ playlistPosition: 4,
                                  _station: station.id,
                                  _audioBlock: songToInsert.id
                                }, function (err, updatedStation) {
          Spin.getFullPlaylist(station.id, function (err, afterPlaylist) {
            expect(afterPlaylist.length).to.equal(beforePlaylist.length + 1);

            // unadjusted front spins
            expect(afterPlaylist[0].id).to.equal(beforePlaylistIds[0]);
            expect(afterPlaylist[1].id).to.equal(beforePlaylistIds[1]);

            // inserted spin
            expect(afterPlaylist[2]._audioBlock.id).to.equal(songToInsert.id);

            // adjusted spins
            for (var i=3; i<beforePlaylistIds.length; i++) {
              expect(beforePlaylist[i].id).to.equal(afterPlaylist[i+1].id);
            }
            done();
          });
        });
      });
    });
  });

  it('calls bullshit if spin is located in the same position', function (done) {
    Spin.getFullPlaylist(station.id, function (err, beforePlaylist) {
      Scheduler.moveSpin({ spinId: beforePlaylist[2].id, newPlaylistPosition: 4 }, function (err, attrs) {
        expect(err.message).to.equal('Spin is already at the requested playlistPosition');
        Spin.getFullPlaylist(station.id, function (err, newPlaylist) {
          for(var i=0;i<newPlaylist.length;i++) {
            expect(newPlaylist[i].id).to.equal(beforePlaylist[i].id);
            expect(newPlaylist[i].playlistPosition).to.equal(beforePlaylist[i].playlistPosition);
          }
          done();
        });
      });
    });
  });
});

describe('addScheduleTimeToSpin', function (done) {
  var songSpin1;
  var songSpin2;
  var songWithCommercialAfterSpin;
  var commentarySpinLong;
  var commentarySpinShort;
  var station;
  var unmarkedSongSpin;

  beforeEach(function (done) {
    station = new Station({ secsOfCommercialPerHour: 360 });
    station.save(function(err) {

      song1 = new Song({ duration: 60000,
                         eoi: 5000,
                         boo: 50000,
                         eom: 58000 });
      song2 = new Song({  duration: 70000,
                          eoi: 6000,
                          boo: 66000,
                          eom: 69000 });
      commentaryLong = new Commentary({ duration: 70000})
      commentaryShort = new Commentary({ duration: 6000 });

      Helper.saveAll([song1, song2, commentaryLong, commentaryShort], function (err, savedSongs) {
        songSpin1 = {  _audioBlock: song1,
                                airtime: new Date(2014,3,15, 12,10),
                                playlistPosition: 5,
                                _station: station };
        songSpin2 = {  _audioBlock: song2,
                                airtime: new Date(2014,3,15, 12,13),
                                playlistPosition: 6,
                                _station: station };
        commentarySpinLong = {  _audioBlock: commentaryLong, 
                                      airtime: new Date(2014,3,15,12,14),
                                      playlistPosition: 7,
                                      _station: station };
        commentarySpinShort = { _audioBlock: commentaryShort,
                                airtime: new Date(2014,3,15, 12,20),
                                playlistPosition: 8,
                                _station: station }
        commercialsFollowSpin = { _audioBlock: song1,
                                  airtime: new Date(2014,3,15, 11,59,30),
                                  playlistPosition: 8,
                                  commercialsFollow: true,
                                  _station: station }

        done();
      });
    });
  });

  it('works for song/song', function (done) {
    Scheduler.addScheduleTimeToSpin(station, songSpin1, songSpin2);
    expect(new Date(songSpin1.manualEndTime).getTime()).to.equal(new Date(2014,3,15, 12,10,58).getTime());
    expect(new Date(songSpin2.airtime).getTime()).to.equal(new Date(2014,3,15, 12,10,58).getTime());
    done();
  });

  it('works for song/commentary-long', function (done) {
    Scheduler.addScheduleTimeToSpin(station, songSpin1, commentarySpinLong);
    expect(new Date(songSpin1.manualEndTime).getTime()).to.equal(new Date(2014,3,15, 12,10,50).getTime());
    expect(new Date(commentarySpinLong.airtime).getTime()).to.equal(new Date(2014,3,15, 12,10,50).getTime());
    done();
  });

  it('works for song/commentary-short', function (done) {
    Scheduler.addScheduleTimeToSpin(station, songSpin1, commentarySpinShort);
    expect(new Date(songSpin1.manualEndTime).getTime()).to.equal(new Date(2014,3,15, 12,10,58).getTime());
    expect(new Date(commentarySpinShort.airtime).getTime()).to.equal(new Date(2014,3,15, 12,10,58).getTime());
    done();
  });

  it('works for commentary/commentary', function (done) {
    Scheduler.addScheduleTimeToSpin(station, commentarySpinLong, commentarySpinShort);
    expect(commentarySpinShort.airtime.getTime()).to.equal(new Date(2014,3,15, 12,15,10).getTime());
    done();
  });

  it('works for commentary-short/song', function (done) {
    Scheduler.addScheduleTimeToSpin(station, commentarySpinShort, songSpin1);
    expect(new Date(commentarySpinShort.manualEndTime).getTime()).to.equal(new Date(2014,3,15, 12,20,1).getTime());
    expect(new Date(songSpin1.airtime).getTime()).to.equal(new Date(2014,3,15, 12,20,1).getTime());
    done();
  });

  it('works for commentary-long/song', function (done) {
    commentarySpinLong.previousSpinOverlap = 8000;
    Scheduler.addScheduleTimeToSpin(station, commentarySpinLong, songSpin1);
    expect(new Date(songSpin1.airtime).getTime()).to.equal(new Date(2014,3,15, 12,15,5).getTime());
    expect(new Date(commentarySpinLong.manualEndTime).getTime()).to.equal(new Date(2014,3,15, 12,15,5).getTime());
    done();
  });

  it('works for commercialsFollow/song', function (done) {
    Scheduler.addScheduleTimeToSpin(station, commercialsFollowSpin, songSpin1);
    expect(songSpin1.airtime.getTime()).to.equal(new Date(2014,3,15, 12,3,28).getTime());
    done();
  });

  it('works for saved spin objects', function (done) {
    actualSpin1 = new Spin(songSpin1);
    actualSpin2 = new Spin(songSpin2);
    Helper.saveAll([actualSpin1, actualSpin2], function (err, spins) {
      Spin.getFullPlaylist(station.id, function (err, playlist) {
        Scheduler.addScheduleTimeToSpin(station, playlist[0], playlist[1]);
        expect(new Date(playlist[1].airtime).getTime()).to.equal(new Date(2014,3,15, 12,10,58).getTime());
        done();
      });
    });
  });

  it('works for unmarked song', function (done) {
    songSpin1._audioBlock = { _type: 'Song',
                              duration: 60000 }
    Scheduler.addScheduleTimeToSpin(station, songSpin1, songSpin2);
    expect(songSpin2.airtime.getTime()).to.equal(new Date(2014,3,15,12,10,59).getTime());
    done();
  });
});


