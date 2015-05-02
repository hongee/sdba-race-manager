/// <reference path="../../../typings/jquery/jquery.d.ts"/>
angular.module('sdbaApp')
  .controller('NewEventCtrl', function($scope,DBService,$location,defaults) {

    var predefEvents = {};
    $scope.possibleEvents = {};
    $scope.chosenEvent = {};
    $scope.noEvents = true;

    DBService.db.get('settings_app')
    .then(function(settings){
      predefEvents = settings.predefEvents;
      return DBService.getAllEvents();
    })
    .then(function(result){
      if(result.rows.length === 0) {
        $scope.$apply($scope.possibleEvents = predefEvents);
      } else {
        var keyArr = [];
        _.forEach(result.rows, function(event){
          keyArr.push(event.doc.eventID);
        });
        var r = _.omit(predefEvents,keyArr);

        if(Object.keys(r).length !== 0) {
          $scope.noEvents = false;
        }

        $scope.$apply($scope.possibleEvents = r);
      }
    });

    $scope.selectEvent = function(key,val) {
      //add check here to ensure this event doesn't alrd exist!!
      $scope.chosenEvent.eventId = key;
      $scope.chosenEvent.name = val;
    }

    $scope.uploadExcel = function() {
      var chooser = $('#raceExcel');
      chooser.change(function(e){

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

        //categories
        eventSettings.categories = {};
        _.forEach(eventCat, function(category){
          var cat = {};
          //if the headings ever change, edit here.
          cat.id = category['ID'];
          cat.name = category['Category Name'];
          eventSettings.categories[category['ID']] = cat;
        });
        console.log("Done configuring categories");

        //race schedule
        eventSettings.schedule = [];
        _.forEach(eventSchedule, function(item,index){
          var e = {};
          e.id = parseInt(item['Event No.']);
          e.category = item['Category ID'];
          e.round = item['Round'];
          e.roundNo = parseInt(item['Round No.']);
          eventSettings.schedule.push(e);
        });
        console.log("Done configuring schedule");

        console.log(eventSettings);
        DBService.createEvent(eventSettings)
        .then(function(){
          //add teams!!!
          var teams = [];
          _.forEach(regList, function(team,index){
            var t = {};
            t.name = team['Team Name'];
            t.teamID = index + 1;
            t.categories = {};

            //for every single category that exists, check if the team's col for that category isnt blank
            _.forEach(eventSettings.categories, function(cat){
              if(team.hasOwnProperty(cat.id)) {
                if(team[cat.id].trim()) {
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

          return DBService.addTeamsForEvent(teams,eventSettings.eventID);
        })
        .then(function(){
          //great joy!
          //now go to eventSettings page
          //either one of these has got to work.
          $scope.$apply($location.path('/event/settings'));
          $location.path('/event/settings');
        })
        .catch(function(e){
          console.log(e);
        });

      });

      chooser.trigger('click');
    };

  });
