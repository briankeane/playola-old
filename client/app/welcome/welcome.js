'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('welcome', {
        url: '/welcome',
        templateUrl: 'app/welcome/welcome.html',
        controller: 'WelcomeCtrl'
      });
  });