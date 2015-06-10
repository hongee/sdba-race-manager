/// <reference path="../../../typings/lodash/lodash.d.ts"/>
angular.module('sdbaApp')
  .controller('EventSettingsCtrl', function($scope, DBService, $location, $rootScope, defaults, $modal, $route) {
    $rootScope.notCenter = true;

    $scope.eventSettings = {};
    $scope.confirmDeleteString = "";

    DBService.getActiveEvent()
      .then(function(e) {
        $scope.$apply($scope.eventSettings = e);
        if ($scope.eventSettings.hasOwnProperty('progressionGenerated')) {
          DBService.retrieve("race_" + $scope.eventSettings.eventID)
            .then(function(e) {
              console.log(e);
              if (e.rows.length !== 0) {
                $scope.$apply($scope.prior = true);
              }
              return DBService.db.getAttachment($scope.eventSettings._id, 'templateHeader.jpg');
            })
            .then(function(blob) {
              var url = URL.createObjectURL(blob);
              var img = $('#previewImg')[0];
              img.src = url;
            })
            .catch(function(err) {
              console.log(err);
            });
        } else {
          setRaceProgression();
        }
      })
      .catch(function(err) {
        console.log(err);
        $location.path("/");
      });

    $scope.toggleDev = function() {
      DBService.db.get($scope.eventSettings._id)
        .then(function(e) {
          if (e.devMode) {
            e.devMode = false;
          } else {
            e.devMode = true;
          }

          return DBService.db.put(e);
        })
        .then(function() {
          $route.reload();
        })
    }


    $scope.setActiveRace = function() {

      var event = {};

      DBService.db.get($scope.eventSettings._id)
        .then(function(e) {

          var item = _.find(e.schedule, {'id':$scope.setRaceField})

          if (item) {
            event = e;
            return DBService.getRace(e.eventID, item)
          } else {
            throw new Error('Invalid Race Item');
          }
        })
        .then(function(race) {

          var nextRace = race;

          console.log(nextRace);

          event.activeRace = nextRace._id;

          return DBService.db.put(event);
        })
        .then(function() {
          console.log("successfully updated!");
          $route.reload();
        })
        .catch(function(err) {
          if (err.status == 404) {
            //event doesnt exist in schedule
            alert("Race Was Not Found")
            console.log(e.schedule[currentIndex + 1]);
            console.log("Was Not Found!");
          } else {
            alert(err);
            console.log(err);
          }
        });

    }


    $scope.saveEventTemplateSettings = function() {

      var img = $('#previewImg')[0];
      $scope.eventTemplateUpdated = false;


      blobUtil.imgSrcToDataURL(img.src, 'image/jpeg', {
          crossOrigin: 'Anonymous'
        })
        .then(function(data) {

          DBService.db.get($scope.eventSettings._id)
            .then(function(event) {
              event.chiefJudge = $scope.eventSettings.chiefJudge;
              event.chiefOfficial = $scope.eventSettings.chiefOfficial;
              event._attachments = {
                "templateHeader.jpg": {
                  "content_type": "image/jpeg",
                  "data": data.split(',')[1]
                }
              };

              return DBService.db.put(event);
            })
            .then(function(r) {
              $scope.eventTemplateUpdated = true;
              $scope.eventSettings._rev = r.rev;
            })
            .catch(function(err) {
              console.log(err);
            });

        })
        .catch(function(err) {
          console.log(err);
        });
    }

    $scope.cancelRound = function(category, round) {
      var confirmationDialog = $modal.open({
        templateUrl: 'views/_partials.confirmation.html',
        controller: 'ConfirmationCtrl',
        size: 'sm'
      });

      confirmationDialog.result.then(function(r) {
        if (r) {
          DBService.db.get($scope.eventSettings._id)
            .then(function(event) {

              var cat = event.categories[category];

              console.log(category);
              console.log(round);
              console.log(cat);

              var remove = function(rounds) {
                _.forEach(rounds, function(r) {
                  /*
                  //FLH is void - recalculate no. of REPE, add errors to schedule
                  if (r === "FLH" && cat.progression.hasOwnProperty("REPE")) {
                    var newRepe = Math.ceil((cat.totalTeams - cat.progression.HEAT) / cat.lanes);
                    if (newRepe > cat.progression.REPE) {
                      var oldRepe = cat.progression.REPE;
                      cat.progression.REPE = newRepe;

                      if (!event.scheduleErrors) {
                        event.scheduleErrors = [];
                      }

                      while (newRepe > oldRepe) {
                        event.scheduleErrors.push({
                          type: 404,
                          category: category,
                          round: "REPE",
                          roundNo: newRepe
                        });
                        newRepe--;
                      }
                    }
                  }
                  */

                  if (cat.progression.hasOwnProperty(r)) {
                    delete cat.progression[r];
                  }
                });

                var k = _.remove(event.schedule, function(item) {
                  if (item.category === category) {
                    return _.includes(rounds, item.round);
                  }
                });

                //just in case, yknow

                _.remove(event.scheduleErrors, function(item) {
                  if (item.category === category) {
                    return _.includes(rounds, item.round);
                  }
                });

                console.log(k);

              }

              switch (round) {
                case 'RND':
                  //RND 1 is canceled -> delete RND & RND2
                  //clone RND 1 to GNFN
                  remove(["RND", "RND2"]);
                  break;
                case 'REPE':
                  remove(["REPE"]);
                  cat["HEAT_generated"] = false;
                  cat.quickElimination = true;
                  break;
                case 'RND2':
                  remove(["RND2"]);
                  cat["RND_generated"] = false;
                  break;
                case 'SEMI':
                  remove(["SEMI"]);
                  if (cat.progression.hasOwnProperty("REPE")) {
                    //REPE still exists
                    cat["REPE_generated"] = false;
                  } else {
                    cat["HEAT_generated"] = false;
                  }
                  break;
                case 'PLFN':
                  remove(["PLFN"]);
                  break;
                case 'MNFN':
                  remove(["MNFN"]);
                  break;
                case 'GNFN':
                  remove(["GNFN"]);
                  if (cat.progression.hasOwnProperty("SEMI")) {
                    //if semis exists, SEMIs will be used to populate gnfn
                    cat["SEMI_generated"] = false;
                  } else if (cat.progression.hasOwnProperty("REPE")) {
                    //if semis dont exist, REPEs are used to populate
                    cat["REPE_generated"] = false;
                  } else {
                    //if REPEs dont exist its heats
                    cat["HEAT_generated"] = false;
                  }
                  break;
              }

              return DBService.db.put(event);
            })
            .then(function() {
              if (round === 'RND') {
                DBService.getAllRacesOfRound(category, "RND")
                  .then(function(r) {
                    var race = r.rows[0].doc;
                    delete race._rev;
                    delete race._id;
                    race.round = "GNFN";
                    race.roundNo = 1;

                    return DBService.createRound([race]);
                  })
                  .then(function() {
                    $route.reload();
                  });

              } else {
                $route.reload();
              }
            })
        }
      });

    }

    $scope.uploadEventTemplate = function() {
      var chooser = $('#eTemplateSelector');

      /*
      var convertImgToData = function(img, callback) {
        var canvas = d;
        var context = canvas.getContext('2d');
        context.drawImage(img, 0, 0);

        var data = canvas.toDataURL();

        canvas = null;

        callback(data);
      }
      */

      chooser.change(function(e) {
        var loc = $(this).val();

        $('#previewImg')[0].src = loc;
      });

      chooser.trigger('click');
    }

    var calculateRaceProgression = function(teams, lanes, cat) {
      if (lanes === 6) {
        lanes = "six"
      } else {
        lanes = "four"
      }
      var setting = _.find(defaults.raceProgression[lanes], function(val) {
        return teams <= val.max_teams;
      });

      //number of repe is variable - set repechage & FL
      //ANY DYNAMIC ROUND GENERATION GOES HERE -
      //AFT THIS, THIS SHALL BE THE SOURCE OF TRUTH

      /*
      if(lanes == 6) {
        if(setting.hasOwnProperty('REPE')) {
          var repe = setting.
        }
      } else {
        //4 lanes repechage - not known yet
      }
      */

      if (cat.quickElimination) {
        if (setting.hasOwnProperty('REPE')) {
          delete setting.REPE;
        }
      }

      if (cat.rounds) {
        return setting.alt;
      } else {
        return setting;
      }

    };

    var setRaceProgression = function() {
      DBService.getTeams(true)
        .then(function(teams) {

          var ts = _.map(teams.rows, function(val) {
            return val.doc;
          });

          _.forEach($scope.eventSettings.categories, function(category) {
            var teamsInThisCat = _.filter(ts, function(t) {
              return t.categories.hasOwnProperty(category.id);
            });

            category.totalTeams = teamsInThisCat.length;
          });

          _.forEach($scope.eventSettings.categories, function(c) {
            //set default lanes to 6 - allow this to be changed in options later;
            c.progression = calculateRaceProgression(c.totalTeams, c.lanes, c);
          });
          //uncomment this!
          /*


            FOR TESTING RMB TO DISABLE THIS


           */
          $scope.eventSettings.progressionGenerated = true;

          $scope.eventSettings.scheduleErrors = DBService.validateSchedule($scope.eventSettings);

          return DBService.db.put($scope.eventSettings);
        })
        .then(function(results) {
          //update _rev;
          console.log(results);
          $scope.eventSettings._rev = results.rev;
          $scope.$apply($scope.eventSettings = $scope.eventSettings);
        });
    };


    $scope.deleteEvent = function() {
      console.log($scope.eventSettings);
      DBService.deleteEvent()
        .then(function() {
          console.log("Event successfully deleted");
          $location.path("/");
        })
        .catch(function(err) {
          console.log(err);
          $location.path("/");
        });
    };

  });
