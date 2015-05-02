angular.module('sdbaApp')
  .controller('EventViewCtrl', function($scope,DBService,$routeParams) {
    console.log($routeParams);
    //great! now load the entire event
    //the params passed should be the event id

    $scope.event = {};

    var loadAll = function() {
      DBService.setActiveEvent($routeParams.eventID)
      DBService.getActiveEvent()
      .then(function(event){
        $scope.$apply($scope.event = event);
        //get all the races of each category - then sort them into the respective
        console.log(event);
        _.forEach($scope.event.categories, function(cat) {
          cat.races = {};
          _.forEach(cat.progression, function(val, round) {
            //irrelevant keys to ignore
            var ignore = ["FLH","max_teams"];
            if(_.includes(ignore,round)) {
              return;
            } else {
              DBService.getAllRacesOfRound(cat.id,round)
              .then(function(r){
                var races = _.map(r.rows, function(race){
                  return race.doc;
                });
                _.forEach(races, function(race) {
                  DBService.getRaceTeams(race)
                  .then(function(t){
                    var teams = _.map(t.rows, function(team){
                      return team.doc;
                    });
                    race.teams = teams;
                    cat.races[round] = races;
                    console.log(cat);
                  });
                })

              });
            }

          });
        });

      });
    }

    loadAll();
  });
