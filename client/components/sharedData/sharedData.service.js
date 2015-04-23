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
    var promises = []

    // create object for tracking if all data loaded
    self.allData = [];
    
    // load the station
    var stationPromise = Auth.getCurrentStation()
    .$promise
    .then(function (data) {
      self.myStation = data;
      $rootScope.$broadcast('myStationLoaded');
          }, function (err) {
      alert('ho');
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

    $rootScope.$on('myStationLoaded', function () {
      var rotationItemsPromise = Auth.getRotationItems()
      .then(function (rotationItems) {
        self.rotationItems = rotationItems;
        $rootScope.$broadcast('rotationItemsLoaded');
      });
    })

    $q.all(promises)
    .then(function () {
      console.log('all loaded');
    })


  });
