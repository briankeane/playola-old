'use strict';

angular.module('playolaApp')
  .controller('WelcomeCtrl', function ($scope, $rootScope, $location, Auth, SharedData) {
    SharedData.initiate();
    // later on this will actually be a welcome screen. For now it will just broadcast that the user has logged in
    $rootScope.$broadcast('loggedIn');
    
    $rootScope.$on('userLoaded', function () {
      if (!(SharedData.user.zipcode && SharedData.user.birthYear && SharedData.user.gender && SharedData.user._station)) {
        $location.path('/getInitialInfo');
      } else {
        $location.path('/');
      }

    })
    
  });
