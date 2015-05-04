angular.module('sdbaApp')
  .controller('NewRoundCtrl', function($scope, DBService, $location, $rootScope, $route) {

    $scope.races = [];
    $scope.promotions = [];

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.event = e);
        DBService.db.get(e.activeRace)
          .then(function(r) {
            $scope.$apply($scope.race = r);
            generateNextRound();
          })
          .catch(function(err) {
            console.log(err);
          });
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });


    $scope.confirm = function() {
      //open the print page with all the teams of the next round
      //returns back to events
      DBService.createRound($scope.races)
        .then(function() {
          DBService.newRoundReturn = true;
          console.log("success");
          $location.path("/event");
        }); //
    }

    var seedRound = function(round, cat, teams, sort) {

      console.log("Order");
      console.log(teams);

      if (cat.lanes === 4) {
        var seedOrder = [3, 2, 4, 1];
      } else {
        var seedOrder = [3, 4, 2, 5, 1, 6];
      }

      var races = [];
      //sort teams by time
      //only sort if requested
      if (sort) {
        var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);
      }

      for (var i = 1; i <= cat.progression[round]; i++) {
        var event = {
          round: round,
          category: cat.id,
          roundNo: i
        };

        _.forEach(_.filter(teams, function(val, index) {
          if ((index - i - 1) % cat.progression[round] === 0) {
            return true;
          }
        }), function(team, index) {
          var laneno = seedOrder[index];
          event['LANE_' + laneno] = team.teamID;
        });

        races.push(event);
      };
      console.log("Seeding the next round in this order");
      console.log(races);

      Array.prototype.push.apply($scope.races, races);
    };

    var generateNextRound = function() {
      //what round is this?
      //Race Progression Logic lies here
      DBService.getTeams(true)
        .then(function(r) {
          console.log(r);
          var teams = _.map(r.rows, function(t) {
            return t.doc;
          });

          var cat = $scope.event.categories[$scope.race.category];
          var next = "";
          console.log(cat);

          switch ($scope.race.round) {
            case 'HEAT':
              console.log("finished heats");
              //populate REPE first
              var teamIDArr = [];
              var winnersArr = [];

              //is there a SEMI?
              if(cat.progression.hasOwnProperty("SEMI")) {
                next = "SEMI";
              } else {
                next = "GNFN";
              }

              //remove winning teams
              DBService.getAllRacesOfRound($scope.race.category, 'HEAT')
                .then(function(r) {
                  //yay all heats
                  console.log("result of all race");
                  console.log(r);
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  })
                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        teamIDArr.push(val);
                      }
                    });
                    winnersArr.push(race.winner);
                  });
                  var remainder = _.difference(teamIDArr, winnersArr);
                  return DBService.getTeamsFromArray(remainder);

                })
                .then(function(re) {
                  var teams = _.map(re.rows, function(r) {
                    return r.doc;
                  });
                  //get fastest losers - rest seed into repe
                  var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);

                  //removing fastest losers
                  if (cat.quickElimination) {
                    var noFl = (cat.progression[next] * cat.lanes) - winnersArr.length;
                    var fl = _.take(sortedTeams, noFl);
                    console.log("FLH: " + noFl);
                  } else if (cat.progression.hasOwnProperty('FLH')) {
                    console.log("FLH: " + cat.progression.FLH);
                    var fl = _.take(sortedTeams, cat.progression.FLH);
                    var repeTeams = _.drop(sortedTeams, cat.progression.FLH);
                  } else {
                    var repeTeams = sortedTeams;
                  }

                  //convert winners id into teams

                  //stores the fastest losers in event for future
                  DBService.getTeamsFromArray(winnersArr)
                    .then(function(r) {
                      var winTeams = _.map(r.rows, function(r) {
                        return r.doc;
                      });

                      var winTeamsSorted = _.sortBy(winTeams, 'latestTiming_' + cat.id);

                      cat['HEAT_winners'] = winTeamsSorted;
                      cat['HEAT_fl'] = fl;

                      console.log("Seeding REPE with");
                      console.log(repeTeams);

                      var p = [];
                      var nextName = (next === "SEMI") ? "Semifinals" : "Grandfinals";

                      p.push({
                        statement: "The following Heat winners are promoted to the " + nextName,
                        teams: winTeamsSorted
                      });

                      p.push({
                        statement: "The next fastest teams are also promoted to the " + nextName,
                        teams: fl
                      });

                      if (cat.progression.hasOwnProperty("REPE")) {
                        p.push({
                          statement: "The following teams will proceed on to the Repechage",
                          teams: repeTeams
                        });

                        $scope.$apply($scope.promotions = p);

                        seedRound('REPE', cat, repeTeams);

                      } else {
                        var semiTeams = Array.prototype.push.apply(winTeamsSorted, fl);
                        $scope.$apply($scope.promotions = p);
                        seedRound(next, cat, semiTeams);
                      }

                    });
                })
                .catch(function(err) {
                  console.log(err);
                });
              break;
            case 'RND':

              DBService.getAllRacesOfRound($scope.race.category, 'RND')
                .then(function(r) {
                  //yay all RNDS
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var rndArr = [];

                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        rndArr.push(val);
                      }
                    });
                  });
                  return DBService.getTeamsFromArray(rndArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });
                  var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);

                  var p = [];

                  p.push({
                    statement: "Round 1 has been completed with the following results",
                    teams: sortedTeams
                  });

                  $scope.$apply($scope.promotions = p);
                  seedRound('RND2', cat, sortedTeams);

                });
              break;
            case 'REPE':
              console.log("finished REPE");
              if (cat.progression.hasOwnProperty('SEMI')) {
                next = "SEMI";
                //no. I can send
                var quantity = (cat.progression.SEMI * cat.lanes);
              } else {
                next = "GNFN";
                var quantity = cat.lanes;
              }
              //how many people can I send?
              quantity -= (cat.HEAT_winners.length + cat.HEAT_fl.length);


              DBService.getAllRacesOfRound($scope.race.category, 'REPE')
                .then(function(r) {
                  //yay all REPEs
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var repeArr = [];

                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        repeArr.push(val);
                      }
                    });
                  });
                  return DBService.getTeamsFromArray(repeArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });
                  var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);
                  var promoted = _.take(sortedTeams, quantity);

                  //as per rules - Sorted heat winners, FLs (already sorted), current promotees
                  var toSeed = [];
                  Array.prototype.push.apply(toSeed, cat.HEAT_winners);
                  Array.prototype.push.apply(toSeed, cat.HEAT_fl);
                  Array.prototype.push.apply(toSeed, promoted);

                  var nextName = (next == "GNFN") ? "Grandfinals" : "Semifinals";

                  var p = [];

                  p.push({
                    statement: "The following Repechage teams have been promoted to " + nextName,
                    teams: toSeed
                  });

                  seedRound(next, cat, toSeed);
                });
              break;
            case 'SEMI':
              console.log("finished SEMI");
              var winnersArr = [];
              var minor = [];
              var plate = [];
              DBService.getAllRacesOfRound($scope.race.category, 'SEMI')
                .then(function(r) {
                  var races = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var semiArr = [];
                  _.forEach(races, function(race) {
                    _.forEach(race, function(val, key) {
                      if (key.includes('LANE')) {
                        semiArr.push(val);
                      }
                    });
                    winnersArr.push(race.winner);
                  });
                  return DBService.getTeamsFromArray(semiArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  var winnerTeams = _.filter(teams, function(team) {
                    return _.includes(winnersArr, team.teamID);
                  });

                  var rTeams = _.filter(teams, function(team) {
                    return !(_.includes(winnersArr, team.teamID));
                  });

                  var sortedWinners = _.sortBy(winnerTeams, 'latestTiming_' + cat.id);
                  var sortedTeams = _.sortBy(rTeams, 'latestTiming_' + cat.id);

                  //put first 6 into grand
                  Array.prototype.push.apply(sortedWinners, _.take(sortedTeams, cat.lanes - sortedWinners.length));
                  sortedTeams = _.drop(sortedTeams, cat.lanes - sortedWinners.length);
                  Array.prototype.push.apply(minor, _.take(sortedTeams, cat.lanes));
                  sortedTeams = _.drop(sortedTeams, cat.lanes - cat.lanes);
                  Array.prototype.push.apply(plate, _.take(sortedTeams, cat.lanes));

                  var p = [];

                  seedRound("GNFN", cat, sortedWinners);
                  p.push({
                    statement: "The following teams have been promoted to the Grandfinals",
                    teams: sortedWinners
                  });

                  if (cat.progression.hasOwnProperty('MNFN')) {
                    seedRound("MNFN", cat, minor);
                    p.push({
                      statement: "The following teams have been promoted to the Minorfinals",
                      teams: minor
                    });
                  }

                  if (cat.progression.hasOwnProperty('PLFN')) {
                    seedRound("PLFN", cat, plate);
                    p.push({
                      statement: "The following teams have been promoted to the Platefinals",
                      teams: plate
                    });
                  }


                });
              //Winners go GNFN, fill GN,MN with next fastest,
              break;
            case 'MNFN':

              //Nothing to do here
              //go back to event.js
              break;
            case 'GNFN':

              //Nothing to do here.
              //go back to event.js

              break;
            case 'RND2':
              //promote to GNFN??
              break;
          }
        });

    };


  });
