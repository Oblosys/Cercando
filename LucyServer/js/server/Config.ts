/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');

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
    
  var rotterdamBase : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    { name: 'Rotterdam'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 14, height: 14 * 734/1365}
    , scale: 100
    //, backgroundImage: 'floorPlans/Rotterdam floor plan - grid.png' // width="3183" height="1686"
    , backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs:
        [ { readerIp: '10.0.0.30' 
          , antennaSpecs: [ {name:'1', coord:{x:1.5,  y:0}}
                          , {name:'2', coord:{x:0,    y:1.5}}
                          , {name:'3', coord:{x:-1.5, y:0}}
                          , {name:'4', coord:{x:0,    y:-1.5}}
                          , {name:'5', coord:{x:1.5,  y:0}}
                          , {name:'6', coord:{x:0,    y:1.5}}
                          , {name:'7', coord:{x:-1.5, y:0}}
                          , {name:'8', coord:{x:0,    y:-1.5}}
                          ]
          }
        , { readerIp: '10.0.0.31' 
          , antennaSpecs: [ {name:'9', coord:{x:1.5,  y:0}}
                          , {name:'10', coord:{x:0,    y:1.5}}
                          , {name:'11', coord:{x:-1.5, y:0}}
                          , {name:'12', coord:{x:0,    y:-1.5}}
                          , {name:'13', coord:{x:1.5,  y:0}}
                          , {name:'14', coord:{x:0,    y:1.5}}
                          , {name:'15', coord:{x:-1.5, y:0}}
                          , {name:'16', coord:{x:0,    y:-1.5}}
                          ]
          }
        , { readerIp: '10.0.0.32' 
          , antennaSpecs: [ {name:'17', coord:{x:1.5,  y:0}}
                          , {name:'18', coord:{x:0,    y:1.5}}
                          , {name:'19', coord:{x:-1.5, y:0}}
                          , {name:'20', coord:{x:0,    y:-1.5}}
                          , {name:'21', coord:{x:1.5,  y:0}}
                          , {name:'22', coord:{x:0,    y:1.5}}
                          , {name:'23', coord:{x:-1.5, y:0}}
                          , {name:'24', coord:{x:0,    y:-1.5}}
                          ]
          }
        , { readerIp: '10.0.0.33' 
          , antennaSpecs: [ {name:'25', coord:{x:1.5,  y:0}}
                          , {name:'26', coord:{x:0,    y:1.5}}
                          , {name:'27', coord:{x:-1.5, y:0}}
                          , {name:'28', coord:{x:0,    y:-1.5}}
                          , {name:'29', coord:{x:1.5,  y:0}}
                          , {name:'30', coord:{x:0,    y:1.5}}
                          , {name:'31', coord:{x:-1.5, y:0}}
                          , {name:'32', coord:{x:0,    y:-1.5}}
                          ]
          }
        ]
    , tagConfiguration: 
        []
    };
   var rotterdamOpeningMM : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1/1000,-9,-5,
    { name: 'Rotterdam mm'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 17, height: 17 * 734/1365}
    , scale: 50
    , backgroundImage: 'floorPlans/Rotterdam floor plan - grid.png' // width="3183" height="1686"
    //, backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs: // copied from Antenne layout 3 - RFID Blueprint versie 3.jpg
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
            [ {name: 'A1', coord: {x:10450, y:2536}}
            , {name: 'A2', coord: {x:12195, y:1507}}
            , {name: 'A3', coord: {x:13768, y:1907}}
            , {name: 'A4', coord: {x:13083, y:4438}}
            , {name: 'A5', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 1}}
            , {name: 'A6', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:true,  serverIp : '127.0.0.1', antennaIndex: 11}}
            , {name: 'A7', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:true,  serverIp : '127.0.0.1', antennaIndex: 12}}
            , {name: 'A8', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 2}}
            ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
            [ {name: 'B1', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 3}}
            , {name: 'B2', coord: {x:12465, y:6941}}
            , {name: 'B3', coord: {x:9303, y:5025}}
            , {name: 'B4', coord: {x:10094, y:7692}}
            , {name: 'B5', coord: {x:10703, y:5025}}
            , {name: 'B6', coord: {x:7612, y:7967}}
            , {name: 'B7', coord: {x:12050, y:7939}}
            , {name: 'B8', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 4}}
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
            , {name: 'C7', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 5}}
            , {name: 'C8', coord: {x:2450, y:2536}, shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 6}}
            ]
          }
        ]
    , tagConfiguration: 
        []
    });

   var rotterdamOpening : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1,0,0,
    { name: 'Rotterdam Opening'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 17, height: 17 * 734/1365}
    , scale: 50
    , backgroundImage: 'floorPlans/Rotterdam floor plan - grid.png' // width="3183" height="1686"
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
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 1
                    }
                }
              , { name: 'A6'
                , coord:
                    { x: 4.957333984375
                    , y: 0.7693040293040297
                    }
                , shortMidRangeTarget:
                    { isShortRange: true
                    , serverIp: '10.0.0.26'
                    , antennaIndex: 1
                    }
                }
              , { name: 'A7'
                , coord:
                    { x: 5.737333984375
                    , y: -0.47069597069597024
                    }
                , shortMidRangeTarget:
                    { isShortRange: true
                    , serverIp: '10.0.0.26'
                    , antennaIndex: 2
                    }
                }
              , { name: 'A8'
                , coord:
                    { x: 6.737333984375
                    , y: -2.9106959706959703
                    }
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 2
                    }
                }
              ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
              [ { name: 'B1'
                , coord:
                    { x: 1.877333984375
                    , y: 3.68930402930403
                    }
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 3
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
                    { x: 0.7373333740234375
                    , y: 3.6693040293040298
                    }
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 4
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
                    { x: -6.122666625976563
                    , y: 3.20930402930403
                    }
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 5
                    }
                }
              , { name: 'C8'
                , coord:
                    { x: -7.022666625976562
                    , y: -1.0106959706959702
                    }
                , shortMidRangeTarget:
                    { isShortRange: false
                    , serverIp: '127.0.0.1'
                    , antennaIndex: 6
                    }
                }
              ]
          }
        ]

    , tagConfiguration: 
        []
    });
  
  var rotterdam : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    { name: 'Rotterdam'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 14, height: 14 * 734/1365}
    , scale: 50
    , backgroundImage: 'floorPlans/Rotterdam floor plan - grid.png' // width="3183" height="1686"
    //, backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs: // copied from Antenne layout 3 - RFID Blueprint versie 3.jpg
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
            [ { name: '1'
              , coord:
                { x: 5.29066650390625
                , y: -2.339935846573267
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 1}
              }
            , { name: '2'
              , coord:
                { x: 4.48066650390625
                , y: -0.3399356939853766
                }
              , shortMidRangeTarget: {isShortRange:true, serverIp : '127.0.0.1', antennaIndex: 11}
              }
            , { name: '3'
              , coord:
                { x: 3.86066650390625
                , y: 0.7350640008388422
                }
              , shortMidRangeTarget: {isShortRange:true, serverIp : '127.0.0.1', antennaIndex: 12}
              }
            , { name: '4'
              , coord:
                { x: 2.94066650390625
                , y: 2.9000643060146234
                }
              }
            , { name: '5'
              , coord:
                { x: 1.67066650390625
                , y: 2.8500643060146236
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 2}
              }
            , { name: '6'
              , coord:
                { x: 0.14066650390625
                , y: 2.8500643060146236
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 3}
              }
            , { name: '7'
              , coord:
                { x: 0.79066650390625
                , y: 2.8400643060146233
                }
              }
            , { name: '8'
              , coord:
                { x: 1.97066650390625
                , y: 1.8200643060146233
                }
              }
            ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
            [ { name: '9'
              , coord:
                { x: 0.54066650390625
                , y: 1.3200643060146233
                }
              }
            , { name: '10'
              , coord:
                { x: 1.83066650390625
                , y: 0.32006430601462343
                }
              }
            , { name: '11'
              , coord:
                { x: 2.98066650390625
                , y: -0.8299356939853766
                }
              }
            , { name: '12'
              , coord:
                { x: 3.69066650390625
                , y: -2.3099358465732673
                }
              }
            , { name: '13'
              , coord:
                { x: 1.88066650390625
                , y: -2.5399358465732673
                }
              }
            , { name: '14'
              , coord:
                { x: 0.97066650390625
                , y: -1.3799358465732672
                }
              }
            , { name: '15'
              , coord:
                { x: 0.73066650390625
                , y: -2.629935846573267
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 4}
              }
            , { name: '16'
              , coord:
                { x: -0.42933349609375
                , y: -1.6199358465732672
                }
              }
            ]
          }
        , { readerIp: '10.0.0.32'
          , antennaSpecs:
            [ { name: '17'
              , coord:
                { x: -4.889333343505859
                , y: 2.6500643060146234
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 5}
              }
            , { name: '18'
              , coord:
                { x: -1.46933349609375
                , y: 0.8100643060146234
                }
              }
            , { name: '19'
              , coord:
                { x: -3.04933349609375
                , y: 1.3850643060146235
                }
              }
            , { name: '20'
              , coord:
                { x: -3.09933349609375
                , y: 0.1700643060146234
                }
              }
            , { name: '21'
              , coord:
                { x: -1.91933349609375
                , y: -0.9799356939853766
                }
              }
            , { name: '22'
              , coord:
                { x: -0.12933349609375
                , y: -0.11993569398537658
                }
              }
            , { name: '23'
              , coord:
                { x: -0.74933349609375
                , y: 2.3150643060146234
                }
              }
            , { name: '24'
              , coord:
                { x: -6.419333343505859
                , y: -1.2199358465732673
                }
              , shortMidRangeTarget: {isShortRange:false, serverIp : '127.0.0.1', antennaIndex: 6}
              }
            ]
          }
        , { readerIp: '10.0.0.33'
          , antennaSpecs:
            [ { name: '25'
              , coord:
                { x: -2.28933349609375
                , y: 2.930064306014623
                }
              }
            , { name: '26'
              , coord:
                { x: -3.99933349609375
                , y: 2.7150643060146233
                }
              }
            , { name: '27'
              , coord:
                { x: -4.6593333435058595
                , y: 1.3450640008388421
                }
              }
            , { name: '28'
              , coord:
                { x: -4.9893333435058596
                , y: -0.25493599916115783
                }
              }
            , { name: '29'
              , coord:
                { x: -4.01933349609375
                , y: -1.5799358465732671
                }
              }
            , { name: '30'
              , coord:
                { x: -5.22933334350586
                , y: -2.6749359228672125
                }
              }
            , { name: '31'
              , coord:
                { x: -2.86933349609375
                , y: -2.6549359228672125
                }
              }
            , { name: '32'
              , coord:
                { x: -1.35933349609375
                , y: -2.5949359228672124
                }
              }
            ]
          }
        ]
    , tagConfiguration: 
        []
    };
  return [groningenHorizontaal, groningenSchuin, rotterdamOpening, rotterdamOpeningMM, rotterdam];
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