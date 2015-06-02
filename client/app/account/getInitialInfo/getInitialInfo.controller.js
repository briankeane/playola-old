angular.module('playolaApp')
  .controller('GetInitialInfoCtrl', function ($rootScope, $scope, $timeout, Auth, SharedData, $modal, $location) {

    // wait for all available user info
    var user = SharedData.user;
    if (user) {
      getInfo();
    } else {
      $rootScope.$on('userLoaded', function () {
        user = SharedData.user;
        getInfo();
      })
    }

    function getInfo() {
      // IF so that mobile won't display if manually directed to page
      if (!(user.zipcode && user.birthYear && user.gender && user._station)) {
        $modal.open({
          templateUrl: 'app/account/getInitialInfo/getInitialInfo.modal.html',
          height: 'auto',
          backdrop: 'static',
          controller: function ($scope, $modalInstance) {
            $scope.submitButtonInfo = { text: 'Take My Info Evil Corporation',
                                        enabled: true };

            $scope.user = Auth.getCurrentUser();
            $scope.errors = {};
            $scope.artist1='';

            $scope.updateInitialUserInfo = function(form) {
              $scope.submitted = true;

              var submitButtonTextChangeTimeout;
              // changes the text of the waiting button...
              function displayWaitingText() {
                var index = 0;
                var waitingMessages = [ 'Creating Your Station...',
                                        'This Could Take Up To 30 secs...',
                                        'So... uh....',
                                        'Nice weather, huh?...',
                                        "  (fingers tapping...)  "];

                showNextMessage();
                
                function showNextMessage() {
                  $scope.submitButtonInfo.text = waitingMessages[index];
                  
                  // iterate
                  index++;
                  if (index >= waitingMessages.length) {
                    index = 0;
                  }
                  
                  // set next message change
                  submitButtonTextChangeTimeout = $timeout(function () {
                    showNextMessage();
                  }, 5000);
                }
              }

              // remove notFound error
              form["zipcode"].$setValidity('notFound', true);
              

              if(form.$valid) {

                displayWaitingText();
                
                Auth.updateUser({
                  birthYear: $scope.user.birthYear,
                  gender: $scope.user.gender
                })
                .then( function() {
                  Auth.setZipcode($scope.user.zipcode, function(err, zipcode) {
                    if (err) {
                      var error = err.data;
                      form["zipcode"].$setValidity('notFound', false);
                      $scope.errors["zipcode"] = error.message;

                      // reset submit button and stop it from changing
                      $scope.submitButtonInfo = { text: 'Take My Info Evil Corporation',
                                                  enabled: true }
                      $timeout.cancel(submitButtonTextChangeTimeout);
                    }
                  })
                  .then( function () {
                    
                    // create array from inputs
                    var artists = []
                    if (form.artist1.$modelValue) { artists.push(form.artist1.$modelValue); }
                    if (form.artist2.$modelValue) { artists.push(form.artist2.$modelValue); }
                    if (form.artist3.$modelValue) { artists.push(form.artist3.$modelValue); }
                    if (form.artist4.$modelValue) { artists.push(form.artist4.$modelValue); }
                    if (form.artist5.$modelValue) { artists.push(form.artist5.$modelValue); }

                    // All updated, redirect home
                    // $location.path('/');
                    Auth.createStation({ _user: $scope.user._id,
                                         artists: artists }, function (err, newStation) {
                      
                      // grab the first song
                      Auth.getProgram({ id: user._station._id }, function (err, program) {
                        $modalInstance.dismiss('close');
                        $modal.open({
                          templateUrl: 'app/account/getInitialInfo/congratsStationCreated.modal.html',
                          size: 'md',
                          controller: function($scope, $modalInstance) {
                            $scope.firstSong = program.nowPlaying._audioBlock;

                            $scope.goToListen = function () {
                              $modalInstance.dismiss('close');
                              $location.path('/station');
                            };

                            $scope.goToSchedule = function () {
                              $modalInstance.dismiss('close');
                              $location.path('/station/mySchedule');
                            };
                          }
                        });
                      });
                      // reload SharedData info
                      SharedData.initialize();

                      // get the program for the new station
                      $scope.station = newStation;
                      $location.path('/station');
                      $modalInstance.dismiss();

                    });
                  })
                })
                .catch( function(err) {
                  err = err.data;
                  $scope.errors = {};

                  // Update validity of form fields that match the mongoose errors
                  angular.forEach(err.errors, function(error, field) {
                    form[field].$setValidity('mongoose', false);
                    $scope.errors[field] = error.message;
                  });
                });
              } // ELSE {}
            };
          } // END controller
       });  // END modal
      } // ENDIF
    }
  })