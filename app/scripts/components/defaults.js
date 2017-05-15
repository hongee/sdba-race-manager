angular.module('sdbaApp')
  .constant('defaults',
{
      raceProgression: {
        four: [{
            max_teams: 4,
            GNFN: 1,
            alt: {
              RND: 1,
              RND2: 1,
              GNFN: 1
              }
            },{
              max_teams: 6,
              HEAT: 2,
              REPE: 1,
              GNFN: 1
            },{
              max_teams: 8,
              HEAT: 2,
              REPE: 2,
              GNFN: 1
            },{
              max_teams: 12,
              HEAT: 3,
              FLH: 1,
              REPE: 2,
              SEMI: 2,
              GNFN: 1
            },{
              max_teams: 16,
              HEAT: 4,
              REPE: 3,
              SEMI: 2,
              GNFN: 1
            },{
              max_teams: 20,
              HEAT: 5,
              FLH: 3,
              REPE: 3,
              SEMI: 3,
              MNFN: 1,
              GNFN: 1
            },{
              max_teams: 24,
              HEAT: 6,
              FLH: 2,
              REPE: 4,
              SEMI: 3,
              MNFN: 1,
              GNFN: 1
            },{
              max_teams: 28,
              HEAT: 7,
              FLH: 5,
              REPE: 4,
              SEMI: 4,
              PLFN: 1,
              MNFN: 1,
              GNFN: 1
            },{
              max_teams: 32,
              HEAT: 8,
              FLH: 4,
              REPE: 5,
              SEMI: 4,
              PLFN: 1,
              MNFN: 1,
              GNFN: 1
            }
        ],
        six: [{
            max_teams: 6,
            GNFN: 1,
            alt: {
              RND: 1,
              RND2: 1,
              GNFN: 1
            }
          }, {
            max_teams: 10,
            HEAT: 2,
            FLH: 2,
            REPE: 1,
            GNFN: 1
          }, {
            max_teams: 12,
            HEAT: 2,
            FLH: 2,
            REPE: 2,
            GNFN: 1
          }, {
            max_teams: 18,
            HEAT: 3,
            FLH: 3,
            REPE: 2,
            SEMI: 2,
            GNFN: 1
          }, {
            max_teams: 24,
            HEAT: 4,
            FLH: 2,
            REPE: 3,
            SEMI: 2,
            GNFN: 1
          }, {
            max_teams: 30,
            HEAT: 5,
            FLH: 7,
            REPE: 3,
            SEMI: 3,
            MNFN: 1,
            GNFN: 1
          }, {
            max_teams: 36,
            HEAT: 6,
            FLH: 6,
            REPE: 4,
            SEMI: 3,
            MNFN: 1,
            GNFN: 1
          }, {
            max_teams: 42,
            HEAT: 7,
            FLH: 11,
            REPE: 4,
            SEMI: 4,
            MNFN: 1,
            GNFN: 1
          }, {
            max_teams: 48,
            HEAT: 8,
            FLH: 10,
            REPE: 5,
            SEMI: 4,
            MNFN: 1,
            GNFN: 1
          }, {
            max_teams: 54,
            HEAT: 9,
            FLH: 15,
            REPE: 5,
            SEMI: 5,
            PLFN: 1,
            MNFN: 1,
            GNFN: 1
          }, {
            max_teams: 60,
            HEAT: 10,
            FLH: 14,
            REPE: 6,
            SEMI: 5,
            PLFN: 1,
            MNFN: 1,
            GNFN: 1
          }
        ]
      }

  });
