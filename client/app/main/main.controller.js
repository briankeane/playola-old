'use strict';

angular.module('playolaApp')
  .controller('MainCtrl', function ($scope, $http, Auth, $window) {
    $scope.awesomeThings = [];

    $scope.loginOauth = function(provider) {
      $window.location.href = '/auth/' + provider;
    };
  });
