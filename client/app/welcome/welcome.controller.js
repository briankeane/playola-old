'use strict';

angular.module('playolaApp')
  .controller('WelcomeCtrl', function ($scope, $rootScope, $location, Auth) {
    
    // later on this will actually be a welcome screen. For now it will just broadcast that the user has logged in
    $rootScope.$broadcast('loggedIn');
    
    var user = Auth.getCurrentUser();
    // reroute to info gathering or home
    if (!(user.zipcode && user.birthYear && user.gender && user._station)) {
      $location.path('/getInitialInfo');
    } else {
      $location.path('/');
    }
  });
