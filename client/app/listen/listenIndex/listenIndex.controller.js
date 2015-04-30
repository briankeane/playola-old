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
        type:"element",
        heading:"Now Playing",
        text: "These are the most popular stations on Playola right now.",
        selector: "#topStationsTab a"
      },
      {
        type: "element",
        heading: "The Schedule",
        text: "This is the list of songs that you are about to broadcast.",
        selector: "#station-list"
      },
      {
        type: "title",
        heading: "Changing Spin Order",
        text: "You can change the order of a spin by grabbing it with your mouse and dragging it up or down.",
        attachToBody: true
      },
      {
        type: "title",
        heading: "Commercial Blocks",
        text: "Commercial Blocks will automatically adjust around your changes.",
        attachToBody: true
      },
      {
        type: "element",
        heading: "Remove Spin",
        text: "Remove a spin by clicking on the 'x'",
        selector: "#station-list"
      },
      {
        type: 'element',
        heading: 'The Catalog',
        text: 'You can search for songs to play here.  Type the title or artist in this box.  When the search results appear, you can drag them right into the schedule on the left.',
        selector: '#searchbox',
        placement: 'left'
      },
      {
        type: 'element',
        heading: 'Record Commentary',
        text: 'To record commentary, click on the "Record" tab...',
        selector: '#recordTab a',
        placement: 'left'
      },
      // {
      //   type: 'function',
      //   fn: activateRecordTab
      // }
    ];

    $timeout(function () {
      Auth.getTwitterFriends(function (err, result) {
        $scope.twitterFriends = result.friends;

        if (!(SharedData.user.tours && SharedData.user.tours.listenMain)) {
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
