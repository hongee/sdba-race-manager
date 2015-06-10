angular.module('sdbaApp')
  .controller('NewRoundCtrl', function($scope, DBService, $location, $rootScope, $route, $routeParams, $modal) {
    $rootScope.notCenter = true;
    $scope.races = [];
    $scope.promotions = [];

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.event = e);
        DBService.db.get($routeParams.raceID)
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

    $scope.getNext = function(team) {

      var lane = "";

      var round = {};
      _.forEach($scope.races, function(r) {

        _.forEach(r, function(value, key) {
          if (key.includes('LANE') && (value === team.teamID)) {
            lane = key.match(/\d+/)[0];
            round = r;
          }
        });

      });

      if (round.hasOwnProperty('round')) {
        return (round.round + ' ' + round.roundNo + ' LN:' + lane);
      }
    }

    $scope.print = function(fromConfirm) {

      console.log($scope.promotions);
      console.log($('.print-sel'));

      var tables = $('.print-sel');


      DBService.db.getAttachment($scope.event._id, 'templateHeader.jpg')
        .then(function(blob) {
          var pdf = new jsPDF("p", "pt", "a4");
          var reader = new FileReader();
          var header = function(x, y, width, height, key, value, settings) {
            pdf.setFillColor(230, 230, 230); // Asphalt
            pdf.setTextColor(0, 0, 0);
            pdf.setFontStyle('bold');
            pdf.rect(x, y, width, height, 'F');
            y += settings.lineHeight / 2 + pdf.internal.getLineHeight() / 2 - 2.5;
            pdf.text('' + value, x + settings.padding, y);
          }
          reader.onloadend = function() {
            var img = reader.result;
            pdf.addImage(img, 'JPEG', 0, 10, 595, 110);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(17);
            pdf.text($scope.event.categories[$scope.race.category].name + ' ' + $scope.race.round + ' is complete.', 30, 145);

            _.forEach($scope.promotions, function(value, key) {
              var offset = key === 0 ? 145 : 0;
              pdf.setFont("helvetica");
              pdf.setFontType("normal");
              pdf.setFontSize(12);
              pdf.text(value.statement, 30, pdf.autoTableEndPosY() + 30 + offset);
              var res = pdf.autoTableHtmlToJson(tables[key], true);

              console.log(res);
              //convert into nice timing
              _.forEach(res.data, function(i) {
                var t = i[4];
                t = parseFloat(t);

                if (typeof t === 'number') {
                  var minute = Math.floor(t / 60);

                  var second = t - (minute * 60);

                  if (minute > 0) {
                    if (second < 10) {
                      i[4] = minute + '.0' + second.toFixed(3);
                    } else {
                      i[4] = minute + '.' + second.toFixed(3);
                    }
                  } else {
                    if (second < 10) {
                      i[4] = '0.0' + second.toFixed(3);
                    } else {
                      i[4] = '0.' + second.toFixed(3);
                    }
                  }

                }

              })

              pdf.autoTable(res.columns, res.data, {
                startY: pdf.autoTableEndPosY() + 40 + offset,
                renderHeaderCell: header,
                avoidPageSplit: true
              });
            });
            if (!window.require) {
              pdf.save('progression_' + $scope.event.categories[$scope.race.category].name + '_' + $scope.race.round + '.pdf');
            } else {
              var output = pdf.output('datauristring');
              var data = output.split(',')[1];
              var buffer = new Buffer(data, 'base64');
              var path = require('path');
              var fs = require('fs');
              var p = path.join($rootScope.settings.pdfoutputd, ('progression_' + $scope.event.categories[$scope.race.category].name + '_' + $scope.race.round + '.pdf'));
              var nwGui = require('nw.gui');
              fs.writeFileSync(p, buffer);
              nwGui.Shell.openItem(p);
            }
          }
          reader.readAsDataURL(blob);

        });
    }

    $scope.confirm = function(isFinals) {
      //open the print page with all the teams of the next round
      //returns back to events
      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        if (r) {
          DBService.db.get($scope.event._id)
            .then(function(e) {
              console.log($scope.event);
              $scope.print(true);
              $scope.event._rev = e._rev;
              $scope.event.categories[$scope.race.category][$scope.race.round + '_generated'] = true;
              return DBService.db.put($scope.event);
            })
            .then(function() {
              if (isFinals) {
                $location.path('/event/manager/' + $scope.event.eventID);
                return;
              }

              DBService.createRound($scope.races)
                .then(function() {
                  $scope.$apply($location.path('/event/manager/' + $scope.event.eventID));
                }); //

            });
        }
      });

    };

    var displayFinalsWinner = function(round, cat) {
      var roundName = {
        RND2: 'final round',
        GNFN: 'Grandfinals',
        PLFN: 'Platefinals',
        MNFN: 'Minorfinals'
      }

      var roundName = roundName[round];

      DBService.getAllRacesOfRound($scope.race.category, round)
        .then(function(r) {

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

          _.remove(teams, function(team) {
            return team.categories[cat.id].hasOwnProperty('disqualified');
          });

          var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);

          var p = [];

          p.push({
            statement: "Results of the " + roundName,
            teams: sortedTeams
          });

          $scope.$apply($scope.promotions = p);
          $scope.$apply($scope.isFinals = true);
        });
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
          if (index % cat.progression[round] === (i - 1)) {
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
      $scope.$apply($scope.races = $scope.races);
      console.log($scope.races);
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
              if (cat.progression.hasOwnProperty("SEMI")) {
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
                    if (race.winner) {
                      winnersArr.push(race.winner);
                    }
                  });

                  var remainder = _.difference(teamIDArr, winnersArr);
                  return DBService.getTeamsFromArray(remainder);

                })
                .then(function(re) {
                  var teams = _.map(re.rows, function(r) {
                    return r.doc;
                  });

                  //remove dq'ed
                  _.remove(teams, function(team) {
                    return team.categories[cat.id].hasOwnProperty('disqualified');
                  });

                  //get fastest losers - rest seed into repe
                  var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);

                  //removing fastest losers
                  if (cat.quickElimination || !cat.progression.hasOwnProperty('REPE')) {
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
                  console.log(winnersArr);
                  //stores the fastest losers in event for future
                  DBService.getTeamsFromArray(winnersArr)
                    .then(function(r) {
                      var winTeams = _.map(r.rows, function(r) {
                        return r.doc;
                      });

                      console.log(winTeams);

                      var winTeamsS = _.sortBy(winTeams, 'latestTiming_' + cat.id);
                      var wt = winTeamsS;

                      console.log(winTeamsS);
                      console.log(winTeamsS.length);

                      cat['HEAT_winners'] = winTeamsS;
                      if (fl) {
                        cat['HEAT_fl'] = fl;
                      }

                      var p = [];
                      var nextName = (next === "SEMI") ? "Semifinals" : "finals";

                      if (!cat.progression.hasOwnProperty("SEMI") && !cat.progression.hasOwnProperty("GNFN") && !cat.progression.hasOwnProperty("REPE")) {

                        p.push({
                          statement: "As the remaining races have been canceled, the following are the race results:",
                          teams: winTeamsS
                        });
                        $scope.$apply($scope.promotions = p);
                        $scope.$apply($scope.isFinals = true);

                      } else {

                        if (next === "GNFN") {
                          winTeamsS = _.take(winTeamsS, cat.lanes);
                          if (winTeamsS.length === cat.lanes) {
                            fl = [];
                          }
                        }

                        p.push({
                          statement: "The following Heat winners are promoted to the " + nextName,
                          teams: winTeamsS
                        });

                        if (fl[0]) {
                          p.push({
                            statement: "The next fastest teams are also promoted to the " + nextName,
                            teams: fl
                          });
                        }

                        if (cat.progression.hasOwnProperty("REPE")) {

                          console.log("Seeding REPE with");
                          console.log(repeTeams);

                          p.push({
                            statement: "The following teams will proceed on to the Repechage",
                            teams: repeTeams
                          });

                          $scope.$apply($scope.promotions = p);

                          seedRound('REPE', cat, repeTeams);

                        } else {

                          var semiTeams = winTeamsS.concat(fl);
                          seedRound(next, cat, semiTeams);

                          if (next === "GNFN" && cat.progression.hasOwnProperty("MNFN")) {
                            //are there any spare in winners?
                            console.log("is contra!");

                            var allTeams = wt.concat(sortedTeams);

                            console.log("All Teams");
                            console.log(allTeams);

                            allTeams = _.drop(allTeams, semiTeams.length);

                            var mnfn = _.take(allTeams, cat.lanes);
                            allTeams = _.drop(allTeams, cat.lanes);

                            console.log("Mnfn");
                            console.log(mnfn);

                            p.push({
                              statement: "The follow teams are promoted to the Minorfinals",
                              teams: mnfn
                            })
                            seedRound("MNFN", cat, mnfn);

                            if (cat.progression.hasOwnProperty("PLFN")) {
                              var plfn = _.take(allTeams, cat.lanes);
                              p.push({
                                statement: "The follow teams are promoted to the Platefinals",
                                teams: plfn
                              })
                              seedRound("PLFN", cat, plfn);
                            }
                          }
                          $scope.$apply($scope.promotions = p);

                        }

                      }


                    })
                    .catch(function(err){
                      console.log(err);
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
                  //remove dq'ed
                  _.remove(teams, function(team) {
                    return team.categories[cat.id].hasOwnProperty('disqualified');
                  });

                  var sortedTeams = _.sortBy(teams, 'latestTiming_' + cat.id);

                  var p = [];
                  var next = "RND2";

                  if (!cat.progression.hasOwnProperty('RND2')) {
                    next = "GNFN";
                  }

                  p.push({
                    statement: "Round 1 has been completed with the following results",
                    teams: sortedTeams
                  });

                  $scope.$apply($scope.promotions = p);
                  seedRound(next, cat, sortedTeams);

                });
              break;
            case 'REPE':
              console.log("finished REPE");
              if (cat.progression.hasOwnProperty('SEMI')) {
                next = "SEMI";
                var quantity = (cat.progression.SEMI * cat.lanes);
              } else {
                next = "GNFN";
                var quantity = cat.lanes;
              }
              //how many people can I send?

              quantity -= (cat.HEAT_winners.length + cat.HEAT_fl.length);

              if (quantity < 0) {
                quantity = 0;
              }


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
                  //remove dq'ed
                  _.remove(teams, function(team) {
                    return team.categories[cat.id].hasOwnProperty('disqualified');
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

                  if (next == "SEMI" || (next == "GNFN" && cat.totalTeams < 13)) {
                    //scenario - all is normal
                    p.push({
                      statement: "The following Repechage teams have been promoted to " + nextName,
                      teams: promoted
                    });
                    seedRound(next, cat, toSeed);

                  } else {
                    //all is not normal, next is GNFN/nothing, when there is supposed to be SEMI
                    //aka SEMIs are canceled
                    if (cat.progression.hasOwnProperty('GNFN')) {
                      //GNFNs still exist so populate it with
                      var gnfn = _.take(toSeed, cat.lanes);
                      p.push({
                        statement: "The following teams have been promoted to the Grandfinals",
                        teams: gnfn
                      });
                      seedRound("GNFN", cat, gnfn);

                      toSeed = _.drop(toSeed, cat.lanes);

                      if (cat.progression.hasOwnProperty('MNFN')) {
                        //minor finals still exist
                        var mnfn = _.take(toSeed, cat.lanes);
                        //take as many as possible
                        if (mnfn.length < cat.lanes) {
                          var fromSorted = _.take(sortedTeams, (cat.lanes - mnfn.length));
                          sortedTeams = _.drop(sortedTeams, (cat.lanes - mnfn.length));
                        }

                        p.push({
                          statement: "The following teams have been promoted to the Minorfinals",
                          teams: mnfn.concat(fromSorted)
                        });
                        seedRound("MNFN", cat, mnfn.concat(fromSorted));

                        toSeed = _.drop(toSeed, cat.lanes);
                      }

                      if (cat.progression.hasOwnProperty('PLFN')) {
                        //plate finals still exist
                        var plfn = _.take(toSeed, cat.lanes);
                        //take as many as possible
                        if (plfn.length < cat.lanes) {
                          var fromSorted = _.take(sortedTeams, (cat.lanes - plfn.length));
                        }
                        p.push({
                          statement: "The following teams have been promoted to the Platefinals",
                          teams: plfn.concat(fromSorted)
                        });
                        seedRound("PLFN", cat, plfn.concat(fromSorted));
                      }

                    } else {
                      //GNFNs dont exist!
                      p.push({
                        statement: "As the Grandfinals have been canceled, the race results are as follows:",
                        teams: toSeed.concat(sortedTeams)
                      });
                      $scope.$apply($scope.isFinals = true);

                    }


                  }

                  $scope.$apply($scope.promotions = p);

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
                    if (race.winner) {
                      winnersArr.push(race.winner);
                    }
                  });
                  return DBService.getTeamsFromArray(semiArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  //remove dq'ed
                  _.remove(teams, function(team) {
                    return team.categories[cat.id].hasOwnProperty('disqualified');
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

                  var flToGf = cat.lanes - sortedWinners.length;

                  Array.prototype.push.apply(sortedWinners, _.take(sortedTeams, flToGf));
                  sortedTeams = _.drop(sortedTeams, flToGf);
                  Array.prototype.push.apply(minor, _.take(sortedTeams, cat.lanes));
                  sortedTeams = _.drop(sortedTeams, cat.lanes);
                  Array.prototype.push.apply(plate, _.take(sortedTeams, cat.lanes));

                  var p = [];


                  if (cat.progression.hasOwnProperty('GNFN')) {
                    seedRound("GNFN", cat, sortedWinners);
                    p.push({
                      statement: "The following teams have been promoted to the Grandfinals",
                      teams: sortedWinners
                    });
                  } else {
                    p.push({
                      statement: "As the Grandfinals have been canceled, the race results are as follows:",
                      teams: sortedWinners
                    });
                    $scope.$apply($scope.isFinals = true);
                  }

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

                  $scope.$apply($scope.promotions = p);

                });
              //Winners go GNFN, fill GN,MN with next fastest,
              break;
            case 'MNFN':
              displayFinalsWinner('MNFN', cat);
              //Nothing to do here
              //go back to event.js
              break;
            case 'GNFN':
              displayFinalsWinner('GNFN', cat);
              //Nothing to do here.
              //go back to event.js
              break;
            case 'RND2':
              console.log("finished RND2");
              DBService.getAllRacesOfRound($scope.race.category, 'RND2')
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
                  });
                  return DBService.getTeamsFromArray(semiArr);
                })
                .then(function(r) {
                  var teams = _.map(r.rows, function(r) {
                    return r.doc;
                  });

                  //remove dq'ed
                  _.remove(teams, function(team) {
                    return team.categories[cat.id].hasOwnProperty('disqualified');
                  });

                  //combine timings
                  _.forEach(teams, function(team) {
                    team.combinedRoundsTiming = team['latestTiming_' + cat.id] + team.categories[cat.id].RND.time;
                  });

                  var sortedTeams = _.sortBy(teams, 'combinedRoundsTiming');

                  var p = [];

                  if (cat.progression.hasOwnProperty('GNFN')) {
                    seedRound("GNFN", cat, sortedTeams);
                    p.push({
                      statement: "The following teams have been promoted to the Grandfinals",
                      teams: sortedTeams
                    });
                  } else {
                    p.push({
                      statement: "As the Grandfinals have been canceled, the race results are as follows:",
                      teams: sortedTeams
                    });
                    $scope.$apply($scope.isFinals = true);
                  }

                  $scope.$apply($scope.promotions = p);

                });
              break;
            case 'PLFN':
              displayFinalsWinner('PLFN', cat);
              break;
          }
        });

    };


  });
