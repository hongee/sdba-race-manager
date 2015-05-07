/* Database Service */

angular.module('sdbaApp')
  .factory('DBService', function($rootScope,$q) {

    var opts = {
      continuous: true,
      retry: true
    };

    var activeEvent = "";
    var activeRace = "";
    var isNewRound = false;

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

      newRoundReturn: isNewRound,

      setActiveRace: function(raceId) {
        activeRace = raceId;
      },

      getTeams: function(getDocs) {
        return this.retrieve('team_' + activeEvent, getDocs);
      },

      getAllEvents: function() {
        return this.retrieve('settings_event', true);
      },

      getAllRaces: function(getDocs) {
        return this.retrieve('race_' + activeEvent, getDocs);
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
            teamArr.push({key: parseInt(key.match(/\d+/)[0]) , team: 'team_' + activeEvent + '_' + val});
          }
        });

        var r = _.map(_.sortBy(teamArr,'key'), function(team){
          return team.team;
        });

        console.log(r);

        return $rootScope.db.allDocs({
          include_docs: true,
          keys: r
        });
      },

      deleteEvent: function(event) {
        var d = $q.defer();
        var thingsToDelete = [];

        var ref = this;

        this.getTeams(false)
        .then(function(results){
          console.log(results);
          Array.prototype.push.apply(thingsToDelete,results.rows);
          return ref.getAllRaces(false);
        })
        .then(function(results){
          console.log(results);
          Array.prototype.push.apply(thingsToDelete,results.rows);
          return ref.getActiveEvent();
        })
        .then(function(event){
          var things = _.map(thingsToDelete, function(thing) {
            var t = {
              _id: thing.id,
              _rev: thing.value.rev
            }

            return t;
          });

          things.push(event);
          _.forEach(things, function(item){
            item._deleted = true;
          });
          console.log(things);
          return ref.db.bulkDocs(things);
        })
        .then(function(){
          d.resolve();
        })
        .catch(function(err){
          console.log(err);
          d.reject(err);
        });

        return d.promise;
      },
      //this has nothing to do with DB but im lazy to create another service
      validateSchedule : function(event) {

      var errors = [];

      var order =
      ["HEAT",
        "RND",
        "RND2",
        "FLH",
        "REPE",
        "SEMI",
        "PLFN",
        "MNFN",
        "GNFN"];


      //is the schedule wonky?
      var r = _.reduce(event.schedule, function(results, item, index) {

        var thisValue = _.indexOf(order, item.round);

        if(item.round === "PLFN" || item.round === "MNFN") {
          thisValue = 8;
        }

        if (!results.hasOwnProperty(item.category)) {
          results[item.category] = thisValue
          return results;
        } else if (results[item.category] <= thisValue) {
          //the last round is a lower or equal round - OK
          results[item.category] = thisValue;
          return results;
        } else {
          //the last round is a greater round! im out of place!
          if (results.hasOwnProperty("fail")) {
            results.fail.push(item);
            return results;
          } else {
            results.fail = [item];
            return results;
          }
        }

      },{});

      console.log(r);

      if (r.hasOwnProperty("fail")) {
        _.forEach(r.fail, function(item) {
          errors.push({
            type: 500,
            category: item.category,
            round: item.round,
            roundNo: item.roundNo
          });
        });
      }


      _.forEach(event.categories, function(category) {
        _.forEach(category.progression, function(roundNo, round) {

          var ignore = ["FLH", "max_teams"];
          if (_.includes(ignore, round)) {
            return;
          }

          var scheduledItems = _.sortBy(_.filter(event.schedule, {
            'category': category.id,
            'round': round
          }), 'roundNo');

          //are there missing items?
          for (var i = 1; i <= roundNo; i++) {

            var filtered = _.filter(scheduledItems, {
              'roundNo': i
            });

            if (filtered.length === 0) {
              //missing
              errors.push({
                type: 404,
                category: category.id,
                round: round,
                roundNo: i
              });
            } else if (filtered.length > 1) {
              //duplicates
              errors.push({
                type: 405,
                category: category.id,
                round: round,
                roundNo: i
              });
            }

          }

          var checkExtra = function(c) {
            if (scheduledItems[c].roundNo > roundNo) {
              //extra
              errors.push({
                type: 403,
                category: category.id,
                round: round,
                roundNo: scheduledItems[c].roundNo
              });
              checkExtra(c - 1);
            } else {
              return;
            }
          }

          //are there extra items?
          if (scheduledItems.length > roundNo) {
            checkExtra(scheduledItems.length - 1);
          }

        });
      });

      return errors;

    },


      db: $rootScope.db

    };




  });
