/// <reference path="../../../typings/jquery/jquery.d.ts"/>
angular.module('sdbaApp')
  .controller('NewEventCtrl', function($scope, DBService, $location, defaults, $rootScope) {

    $rootScope.notCenter = false;


    var predefEvents = {};
    $scope.possibleEvents = {};
    $scope.chosenEvent = {};
    $scope.noEvents = true;

    DBService.db.get('settings_app')
      .then(function(settings) {
        predefEvents = settings.predefEvents;
        return DBService.getAllEvents();
      })
      .then(function(result) {
        if (result.rows.length === 0) {
          $scope.$apply($scope.possibleEvents = predefEvents);
          $scope.$apply($scope.noEvents = false);
        } else {
          var keyArr = [];
          _.forEach(result.rows, function(event) {
            keyArr.push(event.doc.eventID);
          });
          var r = _.omit(predefEvents, keyArr);

          if (Object.keys(r).length !== 0) {
            $scope.$apply($scope.noEvents = false);
          }

          $scope.$apply($scope.possibleEvents = r);
        }
      });

    $scope.selectEvent = function(key, val) {
      //add check here to ensure this event doesn't alrd exist!!
      $scope.chosenEvent.eventId = key;
      $scope.chosenEvent.name = val;
    }

    $scope.uploadExcel = function() {
      var chooser = $('#raceExcel');
      chooser.change(function(e) {

        var file = $(this).val();
        var xlsx = require('xlsx');
        var input = xlsx.readFile(file);

        console.log(input);

        var regList = xlsx.utils.sheet_to_json(input.Sheets[input.SheetNames[0]]),
          eventCat = xlsx.utils.sheet_to_json(input.Sheets[input.SheetNames[1]]),
          eventSchedule = xlsx.utils.sheet_to_json(input.Sheets[input.SheetNames[2]]);

        console.log(regList);
        console.log(eventCat);
        console.log(eventSchedule);

        //lets create the event settings first -
        var eventSettings = {
          name: $scope.chosenEvent.name,
          eventID: $scope.chosenEvent.eventId
        };

        //lets make this the active event
        DBService.setActiveEvent(eventSettings.eventID);

        //race schedule
        eventSettings.schedule = [];
        _.forEach(eventSchedule, function(item, index) {
          var e = {};
          e.id = item['Event No.'].trim();
          e.category = item['Category ID'];
          e.round = item['Round'];
          e.roundNo = parseInt(item['Round No.']);
          eventSettings.schedule.push(e);
        });
        console.log("Done configuring schedule");

        //categories
        //& FIGURE OUT QUICK ELIMINATION
        eventSettings.categories = {};
        _.forEach(eventCat, function(category) {
          var cat = {};
          //if the headings ever change, edit here.
          cat.id = category['ID'];
          cat.name = category['Category Name'];

          if (_.find(eventSettings.schedule, {
              'category': cat.id,
              'round': 'REPE'
            })) {
            //a REPECHAGE round exists
            //hence no quick elimination
            cat.quickElimination = false;
          } else {
            cat.quickElimination = true;
          }

          if (_.find(eventSettings.schedule, {
              'category': cat.id,
              'round': 'RND'
            })) {
            //a RND round exists
            //hence Rounds
            cat.rounds = true;
          } else {
            cat.rounds = false;
          }

          cat.lanes = 6;

          eventSettings.categories[category['ID']] = cat;

        });
        console.log("Done configuring categories");
        console.log(eventSettings);
        $scope.regList = regList;
        $scope.$apply($scope.e = eventSettings);
        $scope.$apply($scope.lane = true);
      });

      chooser.trigger('click');
    };

    $scope.selectLanes = function() {

      DBService.createEvent($scope.e)
        .then(function() {
          //add teams!!!
          var teams = [];
          _.forEach($scope.regList, function(team, index) {
            var t = {};
            t.name = team['Team Name'];
            t.teamID = index + 1;
            t.categories = {};

            //for every single category that exists, check if the team's col for that category isnt blank
            _.forEach($scope.e.categories, function(cat) {
              if (team.hasOwnProperty(cat.id)) {
                if (team[cat.id].trim()) {
                  var c = {
                    id: cat.id
                  }
                  t.categories[cat.id] = c;
                  console.log(t);
                }
              }
            });
            teams.push(t);
          });

          return DBService.addTeamsForEvent(teams, $scope.e.eventID);
        })
        .then(function() {
          //great joy!
          //now go to eventSettings page
          //either one of these has got to work.
          $scope.$apply($location.path('/event/settings'));
          $location.path('/event/settings');
        })
        .catch(function(e) {
          console.log(e);
        });

    }
  });
