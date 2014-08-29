/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');

export function getShortMidRangeSpecs() : Shared.ShortMidRangeSpec[] {
  return [  {antennaName: 'A5', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ,  {antennaName: 'A6', range:Shared.ShortOrMid.Short, serverIp : '127.0.0.1'}
         ,  {antennaName: 'A7', range:Shared.ShortOrMid.Short, serverIp : '127.0.0.1'}
         ,  {antennaName: 'A8', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ,  {antennaName: 'B1', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ,  {antennaName: 'B8', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ,  {antennaName: 'C7', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ,  {antennaName: 'C8', range:Shared.ShortOrMid.Mid,   serverIp : '127.0.0.1'}
         ];

}

export function getAllAntennaLayouts() : Shared.AntennaLayout[] {
  var groningenHorizontaal : Shared.AntennaLayout =
    { name: 'Groningen (horizontaal)'
    , dimensions: {width: 6, height: 6}
    , scale: 60
    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30' 
          , antennaSpecs: [ {name:'1', coord:{x:1.5,  y:0}}
                          , {name:'2', coord:{x:0,    y:1.5}}
                          , {name:'3', coord:{x:-1.5, y:0}}
                          , {name:'4', coord:{x:0,    y:-1.5}}
                          ]
          }
        ]
    , tagConfiguration: 
        [ {epc:'0000000000000000000000000370869', color:'green',     testCoord:null}
        , {epc:'0000000000000000000000000503968', color:'yellow',    testCoord:null}
        , {epc:'0000000000000000000000000370802', color:'black',     testCoord:null}
        , {epc:'0000000000000000000000000103921', color:'purple',    testCoord:null}
        , {epc:'0000000000000000000000000000795', color:'red',       testCoord:null}
        , {epc:'0000000000000000000000000370870', color:'orange',    testCoord:null}
        , {epc:'0000000000000000000000000370845', color:'white',     testCoord:null}
        , {epc:'0000000000000000000000000100842', color:'brown',     testCoord:null} 
        , {epc:'0000000000000000000000000503972', color:'gray',      testCoord:null}
        , {epc:'0000000000000000000000000023040', color:'lightblue', testCoord:null}
        , {epc:'0000000000000000000000000023140', color:'darkgray',  testCoord:null}
        ]
    };

  var groningenSchuin : Shared.AntennaLayout =
    { name: 'Groningen (schuin)'
    , dimensions: {width: 6, height: 6}
    , scale: 60

    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30' 
          , antennaSpecs: [ {name:'1', coord:{x:1.2,  y:1.2}}
                          , {name:'2', coord:{x:-1.2, y:1.2}}
                          , {name:'3', coord:{x:-1.2, y:-1.2}}
                          , {name:'4', coord:{x:1.2,  y:-1.2}}
                          ]
          }
        ]
    , tagConfiguration: 
        [ {epc:'0000000000000000000000000370869', color:'green',     testCoord:{x:1.2-0*0.35, y:1.2-0*0.35}}
        , {epc:'0000000000000000000000000503968', color:'yellow',    testCoord:{x:1.2-1*0.35, y:1.2-1*0.35}}
        , {epc:'0000000000000000000000000370802', color:'black',     testCoord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
        , {epc:'0000000000000000000000000103921', color:'purple',    testCoord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
        , {epc:'0000000000000000000000000000795', color:'red',       testCoord:{x:1.2-3*0.35, y:1.2-3*0.35}}
        , {epc:'0000000000000000000000000370870', color:'orange',    testCoord:{x:1.2-4*0.35, y:1.2-4*0.35}}
        , {epc:'0000000000000000000000000370845', color:'white',     testCoord:{x:1.35, y:1.2-0.5-0*0.5}}
        , {epc:'0000000000000000000000000100842', color:'brown',     testCoord:{x:1.35, y:1.2-0.5-1*0.5}} 
        , {epc:'0000000000000000000000000503972', color:'gray',      testCoord:{x:1.35, y:1.2-0.5-2*0.5}}
        , {epc:'0000000000000000000000000023040', color:'lightblue', testCoord:null}
        , {epc:'0000000000000000000000000023140', color:'darkgray',  testCoord:null}
        ]
    };
    
   // Layout that is computed from measured coordinates of long range antennas. All short/mid-range
   // antennas are in a single position (we don't have measured coordinates for those). Serves as a basis
   // for layout 'rotterdam'.
   // TODO: does not contain D reader antennas yet
   var rotterdamRaw : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1/1070,-8.4,-4.25,
    { name: 'Rotterdam raw'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 17, height: 17 * 734/1365}
    , scale: 50
    , backgroundImage: 'floorPlans/Blueprint Lucy Rotterdam v2.0.png' // width="3183" height="1686"
    //, backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs: // copied from Antenne layout 3 - RFID Blueprint versie 3.jpg
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
            [ {name: 'A1', coord: {x:10450, y:2536}}
            , {name: 'A2', coord: {x:12195, y:1507}}
            , {name: 'A3', coord: {x:13768, y:1907}}
            , {name: 'A4', coord: {x:13083, y:4438}}
            , {name: 'A5', coord: {x:2450,  y:2536}}
            , {name: 'A6', coord: {x:2450,  y:2536}}
            , {name: 'A7', coord: {x:2450,  y:2536}}
            , {name: 'A8', coord: {x:2450,  y:2536}}
            ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
            [ {name: 'B1', coord: {x:2450, y:2536}}
            , {name: 'B2', coord: {x:12465, y:6941}}
            , {name: 'B3', coord: {x:9303, y:5025}}
            , {name: 'B4', coord: {x:10094, y:7692}}
            , {name: 'B5', coord: {x:10703, y:5025}}
            , {name: 'B6', coord: {x:7612, y:7967}}
            , {name: 'B7', coord: {x:12050, y:7939}}
            , {name: 'B8', coord: {x:2450, y:2536}}
            ]
          }
        , { readerIp: '10.0.0.32'
          , antennaSpecs:
            [ {name: 'C1', coord: {x:9524, y:2298}}
            , {name: 'C2', coord: {x:7365, y:4953}}
            , {name: 'C3', coord: {x:7564, y:6385}}
            , {name: 'C4', coord: {x:4181, y:6236}}
            , {name: 'C5', coord: {x:6188, y:6827}}
            , {name: 'C6', coord: {x:3391, y:7949}}
            , {name: 'C7', coord: {x:2450, y:2536}}
            , {name: 'C8', coord: {x:2450, y:2536}}
            ]
          }
        , { readerIp: '10.0.0.33'
          , antennaSpecs:
            [ {name: 'D1', coord: {x:7200, y:2300}}
            , {name: 'D2', coord: {x:5800, y:4310}}
            , {name: 'D3', coord: {x:3040, y:4180}}
            , {name: 'D4', coord: {x:3770, y:2110}}
            , {name: 'D5', coord: {x:5800, y: 900}}
            
            , {name: 'NW', coord: {x:0,     y:0}}
            , {name: 'NE', coord: {x:16936, y:0}}
            , {name: 'SE', coord: {x:16936, y:9045}}
            , {name: 'SW', coord: {x:0,     y:9045}}
            ]
          }      
        ]
    , tagConfiguration: 
        []
    });

   // Layout obtained from layout 'rotterdamRaw' by positioning short/mid-range antennas
   var rotterdam : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1,0,0,
    { name: 'Rotterdam'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 17, height: 17 * 734/1365}
    , scale: 50
    , backgroundImage: 'floorPlans/Blueprint Lucy Rotterdam v2.0.png' // width="3183" height="1686"
    //, backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
              [ { name: 'A1'
                , coord:
                    { x: 1.450000000000001
                    , y: -2.464
                    }
                }
              , { name: 'A2'
                , coord:
                    { x: 3.1950000000000003
                    , y: -3.493
                    }
                }
              , { name: 'A3'
                , coord:
                    { x: 4.768000000000001
                    , y: -3.093
                    }
                }
              , { name: 'A4'
                , coord:
                    { x: 4.083
                    , y: -0.5620000000000003
                    }
                }
              , { name: 'A5'
                , coord:
                    { x: 1.3973333740234375
                    , y: -3.73069597069597
                    }
                }
              , { name: 'A6'
                , coord:
                    { x: 4.9236669921875
                    , y: 0.6796372812571547
                    }
                }
              , { name: 'A7'
                , coord:
                    { x: 5.6036669921875
                    , y: -0.6203627187428452
                    }
                }
              , { name: 'A8'
                , coord:
                    { x: 5.8036669921875
                    , y: -2.606029222649095
                    }
                }
              ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
              [ { name: 'B1'
                , coord:
                    { x: 2.2836669921875
                    , y: 3.4196372812571547
                    }
                }
              , { name: 'B2'
                , coord:
                    { x: 3.465
                    , y: 1.9409999999999998
                    }
                }
              , { name: 'B3'
                , coord:
                    { x: 0.3030000000000008
                    , y: 0.025000000000000355
                    }
                }
              , { name: 'B4'
                , coord:
                    { x: 1.0939999999999994
                    , y: 2.692
                    }
                }
              , { name: 'B5'
                , coord:
                    { x: 1.7029999999999994
                    , y: 0.025000000000000355
                    }
                }
              , { name: 'B6'
                , coord:
                    { x: -1.388
                    , y: 2.9670000000000005
                    }
                }
              , { name: 'B7'
                , coord:
                    { x: 3.0500000000000007
                    , y: 2.939
                    }
                }
              , { name: 'B8'
                , coord:
                    { x: 1.2436669921875
                    , y: 3.4396372812571547
                    }
                }
              ]
          }
        , { readerIp: '10.0.0.32'
          , antennaSpecs:
              [ { name: 'C1'
                , coord:
                    { x: 0.5240000000000009
                    , y: -2.702
                    }
                }
              , { name: 'C2'
                , coord:
                    { x: -1.6349999999999998
                    , y: -0.04699999999999971
                    }
                }
              , { name: 'C3'
                , coord:
                    { x: -1.436
                    , y: 1.3849999999999998
                    }
                }
              , { name: 'C4'
                , coord:
                    { x: -4.819
                    , y: 1.2359999999999998
                    }
                }
              , { name: 'C5'
                , coord:
                    { x: -2.8120000000000003
                    , y: 1.827
                    }
                }
              , { name: 'C6'
                , coord:
                    { x: -5.609
                    , y: 2.949
                    }
                }
              , { name: 'C7'
                , coord:
                    { x: -6.0763333129882815
                    , y: 3.219637281257155
                    }
                }
              , { name: 'C8'
                , coord:
                    { x: -6.88066650390625
                    , y: -0.010695970695970232
                    }
                }
              ]
          },
        , { readerIp: '10.0.0.33'
          , antennaSpecs:
              [ { name: 'D1'
                , coord:
                    { x: -1.8311114501953125
                    , y: -1.8706959706959703
                    }
                }
              , { name: 'D2'
                , coord:
                    { x: -2.5911114501953123
                    , y: -0.5706959706959702
                    }
                }
              , { name: 'D3'
                , coord:
                    { x: -5.431111450195313
                    , y: -0.2506959706959702
                    }
                }
              , { name: 'D4'
                , coord:
                    { x: -4.2711114501953125
                    , y: -2.19069597069597
                    }
                }
              , { name: 'D5'
                , coord:
                    { x: -2.6511114501953124
                    , y: -3.4106959706959703
                    }
                }
              ]
          }
        ]
    , tagConfiguration: 
        []
    });
  
  return [rotterdam, rotterdamRaw];
}

function scaleAndTranslate( scale : number, translationX : number, translationY : number
                          , layout : Shared.AntennaLayout ) : Shared.AntennaLayout {
  _(layout.readerAntennaSpecs).each((readerAntennaSpec) => {
    _(readerAntennaSpec.antennaSpecs).each((antennaSpec) => {
      antennaSpec.coord.x = scale*antennaSpec.coord.x + translationX;
      antennaSpec.coord.y = scale*antennaSpec.coord.y + translationY;
    });
  });
  return layout;
}