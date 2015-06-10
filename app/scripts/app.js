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
    'ui.bootstrap',
    'ui.sortable'
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
      .when('/event/nextround/:raceID', {
        templateUrl: 'views/completeround.html',
        controller: 'NewRoundCtrl'
      })
      .when('/event/generate', {
        templateUrl: 'views/firstround.html',
        controller: 'FirstRndCtrl'
      })
      .when('/event/schedule', {
        templateUrl: 'views/eventschedule.html',
        controller: 'EventScheduleCtrl'
      })
      .when('/event/manager/:eventID', {
        templateUrl: 'views/eventmanager.html',
        controller: 'EventManagerCtrl'
      })
      .when('/event/view/:eventID/:category?/:round?', {
        templateUrl: 'views/eventview.html',
        controller: 'EventViewCtrl'
      })
      .when('/print/:type/:eventID/:category?/:round?/:roundNo?', {
        templateUrl: 'views/_template.print.html',
        controller: 'PrintCtrl'
      })

      .when('/event', {
        templateUrl: 'views/event.html',
        controller: 'EventCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  })
  .run(function($rootScope, defaults) {
    //future - this ideally should be wrapped in a service instead of being dumped into global
    $rootScope.db = new PouchDB('sdba');
    //so secure!!!! for future deployment put a password screen before the app to enable sync
    var remote = 'https://sdba:90688625@sdba.cloudant.com/sdba',
      opts = {
        live: true,
        retry: true
      };

    if (window.require) {
      //release platform
      if (require('os').platform() === 'win32') {
        remote = 'http://192.168.1.5:5984/sdba';
      }
    }

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

    var remoteDB = new PouchDB(remote);

    //syncs up our local db to remote continuously, and retrying when it fails
    PouchDB.sync('sdba', remoteDB, opts);

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

    $rootScope.$on("$routeChangeSuccess", function(event, next, current) {

      if (next.$$route.controller === 'EventViewCtrl' || next.$$route.controller === 'PrintCtrl') {
        $rootScope.display = true;
        $("body").addClass("no-bg");
      } else {
        $rootScope.display = false;
      }
    });


    //listen for app level setting changes
    /*
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
    */

  })
  .controller('NavBarCtrl', function($scope, $window, $route, $rootScope) {

    console.log($route.current);

    $scope.updates = 0;

    var changes = $rootScope.db.changes({
      since: 'now',
      live: true
    }).on('change', function(change){
      console.log("update received");
      $scope.$apply($scope.updates+=1);
    });

    $scope.openDevTools = function() {
      if(window.require){
        var n = require('nw.gui').Window.get().showDevTools();
      }
    }

    $scope.hide = false; //$route.current.$$route.controller;

    $scope.$on("$routeChangeSuccess", function(event, next, current) {
      if (next.$$route.controller === 'EventViewCtrl' || next.$$route.controller === 'PrintCtrl') {
        $scope.hide = true;
      } else {
        $scope.hide = false;
      }

      var disabledBack = ['EventCtrl','MainCtrl'];

      if (_.includes(disabledBack,next.$$route.controller)) {
        $scope.hideBack = true;
      } else {
        $scope.hideBack = false;
      }

      if(next.$$route.controller === 'EventCtrl') {
        $scope.hideRefresh = true;
      } else {
        $scope.hideRefresh = false;
      }

    });

    $scope.back = function() {
        $window.history.back();
    }

    $scope.reload = function() {
      $scope.updates = 0;
      $route.reload();
    }

    $scope.fullscreen = function() {
      if(window.require) {
        var gui = require('nw.gui');
        var win = gui.Window.get();

        win.toggleFullscreen();
      }
    }

    $scope.close = function() {
      if(window.require) {
        var gui = require('nw.gui');
        var win = gui.Window.get();

        win.close();
      }
    };



  })
  .filter('orderByRounds', function() {
    return function(input) {
      var output = [];

      var arr = _.map(input, function(item, key) {
        //key is RND, GNFN etc
        var order = ["HEAT", "RND", "RND2", "REPE", "SEMI", "PLFN", "MNFN", "GNFN"];

        item.keyIndex = _.indexOf(order, key);
        item.round = key;
        return item;
      });

      output = _.sortBy(arr, 'keyIndex');

      return output;
    }
  });
