'use strict';

angular.module('playolaApp')
  .controller('SongManagerCtrl', function ($rootScope, $scope, Auth, $location, SharedData, $window, $timeout, $anchorScroll) {
    $scope.user = {};
    $scope.station = {};
    $scope.errors = {};
    $scope.catalogSearchResults = [];
    $scope.rotationItems = [];
    $scope.rotationItemsPendingRemoval = [];
    $scope.bins = [];

    $scope.removeRotationItem = function(rotationItem) {
      if ($scope.rotationItems.length <= 45) {
        $scope.rotationItemsMessage = "Sorry... you'll have to add a song first.";
      } else {
        // remove from the array
        for (var i=0;i<$scope.rotationItems.length; i++) {
          if ($scope.rotationItems[i]._id === rotationItem._id) {
            var removedItem = $scope.rotationItems.splice(i,1)[0];
            var removedItemInfo = { item: removedItem,
                                      index: i};
            break;
          }

        }
        Auth.removeRotationItem(rotationItem._id, function (err, rotationItems) {
          // if unable to delete, put rotationItem back and inform user
          if (err) { 
            $scope.rotationItems.splice(removedItemInfo.index, 0, removedItemInfo.item).join();
            $scope.rotationItemsMessage = "Error: Unable to delete: " + removedItemInfo.item._song.title +
                                                    " by " + removedItemInfo.item._song.artist +
                                                    ".  Please try again.";
          }
        });
      }
    };

    $scope.findSongs = function (searchString) {
      if (searchString.length <= 3) {
        $scope.catalogSearchResults = [];
      } else {
        Auth.findSongsByKeywords(searchString, function (err, results) {
          if (err) { console.log(err); }
          if (results) {
            if ($scope.searchText === searchString) {
              $scope.catalogSearchResults = results;
            }
            console.log(results);
          }
        });
      }
    };

    $scope.saveOldBin= function (item) {
      item.oldValue = item.bin;
    };

    $scope.updateRotationItemBin = function (item) {
      Auth.updateRotationBin({ _id: item._id,
                                  bin: item.bin }, function (err, newRotationItems) {
        
        // if there was an error, keep the old value the same and let the user know
        if (err) {
          item.bin = item.oldBin;
          $scope.rotationItemsMessage = "Error: Unable to change rotation level for: " + item._song.title +
                                                    " by " + item._song.artist +
                                                    ".  Please try again.";
        }
      });
    };

    $scope.rotationItemsListOptions = {
      connectWith: '#catalog-list',
      receive: function (event, ui) {

        // cancel the sort... manually reset the array
        // var holderArray = $scope.catalogSearchResults.slice();
        // ui.item.sortable.cancel();
        // $scope.catalogSearchResults = holderArray;

        var song = ui.item.sortable.model;
        var index = ui.item.sortable.dropindex;

        // remove the dropped item
        $scope.rotationItems.splice(index,1);

        // create an actual rotationItem
        var newRotationItem = { bin: 'medium',
                                _song: song }
        var insertedIndex = -1;

        // insert it at the proper index
        for (var i=0;i<$scope.rotationItems.length;i++) {
          // IF the song is already in the list, give error message and exit
          if ((compareSong($scope.rotationItems[i], newRotationItem) === 0) || 
                      ($scope.rotationItems[i]._song._id === newRotationItem._song._id)) {
            $scope.$apply(function () { 
              $scope.rotationItemsMessage = "Error: That song is already in rotation";
            });

            // ADD LATER: scroll to it
            return;

          // ELSE IF it's time to insert... 
          } else if (compareSong($scope.rotationItems[i], newRotationItem) === 1) {
            $scope.rotationItems.splice(i,0,newRotationItem);
            if (i===0) { $scope.$apply(); }     // this is needed only when inserted in 1st slot... not sure why
            insertedIndex = i;
            break;
          }
        }

        // IF it wasn't included put it last
        if (insertedIndex < 0) {
          $scope.rotationItems.push(newRotationItem);
          insertedIndex = $scope.rotationItems.length-1;
        }

        // Add song
        Auth.createRotationItem(newRotationItem, function (err, results) {
          if (err) { 
            // remove inserted object
            for (var i=0;i<$scope.rotationItems.length;i++) {
              if (newRotationItem._song._id === $scope.rotationItems[i]._song._id) {
                $scope.rotationItems.splice(i,1);
                $scope.$apply();
                break;   
              }
            }
            // display error message
            $scope.rotationItemsMessage = 'Error: Could not add ' + newRotationItem._song.title + ' by ' + newRotationItem._song.artist + 
                                          '.  Please try again.';
          } else {
            // put new ID into object
            for (var i=0;i<$scope.rotationItems.length;i++) {
              if (newRotationItem._song._id === $scope.rotationItems[i]._song._id) {
                $scope.rotationItems[i]._id = results.newRotationItem._id;
                break;   
              }
            }
          }
        });
      }
    };

    $scope.catalogListOptions = {
      connectWith: '#rotationItemsList',
      update: function (event, ui) {
        ui.item.sortable.cancel();
        $scope.$apply();
        //debugger;
      }
    };

    $scope.currentStation = Auth.getCurrentStation()

    $scope.currentUser = Auth.getCurrentUser();
    
    function loadItems () {
      $scope.bins = SharedData.bins;
      $scope.rotationItems = SharedData.rotationItemsArray;
      
      if (!(SharedData.user.tours && SharedData.user.tours.mySongsTour)) {
        $scope.mySongsJoyride=true;
      }

    }

    if (!SharedData.myStation) {
      $rootScope.$on('rotationItemsLoaded', function () {
        loadItems();
      });
    } else {
      loadItems();
    }

    $scope.bins = SharedData.bins;
    $scope.rotationItems = SharedData.rotationItemsArray;

    // tour end functions
    $scope.onFinish = function () {
      Auth.reportTourTaken('mySongsTour', function (user) {
        SharedData.user = user;
      });
    }

    $scope.onSkip = function () {
      Auth.reportTourTaken('mySongsTour', function (user) {
        SharedData.user = user;
      });
    }

    $scope.mySongsJoyrideConfig = [
      {
        type:"title",
        heading:"My Songs",
        text: "" +
        "<div class='row'>" +
          "<div id='title-text' class='col-md-12'>" +
            "<span class='main-text'>This page stores all the songs that our song scheduler uses to create your schedule." +
            "</span>" +
          "</div>" +
        "</div>"
      },
      {
        type: "element",
        heading: "MySongs",
        text: "These are the songs that will play on your station.  To increase or decrease how often a song is played, change it's category.  Heavier songs " +
        "are played the most, light songs are played the least.",
        selector: '#spinsPerWeekList'
      },
      {
        type: 'element',
        heading: 'Adding a Song',
        text: "To add a song to the scheduler, type the title or artist into the searchbox.  When the song you want appears below, double-click on the station.",
        selector: '#searchbox'
      },
      {
        type: 'title',
        heading: 'Playola',
        text: 'Ok, have at it.'
      }
    ];
  });

function compareSong(a,b) {
  if (a._song.artist.toLowerCase() > b._song.artist.toLowerCase()) {
    return 1;
  } else if (a._song.artist.toLowerCase() < b._song.artist.toLowerCase()) {
    return -1;
  } else {
    return 0;
  }
}