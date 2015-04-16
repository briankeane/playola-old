'use strict';

angular.module('playolaApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('login', {
        url: '/login',
        templateUrl: 'app/account/login/login.html',
        controller: 'LoginCtrl'
      })
      .state('signup', {
        url: '/signup',
        templateUrl: 'app/account/signup/signup.html',
        controller: 'SignupCtrl'
      })
      .state('settings', {
        url: '/settings',
        templateUrl: 'app/account/settings/settings.html',
        controller: 'SettingsCtrl',
        authenticate: true
      })
      .state('getUserInfo', {
        url: '/getUserInfo',
        templateUrl: 'app/account/getUserInfo/getUserInfo.html',
        controller: 'GetUserInfoCtrl',
        authenticate: true
      })
      .state('getInitialInfo', {
        url: '/getInitialInfo',
        templateUrl: 'app/account/getInitialInfo/getInitialInfo.html',
        controller: 'GetInitialInfoCtrl',
        authenticate: true
      });
  });