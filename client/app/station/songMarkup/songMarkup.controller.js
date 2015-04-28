'use strict';

angular.module('playolaApp')
  .controller('SongMarkupCtrl', function ($rootScope, $scope, Auth, SharedData, $timeout) {
    $scope.rotationItemsToMarkup = [];
    $scope.currentStation = Auth.getCurrentStation();
    $scope.waveforms;
    $scope.context = new AudioContext();
    $scope.regionBeingMoved;
    $scope.rotationItems;

    $scope.totalPages;
    $scope.currentPage = 1;

    $scope.beep = function () {
      var source = $scope.context.createOscillator();
      source.connect($scope.context.destination);
      source.start(0);
      $timeout(function () {
        source.stop()
      }, 100);
    }

    if (!SharedData.myStation) {
      $rootScope.$on('rotationItemsLoaded', function () {
        loadRotationItems();
      });
    } else {
      loadRotationItems();
    }

    function loadRotationItems() {
      $scope.rotationItems = SharedData.rotationItemsArray;
      $scope.totalPages = Math.ceil(SharedData.rotationItemsArray.length/10.0);

      var activeRotationItems = SharedData.rotationItemsArray;
      for (var i=0;i<activeRotationItems.length;i++) {
        //if (!activeRotationItems[i].eom || (!activeRotationItems[i].boo) || (!activeRotationItems[i].eoi === undefined)) {
          $scope.rotationItemsToMarkup.push(activeRotationItems[i]);
        //}

        // limit it to 10 songs
        if ($scope.rotationItemsToMarkup.length >= 10) {
          break;
        }
      }
    }

    $scope.nextPage = function () {
      if ($scope.currentPage < $scope.totalPages) {
        $scope.currentPage++;
        loadRotationItemsToMarkup();
      }
    }
    $scope.previousPage = function () {
      if ($scope.currentPage > 1) {
        $scope.currentPage--;
        loadRotationItemsToMarkup();
      }
    }

    function loadRotationItemsToMarkup() {
      var startingIndex = $scope.currentPage * 10;
      $scope.rotationItemsToMarkup = $scope.rotationItems.slice(startingIndex, startingIndex+10);
    }

    $scope.loadWaveform = function (index, url) {
      // wait for waveform to exist
      $timeout(function () {
        var wavesurfer = Object.create(WaveSurfer);
        wavesurfer.init({
          container: '#' + 'rotationItem' + index,
          waveColor: 'violet',
          progressColor: 'purple',
        });
        wavesurfer.load(url);
        $scope.rotationItemsToMarkup[index].wavesurfer = wavesurfer;

        // set up the marking regions
        wavesurfer.on('ready', function () {
          // setup markups
          var markups = secsFromMarkup($scope.rotationItemsToMarkup[index].eoi);
          wavesurfer.addRegion({ start: markups.start,
                                  end: markups.end,
                                  color: "rgb(0,0,150)",
                                  loop: false,
                                  resize: false,
                                  id: 'eoi' })

          markups = secsFromMarkup($scope.rotationItemsToMarkup[index].boo);
          wavesurfer.addRegion({ start: markups.start,
                                  end: markups.end,
                                  color: "rgb(0,150,0)",
                                  loop: false,
                                  resize: false,
                                  id: 'boo' })
          markups = secsFromMarkup($scope.rotationItemsToMarkup[index].eom);
          wavesurfer.addRegion({ start: markups.start,
                                  end: markups.end,
                                  color: "rgb(150,0,0)",
                                  loop: false,
                                  resize: false,
                                  id: 'eom' })

          wavesurfer.on('region-in', function (regionObject) {
            console.log('region entered!');
            $scope.beep();
          });

          wavesurfer.on('region-updated', function (regionObject) {
            var changed = false;
            if (regionObject.id === 'eoi') {
              $scope.rotationItemsToMarkup[index].eoi = Math.round(regionObject.start * 1000);
            } else if (regionObject.id === 'boo') {
              $scope.rotationItemsToMarkup[index].boo = Math.round(regionObject.start * 1000);
            } else if (regionObject.id === 'eom') {
              $scope.rotationItemsToMarkup[index].eom = Math.round(regionObject.start * 1000);
            }

            // update changes on screen
            if (!$scope.$$phase) {
              $scope.$digest();
            }

          });
        });
      }, 1000);
    };

    $scope.markBOO = function (index) {
      var newValue = Math.round($scope.rotationItemsToMarkup[index].wavesurfer.getCurrentTime() * 1000);
      $scope.rotationItemsToMarkup[index].boo = newValue
      $scope.rotationItemsToMarkup[index].wavesurfer.regions.list.boo.update(secsFromMarkup(newValue));
    };
    $scope.markEOI = function (index) {
      var newValue = Math.round($scope.rotationItemsToMarkup[index].wavesurfer.getCurrentTime() * 1000);
      $scope.rotationItemsToMarkup[index].eoi = newValue
      $scope.rotationItemsToMarkup[index].wavesurfer.regions.list.eoi.update(secsFromMarkup(newValue));
    };
    $scope.markEOM = function (index) {
      var newValue = Math.round($scope.rotationItemsToMarkup[index].wavesurfer.getCurrentTime() * 1000);
      $scope.rotationItemsToMarkup[index].eom = newValue
      $scope.rotationItemsToMarkup[index].wavesurfer.regions.list.eom.update(secsFromMarkup(newValue));
    };

    $scope.saveMarks = function(index) {
      var rotationItem = $scope.rotationItemsToMarkup[index];
      
      // if all info is complete
      if ((rotationItem.eoi != null) && rotationItem.boo && rotationItem.eom) {
        Auth.updateRotationItem({ _id: rotationItem._id,
                          eom: rotationItem.eom,
                          boo: rotationItem.boo,
                          eoi: rotationItem.eoi
                        }, function (err, updatedRotationItems) {
          if (!err) {
            $scope.rotationItemsToMarkup.splice(index, 1);
          }
        });
      }
    }

    // gives the region width if the markup exists, no width if it doesn't
    function secsFromMarkup(markupMS) {
      if (markupMS === undefined) {
        return { start: 0, end: 0 };
      } else {
        return { start:markupMS/1000.0, end: markupMS/1000.0 + 1 };
      }
    }
  });
