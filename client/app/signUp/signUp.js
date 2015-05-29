'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('signUp', {
        url: '/signUp',
        templateUrl: 'app/signUp/signUp.html',
        controller: 'SignUpCtrl',
        authenticate: false
      });
  });