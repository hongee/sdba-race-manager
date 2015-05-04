/* global angular */
'use strict';

/**
 * @ngdoc overview
 * @name sdbaApp
 * @description
 * # sdbaApp
 *
 * Main module of the application.
 */
angular
  .module('sdbaApp', [
    'ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch',
    'ui.bootstrap'
  ])
  .config(function($routeProvider) {
    //this looks like shit
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .when('/newevent', {
        templateUrl: 'views/newevent.html',
        controller: 'NewEventCtrl'
      })
      .when('/settings', {
        templateUrl: 'views/settings.html',
        controller: 'SettingsCtrl'
      })
      .when('/event/settings', {
        templateUrl: 'views/eventsettings.html',
        controller: 'EventSettingsCtrl'
      })
      .when('/event/nextround', {
        templateUrl: 'views/completeround.html',
        controller: 'NewRoundCtrl'
      })
      .when('/event/view/:eventID', {
        templateUrl: 'views/eventview.html',
        controller: 'EventViewCtrl'
      })
      .when('/event', {
        templateUrl: 'views/event.html',
        controller: 'EventCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .run(function($rootScope,defaults) {
    //future - this ideally should be wrapped in a service instead of being dumped into global
    $rootScope.db = new PouchDB('sdba');
    //so secure!!!! for future deployment put a password screen before the app to enable sync
    var remote = 'https://sdba:90688625@sdba.cloudant.com/sdba',
      opts = {
        live: true,
        retry: true
      };

    //what else?
    //document ids will be named as such
    //{{type (settings|team|race)}}_{{id/key (app|dbs_regatta_2015|bishan_team_1)}}
    var defaultAppSettings = {
      _id: 'settings_app',
      predefEvents: {
        'demo_2015': 'Demo Event 2015'
      },
      raceProgression: defaults.raceProgression
    };


    //syncs up our local db to remote continuously, and retrying when it fails
    PouchDB.sync('sdba', remote, opts);

    //fetch the app settings from the db. if it doesnt exist, populate using default
    $rootScope.db.get('settings_app')
      .then(function(appSettings) {
        console.log("Existing AppSettings detected!");
        $rootScope.$apply($rootScope.settings = appSettings);
      })
      .catch(function(err) {
        if (err.status === 404) {
          $rootScope.db.put(defaultAppSettings)
            .then(function(response) {
              console.log('default settings set');

              $rootScope.db.get('settings_app')
                .then(function(appSettings) {
                  $rootScope.$apply($rootScope.settings = appSettings);
                });

            })
            .catch(function(err) {
              console.log(err);
            })
        }
      });

    //PouchDB.debug.enable('*');

    $rootScope.$on("$routeChangeSuccess", function(event,next,current){
      if(next.$$route.controller === 'EventViewCtrl') {
        $rootScope.display = true;
        $("body").addClass("no-bg");
      } else {
        $rootScope.display = false;
      }
    });

    //listen for app level setting changes
    $rootScope.changes = $rootScope.db.changes({
        since: 'now',
        live: true,
        include_docs: true,
        doc_ids: ['settings_app']
      })
      .on('change', function(newAppSettings) {
        console.log("settings changed");
        $rootScope.$apply($rootScope.appSettings = newAppSettings);
      })
      .on('error', function(err) {
        console.log(err);
      });

  })
  .controller('NavBarCtrl', function($scope, $window, $route) {

    $scope.hide = false;//$route.current.$$route.controller;

    $scope.$on("$routeChangeSuccess", function(event,next,current){
      if(next.$$route.controller === 'EventViewCtrl') {
        $scope.hide = true;
      } else {
        $scope.hide = false;
      }
    });

    $scope.back = function() {
      if ($route.current.$$route.originalPath !== "/")
        $window.history.back();
    }

    $scope.close = function() {
    };

  });
