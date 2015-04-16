angular.module('playolaApp')
  .controller('uploaderCtrl', function ($scope, Auth, FileUploader, $modal) {
    $scope.uploader = new FileUploader({ url: 'api/v1/uploads',
                                          autoUpload: true });

      $scope.uploader.onWhenAddingFileFailed = function(item /*{File|FileLikeObject}*/, filter, options) {
          console.info('onWhenAddingFileFailed', item, filter, options);
      };
      $scope.uploader.onAfterAddingFile = function(fileItem) {
          console.info('onAfterAddingFile', fileItem);
      };
      $scope.uploader.onAfterAddingAll = function(addedFileItems) {
          console.info('onAfterAddingAll', addedFileItems);
      };
      $scope.uploader.onBeforeUploadItem = function(item) {
          console.info('onBeforeUploadItem', item);
      };
      $scope.uploader.onProgressItem = function(fileItem, progress) {
          console.info('onProgressItem', fileItem, progress);
      };
      $scope.uploader.onProgressAll = function(progress) {
          console.info('onProgressAll', progress);
      };
      $scope.uploader.onSuccessItem = function(fileItem, response, status, headers) {
          console.info('onSuccessItem', fileItem, response, status, headers);
      };
      $scope.uploader.onErrorItem = function(fileItem, response, status, headers) {
          console.info('onErrorItem', fileItem, response, status, headers);
      };
      $scope.uploader.onCancelItem = function(fileItem, response, status, headers) {
          console.info('onCancelItem', fileItem, response, status, headers);
      };
      $scope.uploader.onCompleteItem = function(fileItem, response, status, headers) {
        if (response.status === 'info needed') {
          fileItem.status = response.status;
          fileItem.possibleMatches = response.possibleMatches;
          fileItem.tags = response.tags;
          fileItem.filename = response.filename;
          fileItem.isSuccess = false;
          fileItem.isNeedInfo = true;
          fileItem.uploadId = response._id;
        } else if (response.status === 'Song Already Exists') {
          fileItem.status = response.status;
          fileItem.isSuccess = true;
          fileItem.songId = response.song._id;

        } else if (response.status === 'added') {
          fileItem.status = response.status;
          fileItem.isSuccess = true;
          fileItem.songId = response.song._id;
        }

      };
      $scope.uploader.onCompleteAll = function() {
          console.info('onCompleteAll');
      };

      $scope.addToMyStation = function (songId) {
        Auth.createRotationItem({ weight: 17,
                                  bin: 'active',
                                  _song: songId }, function (err, results) {
          if (!err){
            for (var i=0;i<$scope.uploader.queue.length;i++) {
              if ($scope.uploader.queue[i].songId === songId) {
                $scope.uploader.queue[i].addedToStation = true;

              }
            }
          }
        });
      };

      $scope.getSongMatch = function (item) {
        $modal.open({
          templateUrl: 'components/uploader/getMatch.modal.html',
          size: 'lg',
          scope: $scope,  
          controller: function ($modalInstance) {

            $scope.item = item;
            $scope.selectedSong = {}
            $scope.selectedSong.index = '';
            $scope.oldTitle = item.tags.title;
            $scope.oldAlbum = item.tags.album;
            $scope.oldArtist = item.tags.artist;
            $scope.tagsChanged = false;
            $scope.tags = item.tags;

            $scope.cancel = function () {
              $modalInstance.dismiss('cancel');
            };

            $scope.setValue = function () {
              $scope.selectedSong.index = 'ECHONESTIDNOTFOUND';
            }

            $scope.submitSongWithEchonestId = function (form) {
              $scope.submitted = true;

              if (form.$valid) {
                if ($scope.selectedSong.index === 'ECHONESTIDNOTFOUND') {
                  $modalInstance.close();

                // if echonestID was provided, resubmit upload
                } else {

                  Auth.resubmitUploadWithEchonestId(uploadInfo, function (err, result) {

                  });
                }
                
              }
            };

          }
        }).result.then(function () {
          if ($scope.selectedSong.index === 'ECHONESTIDNOTFOUND') {
            if ($scope.tagsChanged) {
              var uploadInfo = { uploadId: item.uploadId,
                                 tags: item.tags
                                };
              
              Auth.resubmitUploadWithUpdatedTags(uploadInfo, function (err, response) {
                if (response.status === 'info needed') {
                  item.status = response.status;
                  item.possibleMatches = response.possibleMatches;
                  item.tags = response.tags;
                  item.filename = response.filename;
                  item.isSuccess = false;
                  item.isNeedInfo = true;
                  item.uploadId = response._id;
                } else if (response.status === 'Song Already Exists') {
                  item.isNeedInfo = false;
                  item.status = response.status;
                  item.isSuccess = true;
                  item.songId = response.song._id;

                } else if (response.status === 'added') {
                  item.isNeedInfo = false;
                  item.status = response.status;
                  item.isSuccess = true;
                  item.songId = response.song._id;
                }
              });
            }
            // $modal.open({
            //   templateUrl: 'components/uploader/getSongWithoutEchonest.modal.html',

            // });



          } else {
                  var index = parseInt($scope.selectedSong.index);
                  var uploadInfo = { artist: item.possibleMatches[index].artist,
                                      title: item.possibleMatches[index].title,
                                      echonestId: item.possibleMatches[index].echonestId,
                                      album: item.possibleMatches[index].album,
                                      uploadId: item.uploadId,
                                      tags: item.tags
                                    };

          }

        });
      };
  });