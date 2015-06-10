'use strict';

/**
 * @ngdoc function
 * @name sdbaApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the sdbaApp
 */

/* This app will be shamelessly abusing pouchDB's allDocs() as per their own recommendation */

angular.module('sdbaApp')
  .controller('MainCtrl', function ($scope,$rootScope,DBService,$location) {
    $scope.events = [];
    $rootScope.notCenter = false;

    $scope.getAllEvents = function() {
      DBService.getAllEvents()
      .then(function(result){
        $scope.$apply($scope.events = result.rows);
      })
      .catch(function(e){
        console.log(e);
      });
    };

    $scope.loadEvent = function(event) {
      console.log("setting " + event.doc.eventID + " as active");
      DBService.setActiveEvent(event.doc.eventID);
      $location.path('/event/settings')
    };

    $scope.getAllEvents();

  });
