'use strict';

angular.module('playolaApp')
  .controller('AudioPlayerCtrl', function ($rootScope, $scope, $location, Auth, SharedData, AudioPlayer, $timeout) {

    $scope.test = 'thisisatest, mf'
    // initialize variables
    $scope.userLoaded = false;
    $scope.initialized = false;
    $scope.presets;
    $scope.initialized = true;
    $scope.presets = SharedData.presets;
    $scope.selectedPresetId = '';
    $scope.timeouts = [];
    $scope.rotationItems = [];
    $scope.rotationItemAudioBlockIds = [];
    $scope.player = AudioPlayer;
    $scope.volume;
    $scope.isCollapsed = false;


    // event-driven functions
    $rootScope.$on('loggedIn', function () {
      // grab currenStation
      $scope.currentStation = Auth.getCurrentStation();
      
      $timeout(getRotationItems, 2000);
      
      // grab the current user
      $scope.currentUser = Auth.getCurrentUser();
    });

    $rootScope.$on('loggedOut', function () {
      $scope.isCollapsed = true;
    });

    $rootScope.$on('stationChanged', function () {
      $scope.isCollapsed = false;
    });
    
    $scope.addToMyStation = function(songId) {
      alert('hi' + songId);
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


    // format Presets for display in preset option list
    $scope.formatPresetListItem = function (station) {
      if (station.program) {
        return station._user.twitterHandle + ' | Now Playing: ' +
                                              station.program.nowPlaying._audioBlock.title + ' | ' +
                                              (station.program.nowPlaying._audioBlock.artist || '');
      } else {
        return station._user.twitterHandle;
      }
    }
    
    // check to see if the station is already in the presets
    $scope.isInPresets = function (id) {
      // if presets are not loaded yet
      if (!$scope.presets) {
        return false;
      }

      if ($scope.currentStation) {
        // if it's the user's own station, return true
        if (id === $scope.currentStation._id) {
          return true;
        }
        
        // check the array
        for (var i=0;i<$scope.presets.length;i++) {
          // if it's this station or it's included in
          if ($scope.presets[i]._id === id) {
            return true;
          }
        }
        return false;
      }
    }

    // text/disabled/inPresets
    $scope.presetButtonInfo = function (stationId) {
      if ($scope.currentStation) {

        if ($scope.currentStation._id === stationId) {
          return { text: 'Add Station to Presets',
                   disabled: true };
        } else if ($scope.isInPresets(stationId)) {
          return { text: 'Remove From Presets',
                   inPresets: true,
                   disabled: false };
        } else {
          return { text: 'Add Station to Presets',
                 inPresets: false,
                 disabled: false };
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
          }
        });

        // find the selected in the presets array and remove it
        for (var i=0;i<$scope.presets.length;i++) {
          if ($scope.presets[i]._id === station._id) {
            $scope.presets.splice(i,1);
            break;
          }
        }

      // otherwise put it in
      } else {

        Auth.follow(station._id, function (err, result) {
          for(var i=0;i<$scope.presets.length;i++) {
            if ($scope.presets[i]._id === result.newPreset._id) {
              $scope.presets[i] = result.newPreset;
              refreshStation($scope.presets[i]);
              break;
            }
          }
        });

        // temporarily include it until the response comes back
        var inserted = false;
        for (var i=0;i<$scope.presets;i++) {
          if ($scope.presets[i]._user.twitterHandle < station._user.twitterHandle) {
            inserted = true;
            $scope.presets.splice(i,0,station);
            break;
          }
        }

        // if it wasn't inserted it should be last
        $scope.presets.push(station);
      }
    }


    function getRotationItems() {
      if (SharedData.rotationItems) {
        $scope.rotationItems = SharedData.rotationItems;
        $scope.rotationItemAudioBlockIds = [];
        for(var i=0;i<$scope.rotationItems.length;i++) {
          $scope.rotationItemAudioBlockIds.push(rotationItems[i]._song._id);
        }
      } else {
        $rootScope.$on('rotationItemsLoaded', getRotationItems);
      }
    }

    function refreshStation(station) {
      Auth.getProgram({ id: station._id }, function (err, program) {
        station.program = program;

        var newTimeout = $timeout(function () {
          refreshStation(station);
        }, new Date(program.nowPlaying.endTime).getTime() - Date.now() + 2000);   // add 2 secs to make sure nowPlaying has actually changed

        $scope.timeouts.push(newTimeout);
      });
    };

    // cancel any pending updates
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