'use strict';

angular.module('playolaApp')
  .controller('NavbarCtrl', function (SharedData, $scope, $rootScope, $location, $window, Auth, $document) {
    $scope.menu = [{
      'title': 'Home',
      'link': '/'
    }];

    $scope.isCollapsed = true;
    $scope.isLoggedIn = Auth.isLoggedIn;
    $scope.isAdmin = Auth.isAdmin;
    $scope.SharedData = SharedData;

    $scope.logout = function() {
      Auth.logout();
      $rootScope.$broadcast('loggedOut');
      $location.path('/');
    };

    $scope.loginOauth = function(provider) {
      $window.location.href = '/auth/' + provider;
    };

    $scope.isActive = function(route) {
      return route === $location.path();
    };
  });