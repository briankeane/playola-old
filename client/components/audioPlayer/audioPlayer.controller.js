'use strict';

angular.module('playolaApp')
  .controller('AudioPlayerCtrl', function ($rootScope, $scope, $location, Auth, SharedData, AudioPlayer, $timeout) {

    // initialize variables
    $scope.userLoaded = false;
    $scope.initialized = false;
    $scope.initialized = true;
    $scope.SharedData = SharedData;
    $scope.selectedPresetId = '';
    $scope.timeouts = [];
    $scope.rotationItems = [];
    $scope.rotationItemAudioBlockIds = [];
    $scope.player = AudioPlayer;
    $scope.volume;
    $scope.isCollapsed = false;
    $scope.presetButtonInfo = {};

    // set up rotationItemAudioBlockIds array for 'AddSongToStaton' button
    mapRotationItems();

    // make sure player is expanded when station is changed
    $rootScope.$on('stationChanged', function () {
      $scope.isCollapsed = false;
    });

    // set up preset nowPlaying tracking
    // IF they've been loaded...
    if (SharedData.presets) {
      for (var i=0;i<SharedData.presets.length;i++) {
        refreshStationProgram(SharedData.presets[i]);
      }
    } else {   // ELSE wait for them to be loaded, then set up
      $rootScope.$on('presetsLoaded', function () {
        for (var i=0;i<SharedData.presets.length;i++) {
          refreshStationProgram(SharedData.presets[i]);
        }
      });
    }
    
    // adjust models for when nowPlaying changes
    $scope.$watch('player.nowPlaying', function () {
      if (!AudioPlayer.nowPlaying || !AudioPlayer.nowPlaying._audioBlock) {
        $scope.nowPlayingIsInRotation = false;
      } else if (AudioPlayer.nowPlaying._audioBlock._type === 'Song') {
        if ($scope.rotationItemAudioBlockIds.indexOf(AudioPlayer.nowPlaying._audioBlock._id) > -1) {
          $scope.nowPlayingIsInRotation = true;
        } else {
          $scope.nowPlayingIsInRotation = false;
        }
      } else {
        $scope.nowPlayingIsInRotation = false;
      }
    });

    $scope.addToMyStation = function(songId) {
      Auth.createRotationItem({ weight: 17,
                                  bin: 'active',
                                  _song: songId }, function (err, results) {
        SharedData.myRotationItems = results.rotationItems;
        console.log(results);
      });
    };


    $scope.checkForRotation = function (audioBlock) {
      // IF the station has not been started yet, disable
      if (!audioBlock) {
        return false;

      // ELSE IF it's a song, see if it's already been added
      } else if (audioBlock._type === 'Song') {
        return ($scope.rotationItemAudioBlockIds.indexOf(audioBlock._id) > -1);

      // ELSE (It's a commentary or commercial)
      } else {
        return false;
      }
    };
    
    // ***************************************************************************************
    // **************************************** Presets **************************************
    // ***************************************************************************************
    // formats Presets for display in preset option list
    $scope.formatPresetListItem = function (station) {
      if (station.program) {
        return station._user.twitterHandle + ' | Now Playing: ' +
                                              station.program.nowPlaying._audioBlock.title + ' | ' +
                                              (station.program.nowPlaying._audioBlock.artist || '');
      } else {
        return station._user.twitterHandle;
      }
    }
    
    // checks to see if the station is already in the presets
    $scope.isInPresets = function (id) {
      // if presets are not loaded yet
      if (!SharedData.presets) {
        return false;
      }

      if (SharedData.myStation) {
        // if it's the user's own station, return true
        if (id === SharedData.myStation._id) {
          return true;
        }
        
        // check the array
        for (var i=0;i<SharedData.presets.length;i++) {
          // if it's this station or it's included in
          if (SharedData.presets[i]._id === id) {
            return true;
          }
        }
        return false;
      }
    }

    // text/disabled/inPresets
    $rootScope.$on('stationChanged', setPresetButtonInfo);
    
    function setPresetButtonInfo() {
      if (SharedData.myStation) {

        if (SharedData.myStation._id === AudioPlayer.stationPlayingId) {
          $scope.presetButtonInfo =  { text: 'Add Station to Presets',
                                       enabled: false };
        } else if ($scope.isInPresets(AudioPlayer.stationPlayingId)) {
          $scope.presetButtonInfo =  { text: 'Remove From Presets',
                                        inPresets: true,
                                        enabled: true };
        } else {
          $scope.presetButtonInfo =  { text: 'Add Station to Presets',
                                     inPresets: false,
                                      enabled: true };
        }
      }
    }

    // adds or removes a station from the preset list
    $scope.togglePreset = function (station) {
      // if it's already in the presets, take it out
      if ($scope.isInPresets(station._id)) {
        Auth.unfollow(station._id, function (err, result) {
          if (err) {
            // later error handling... put it back in?
          } else {
            setPresetButtonInfo();
          }
        });

        // find the selected in the presets array and remove it
        for (var i=0;i<SharedData.presets.length;i++) {
          if (SharedData.presets[i]._id === station._id) {
            SharedData.presets.splice(i,1);
            setPresetButtonInfo();
            break;
          }
        }

      // otherwise put it in
      } else {

        Auth.follow(station._id, function (err, result) {
          for(var i=0;i<SharedData.presets.length;i++) {
            if (SharedData.presets[i]._id === result.newPreset._id) {
              SharedData.presets[i] = result.newPreset;

              // start tracking nowPlaying
              refreshStationProgram(SharedData.presets[i]);
              setPresetButtonInfo();              
              break;
            }
          }
        });

        // temporarily include it until the response comes back
        var inserted = false;
        for (var i=0;i<SharedData.presets;i++) {
          if (SharedData.presets[i]._user.twitterHandle < station._user.twitterHandle) {
            inserted = true;
            SharedData.presets.splice(i,0,station);
            setPresetButtonInfo();
            break;
          }
        }

        // if it wasn't inserted it should be last
        SharedData.presets.push(station);
      }
    }

    // *******************************************************************
    // ****************** FUNCTION mapRotationItems **********************
    // *******************************************************************
    // * creates an array of rotationItem Ids only for easier searching  *
    // *******************************************************************
    function mapRotationItems() {
      if (SharedData.rotationItems) {
        $scope.rotationItems = SharedData.rotationItems;
        $scope.rotationItemAudioBlockIds = [];
        for (var bin in SharedData.rotationItems) {
          if (SharedData.rotationItems.hasOwnProperty(bin)) {
            for (var i=0;i<SharedData.rotationItems[bin].length;i++) {
              $scope.rotationItemAudioBlockIds.push(SharedData.rotationItems[bin][i]._song._id);
            }
          }
        }
      } else {
        $rootScope.$on('rotationItemsLoaded', mapRotationItems);
      }
    }

    // *******************************************************************
    // ************ FUNCTION refreshStationProgram ***********************
    // *******************************************************************
    // * takes a station object, modifies it by replacing its program    *
    // * with the most current version                                   *
    // *******************************************************************
    function refreshStationProgram(station) {
      Auth.getProgram({ id: station._id }, function (err, program) {
        station.program = program;

        var newTimeout = $timeout(function () {
          refreshStationProgram(station);
        }, new Date(program.nowPlaying.endTime).getTime() - Date.now() + 2000);   // add 2 secs to make sure nowPlaying has actually changed

        $scope.timeouts.push(newTimeout);
      });
    };

    // cancel any pending updates when destroyed
    $scope.$on('destroy', function (event) {
      for (var i=0;i<$scope.timeouts.length;i++) {
        $timeout.cancel($scope.timeouts[i]);
      }
    });

    // if a preset is selected, change to that station
    $scope.$watch(function (scope) { 
      return scope.selectedPresetId 
    }, function (newValue, oldValue) {
      // if it's a new, legit value
      if (newValue) {
        AudioPlayer.loadStation(newValue);
      }
    });

    $scope.getAlbumPicture = function (spin) {
      if (spin && spin._audioBlock) {
        if (spin._audioBlock._type === 'CommercialBlock') {
          return 'http://static.playola.fm/frownFace2.png';
        } else if (spin._audioBlock._type === 'Song') {
          return spin._audioBlock.albumArtworkUrl;
        }
      } else {
        return '';
      }
    }

    $scope.toggleAudioPlayerCollapse = function () {
      if (!Auth.isLoggedIn()) {
        $scope.isCollaped = true;
      } else {
        $scope.isCollapsed = !$scope.isCollapsed; 
      }
    }

  });