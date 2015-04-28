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

    $scope.newSongDropped = function (event, index, song, type) {
      // create an actual rotationItem
      var newRotationItem = { weight: 17,
                              bin: 'medium',
                              _song: song }
      var insertedIndex = -1;

      // insert it at the proper index
      for (var i=0;i<$scope.rotationItems.length;i++) {
        // IF the song is already in the list, give error message and exit
        if ((compareSong($scope.rotationItems[i], newRotationItem) === 0) && 
                    ($scope.rotationItems[i]._song._id === newRotationItem._song._id)) {
          $scope.rotationItemsMessage = "Error: That song is already in rotation";

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

    $scope.currentStation = Auth.getCurrentStation()

    $scope.currentUser = Auth.getCurrentUser();

    if (!SharedData.myStation) {
      $rootScope.$on('rotationItemsLoaded', function () {
        $scope.bins = SharedData.bins;
        $scope.rotationItems = SharedData.rotationItemsArray;
      })
    }
    $scope.bins = SharedData.bins;
    $scope.rotationItems = SharedData.rotationItemsArray;


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