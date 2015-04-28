/* Database Service */

angular.module('sdbaApp')
  .factory('DBService', function($rootScope,$q) {

    var opts = {
      continuous: true,
      retry: true
    };

    var activeEvent = "";
    var activeRace = "";

    return {
      //retrieve uses the id to get stuff in a performant manner
      //takes the id group as a arg (e.g. settings_event to retrieve event settings for all created events)
      retrieve: function(id, getdocs) {
        return $rootScope.db.allDocs({
          include_docs: getdocs,
          startkey: id + '_',
          endkey: id + '_\uffff'
        });
      },
      setActiveRace: function(raceId) {
        activeRace = raceId;
      },

      getTeams: function(getDocs) {
        return this.retrieve('team_' + activeEvent, getDocs);
      },

      getAllEvents: function() {
        return this.retrieve('settings_event', true);
      },

      createEvent: function(event) {
        return $rootScope.db.put(event,'settings_event_'+event.eventID);
      },

      addTeamsForEvent: function(teams, eventID) {
        _.forEach(teams, function(team){
          team._id = "team_" + eventID + '_' + team.teamID;
        });

        return $rootScope.db.bulkDocs(teams);
      },
      createRound: function(roundRaces) {
        _.forEach(roundRaces, function(race){
          race._id = "race_" + activeEvent + "_" + race.category + "_" + race.round + "_" + race.roundNo;
        });
        return $rootScope.db.bulkDocs(roundRaces);
      },
      getAllRacesOfRound: function(category,round) {
        return this.retrieve('race_' + activeEvent + '_' + category + '_' + round, true);
      },

      setActiveEvent: function(eventID) {
        activeEvent = eventID;
        return activeEvent;
      },

      getActiveEvent: function() {
        return $rootScope.db.get('settings_event_' + activeEvent);
      },

      getRace: function(eventID,scheduleItem) {
        return $rootScope.db.get('race_'+ eventID + '_' + scheduleItem.category +
       '_' + scheduleItem.round + '_' + scheduleItem.roundNo);

      },

      getTeamsFromArray: function(arr) {
        var teamArr = [];

        _.forEach(arr, function(val){
          teamArr.push('team_' + activeEvent + '_' + val);
        });

        return $rootScope.db.allDocs({
          include_docs: true,
          keys: teamArr
        });

      },

      getRaceTeams: function(race) {
        var teamArr = [];
        _.forEach(race, function(val,key){
          if(key.includes('LANE')) {
            teamArr.push('team_' + activeEvent + '_' + val);
          }
        });

        return $rootScope.db.allDocs({
          include_docs: true,
          keys: teamArr
        });
      },

      db: $rootScope.db

    };




  });
