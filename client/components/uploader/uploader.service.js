'use strict';

angular.module('playolaApp')
  .service('Uploader', function ($rootScope, FileUploader, Auth, $q) {

    var self =this;

    this.fileUploader = new FileUploader({ url: 'http://upload.playola.fm/uploads',
                                        // UNCOMMENT FOR TESTING LOCALLY
                                        // url: 'http://localhost:3000/uploads',
                                        // headers: { 'Access-Control-Allow-Origin': '*' },
                                          //withCredentials: true,
                                          autoUpload: true });

    // this.fileUploader.onWhenAddingFileFailed = function(item /*{File|FileLikeObject}*/, filter, options) {
    //     console.info('onWhenAddingFileFailed', item, filter, options);
    // };
    // this.fileUploader.onAfterAddingFile = function(fileItem) {
    //     console.info('onAfterAddingFile', fileItem);
    // };
    // this.fileUploader.onAfterAddingAll = function(addedFileItems) {
    //     console.info('onAfterAddingAll', addedFileItems);
    // };
    this.fileUploader.onBeforeUploadItem = function(item) {
        // set status to 'Uploading'
        item.status = 'Uploading';
    };
    this.fileUploader.onProgressItem = function(fileItem, progress) {
        // switch status to processing after upload is complete
        if (progress === 100) {
          fileItem.status = 'Processing';
        }
    };
    // this.fileUploader.onProgressAll = function(progress) {
    //     console.info('onProgressAll', progress);
    // };
    // this.fileUploader.onSuccessItem = function(fileItem, response, status, headers) {
    //     console.info('onSuccessItem', fileItem, response, status, headers);
    // };
    // this.fileUploader.onErrorItem = function(fileItem, response, status, headers) {
    //     console.info('onErrorItem', fileItem, response, status, headers);
    // };
    // this.fileUploader.onCancelItem = function(fileItem, response, status, headers) {
    //     console.info('onCancelItem', fileItem, response, status, headers);
    // };

    this.fileUploader.onCompleteItem = function(fileItem, response, status, headers) {
      if (response.status === 'More Info Needed') {
        fileItem.status = response.status;
        fileItem.uploadItem = response.upload
        fileItem.uploadId = response.upload._id;
      } else if (response.status === 'Song Already Exists') {
        fileItem.status = 'Success';
        fileItem.songId = response.song._id;
      } else if (response.status === 'added') {
        fileItem.status = 'Success';
        fileItem.songId = response.song._id;
      }

    };
    this.fileUploader.onCompleteAll = function() {
        console.info('onCompleteAll');
    };



  })