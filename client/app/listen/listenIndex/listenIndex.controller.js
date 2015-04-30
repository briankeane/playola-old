'use strict';

angular.module('playolaApp')
  .controller('ListenIndexCtrl', function (SharedData, $scope, Auth, $location, $window, $timeout, AudioPlayer) {
    
    $scope.timeouts = [];
    $scope.topStations = [];
    $scope.twitterFriends = [];
    $scope.keywordSearchResults = [];
    $scope.inputs = { 
                    searchText: '' 
                  };
    $scope.activeTab = { friends: true,
                        topStations: false,
                        search: false
                       };

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

    $scope.listenMainJoyrideConfig = [
      {
        type:"title",
        heading:"Listen",
        text: "" +
        "<div class='row'>" +
          "<div id='title-text' class='col-md-12'>" +
            "<span class='main-text'>This is the main Listen page, where you can find stations to listen to." +
            "</span>" +
          "</div>" +
        "</div>"
      },
      {
        // open the topStations tab
        type: 'function',
        fn: function (movingForward) {
          if (movingForward) {
            $scope.activeTab = { topStations: true };
          } else {
            $scope.activeTab = { friends: true };
          }
        }
      },
      {
        type:"element",
        heading:"Top Stations",
        text: "The 'Top Stations' tab contains the most popular stations on Playola right now.",
        selector: "#topStationsTab a"
      },
      {
        type:"element",
        heading:"Now Playing",
        text: "Hover over the station to see what it's playing right now... Click on it to listen.",
        selector: "#topStationSquares-1",
        placement: 'right'
      },
      {
        type: 'function',
        fn: function (movingForward) {
          if (movingForward) {
            $scope.activeTab = { search: true };
          } else {
            $scope.activeTab = { topStations: true };
          }
        }
      },
      {
        type: 'element',
        heading: 'Search',
        text: "Click on the 'Search' tab to search for stations by twitter handle or screen name.",
        selector: '#searchTab',
        placement: 'left'
      },
      {
        type: 'function',
        fn: function (movingForward) {
          if (movingForward) {
            if ($scope.twitterFriends.length) {
              $scope.activeTab = { friends: true };
            } else {
              $scope.activeTab = { topStations: true };
            }
          } else {
            $scope.activeTab = { search: true };
          }
        }
      },
      { 
        type: 'title',
        heading: 'Thanks',
        text: 'Thanks for taking the tour... Happy listening!'
      }
    ];

    // tour end functions
    $scope.onFinish = function () {
      Auth.reportTourTaken('mainListenTour', function (user) {
        SharedData.user = user;
      });
    }

    $scope.onSkip = function () {
      Auth.reportTourTaken('mainListenTour', function (user) {
        SharedData.user = user;
      });
    }

    $timeout(function () {
      Auth.getTwitterFriends(function (err, result) {
        $scope.twitterFriends = result.friends;

        // if they haven't taken the tour yet
        if (!(SharedData.user.tours && SharedData.user.tours.mainListenTour)) {
          
          // insert no-friends commentary
          if (!$scope.twitterFriends.length) {
            $scope.listenMainJoyrideConfig.splice(1,0,
              {
                type: 'element',
                heading: 'Friends',
                text: 'If you had any friends, this is where they would show up.',
                selector: '#friendsTab a'
              },
              {
                type: "title",
                heading: "Your Friends",
                text: "<i>awkward...</i>"
              }
            );

          // otherwise insert normal commentary
          } else {
            $scope.listenMainJoyrideConfig.splice(1,0, 
              {
                type: 'element',
                heading: 'Friends',
                text: 'Anyone that you follow on twitter that has a station will show up in this tab.',
                selector: '#friendsTab a',
                placement: 'bottom'
              }
            );
          }
          $scope.listenMainJoyrideStart = true;
        }

        // grab the program for each station
        for(var i=0;i<$scope.twitterFriends.length;i++) {
          refreshProgram($scope.twitterFriends[i]);
        }
      })
    }, 1000);
  });
