'use strict';

angular.module('playolaApp')
  .controller('SignUpCtrl', function ($scope, $modal, Auth, $window) {
    $scope.awesomeThings = [];

    $scope.loginOauth = function(provider) {
      $window.location.href = '/auth/' + provider;
    };

    $scope.launchTwitterPolicyModal = function () {
      $modal.open({
        templateUrl: 'app/signUp/twitterPolicy.modal.html',
        size: 'lg',
        scope: $scope,
        controller: function ($modalInstance) {
          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          }
        }
      });
    }

  });