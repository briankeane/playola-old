'use strict';

angular.module('playolaApp')
  .controller('ListenIndexCtrl', function ($scope, Auth, $location, $window, $timeout, AudioPlayer) {
    
    $scope.timeouts = [];
    $scope.topStations = [];
    $scope.twitterFriends = [];
    $scope.keywordSearchResults = [];
    $scope.inputs = { 
                    searchText: '' 
                  };

    $timeout(function () {
      Auth.getTwitterFriends(function (err, friends) {
        $scope.twitterFriends = friends;

        // grab the program for each station
        for(var i=0;i<$scope.twitterFriends.length;i++) {
          refreshProgram($scope.twitterFriends[i]);
        }
      })
    }, 1000);

    $timeout(function () {
      Auth.getTopStations({}, function (err, result) {
        $scope.topStations = result.topStations;
        
        // grab the program for each station
        for(var i=0;i<$scope.topStations.length;i++) {
          refreshStation($scope.topStations[i]);
        }
      });
    }, 1000);

    $scope.playStation = function (stationId) {
      AudioPlayer.loadStation(stationId);
    };

    $scope.findStationsByKeywords = function (searchString) {
      if (searchString.length <= 3) {
        $scope.keywordSearchResults = [];
      } else {
        Auth.findUsersByKeywords(searchString, function (err, results) {
          if (err) { console.log(err); }
          if (results) {
            if ($scope.inputs.searchText === searchString) {   //IF it was the last request made
              $scope.keywordSearchResults = results;
              for(var i=0;i<$scope.keywordSearchResults.length;i++) {
                refreshProgramOnce($scope.keywordSearchResults[i]);
              }
            }
          }
        })
      }
    };

    function refreshStation(station) {
      Auth.getProgram({ id: station._id }, function (err, program) {
        station.program = program;

        var newTimeout = $timeout(function () {
          refreshStation(station);
        }, new Date(program.nowPlaying.endTime).getTime() - Date.now() + 2000);   // add 2 secs to make sure nowPlaying has actually changed

        $scope.timeouts.push(newTimeout);
      });
    };

    function refreshProgramOnce(user) {
      Auth.getProgram({ id: user._station._id }, function (err, program) {
        user.program = program;
      });
    };
    
    function refreshProgram(friend) {
      Auth.getProgram({  id: friend._station._id }, function (err, program) {
        friend.program = program;

        var newTimeout = $timeout(function () {
          refreshProgram(friend);
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
  });
