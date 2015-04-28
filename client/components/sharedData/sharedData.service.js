'use strict';

angular.module('playolaApp')
  .service('SharedData', function ($rootScope, Auth, $q) {

    this.initiate = function () {
      return;
    };

    // initialize variables
    var self = this;
    self.test = 'test';
    self.user;
    self.myStation;
    self.bins;
    self.rotationItemsArray;
    var promises = []

    // create object for tracking if all data loaded
    self.allData = [];
    
    $rootScope.$on('myStationLoaded', function () {
      var rotationItemsPromise = Auth.getRotationItems()
      rotationItemsPromise
      .then(function (result) {
        self.rotationItems = result.rotationItems;
        self.rotationItemsArray = getRotationItemsAsArray();
        $rootScope.$broadcast('rotationItemsLoaded');
      });
    })
    
    // load the station
    var stationPromise = Auth.getCurrentStation()
    .$promise
    .then(function (data) {
      self.myStation = data;
      console.log('myStationLoadedFiring');
      $rootScope.$broadcast('myStationLoaded');
    }, function (err) {
      console.log(err);
    });
    promises.push(stationPromise);

    // load user
    var userPromise = Auth.getCurrentUser()
    .$promise
    .then(function (data) {
      self.user = data;
      $rootScope.$broadcast('userLoaded');
    })
    promises.push(userPromise);


    $q.all(promises)
    .then(function () {
      console.log('all loaded');
    })

    // get 
    function getRotationBinList () {
      var bins = [];
      for (var property in self.rotationItems) {
        if (self.rotationItems.hasOwnProperty(property)) {
          if (bins.indexOf(property) === -1) {
            bins.push(property);
          }
        }
      }
      self.bins = bins;
      return bins;
    }

    function getRotationItemsAsArray () {
      var bins = getRotationBinList();
      var rotationItemsArray = [];

      // concatenate bins
      for (var i=0;i<bins.length;i++) {
        rotationItemsArray = rotationItemsArray.concat(self.rotationItems[bins[i]]);
      }
      self.rotationItemsArray = rotationItemsArray.sort(compareSong);
      return rotationItemsArray;
    }


    function compareSong(a,b) {
      if (a._song.artist.toLowerCase() > b._song.artist.toLowerCase()) {
        return 1;
      } else if (a._song.artist.toLowerCase() < b._song.artist.toLowerCase()) {
        return -1;
      } else {
        return 0;
      }
    }
  });

