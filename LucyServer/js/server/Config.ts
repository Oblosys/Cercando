/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');
import fs       = require('fs');

import file     = require('./File');  


// file path constants

export var lucyDirectoryPath = process.env['HOME'] + '/lucy';
export var lucyDataDirectoryPath = lucyDirectoryPath + '/data';
export var lucyLogDirectoryPath = lucyDirectoryPath + '/log';
export var lucyConfigFilePath = lucyDirectoryPath + '/config/config.json'; // local, so it can't easily be accidentally edited
export var configUploadFilePath = lucyDataDirectoryPath + '/configUpload/config.json';
export var lucyUsersFilePath = lucyDirectoryPath + '/config/users.json';
export var saveDirectoryPath = lucyDataDirectoryPath + '/savedReaderEvents';
export var userSaveDirectoryPath = saveDirectoryPath + '/userSave';
export var autoSaveDirectoryPath = saveDirectoryPath + '/autoSave';
export var cercandoGitDirectory = process.env['HOME'] + '/git/Cercando';


// configuration constants

export var defaultServerPortNr = 8080; // port for the Lucy web server
export var remoteHostName = 'lucy.oblomov.com';
//export var remoteHostName = '10.0.0.24';
export var readerServerPortNr       = 8193;
export var diColoreLocationServer = {ip: '10.0.0.26', port: 8198};
export var diColoreShortMidPort = 8199; // ip addresses are specified per short-/midrange antenna in config.json at lucyConfigFilePath
export var diColoreSocketTimeout = 150; // this prevents buildup of open socket connections

export var db_config = {
    host:'10.0.0.20', // replaced by 'localhost' when remoteReader paramater is given
    user: 'NHMR',
    password: '',
    database: 'lucy_test',
    connectTimeout: 5000
};

export var reconnectInterval = 2000; // time in ms to wait before trying to reconnect to the reader server
export var reportShortMidRangeInterval = 100; // time in ms between sending short-/midrange antenna data to Di Colore
export var positioningInterval = 250; // time in ms between computing coordinates of all tags (and purging old signals/tags)

export var useSmoother = true;


// NOTE: short-/midrange settings apply to all antenna layouts
export function getShortMidRangeSpecs() : Shared.ShortMidRangeSpec[] {
  if (!fs.existsSync(lucyConfigFilePath)) {
    util.log('File \'' + lucyConfigFilePath + '\' not found, creating empty config file.');
    var config : Shared.ShortMidRangeSpec[] = []; 
    file.writeConfigFile(lucyConfigFilePath, config);
    return config;
  } else {
    util.log('Using existing config from ' + lucyConfigFilePath);
    var result = file.readConfigFile(lucyConfigFilePath);
    if (result.err) {
      util.error('Internal error: failed to read config from \'' + lucyConfigFilePath + '\':\n'+result.err);
      return []; // we will notice the error since no short-/midrange antennas will be shown in the server status area
    } else {
      return result.config;
    } 
  }
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
    
   // Layout that is computed from measured coordinates of long range antennas in "140903 RFID antenne plaatsing ".
   // All short/mid-range antennas are in a single position (we don't have measured coordinates for those). 
   //Serves as a basis for layout 'rotterdam'.
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
            [ {name: 'A1',coord:{x:10450, y:2992}}
            , {name: 'A2',coord:{x:11993, y:2368}}
            , {name: 'A3',coord:{x:11444, y:1907}}
            , {name: 'A4',coord:{x:13083 /*13789*/, y:4438 /*3909*/}}
            , {name: 'A5', coord: {x:2450,  y:2536}}
            , {name: 'A6', coord: {x:2450,  y:2536}}
            , {name: 'A7', coord: {x:2450,  y:2536}}
            , {name: 'A8', coord: {x:2450,  y:2536}}
            ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
            [ {name: 'B1',coord: {x:2450, y:2536}}
            , {name: 'B2',coord:{x:12465 /*12641*/, y:6941 /*4824*/}}
            , {name: 'B3',coord:{x:9303 /*8950*/, y:5025 /*5201*/}}
            , {name: 'B4',coord:{x:10094 /*9918*/, y:7692 /*7339*/}}
            , {name: 'B5',coord:{x:10703 /*10527*/, y:5025 /*4672*/}}
            , {name: 'B6',coord:{x:7612 /*8723*/, y:7967 /*7967*/}}
            , {name: 'B7',coord:{x:12050 /*11609*/, y:7939 /*6193*/}}
            , {name: 'B8', coord: {x:2450, y:2536}}
            ]
          }
        , { readerIp: '10.0.0.32'
          , antennaSpecs:
            [ {name: 'C1',coord:{x:8885, y:2436}}
            , {name: 'C2',coord:{x:7365 /*6307*/, y:4953 /*4247*/}}
            , {name: 'C3',coord:{x:7564, y:6385 /*6032*/}}
            , {name: 'C4',coord:{x:4181, y:6236}}
            , {name: 'C5',coord:{x:6188, y:6827}}
            , {name: 'C6',coord:{x:3391 /*6566*/, y:7949 /*8125*/}}
            , {name: 'C7', coord: {x:2450, y:2536}}
            , {name: 'C8', coord: {x:2450, y:2536}}
            ]
          }
        , { readerIp: '10.0.0.33'
          , antennaSpecs:
            [ {name: 'D1',coord:{x:7310, y:2842}}
            , {name: 'D2',coord:{x:5800 /*5037*/, y:4310 /*4807*/}}
            , {name: 'D3',coord:{x:3040, y:4180}}
            , {name: 'D4',coord:{x:3770, y:2110}}
            , {name: 'D5',coord:{x:5800, y:900}}
          
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

   // Old layout obtained from '140526 RFID antenne plaatsing' and '140825 RFID antenne plaatsing' after
   // correcting for mistakes and adding short-range antennas 
   var rotterdamOud : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1,0,0,
    { name: 'Rotterdam oud'
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
                    { x: 1.3663551401869167
                    , y: -1.4537383177570091
                    }
                }
              , { name: 'A2'
                , coord:
                    { x: 2.8084112149532707
                    , y: -2.0369158878504674
                    }
                }
              , { name: 'A3'
                , coord:
                    { x: 2.295327102803739
                    , y: -2.467757009345794
                    }
                }
              , { name: 'A4'
                , coord:
                    { x: 3.8271028037383186
                    , y: -0.1023364485981304
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
                    { x: 3.2495327102803735
                    , y: 2.2369158878504676
                    }
                }
              , { name: 'B3'
                , coord:
                    { x: 0.2943925233644862
                    , y: 0.4462616822429908
                    }
                }
              , { name: 'B4'
                , coord:
                    { x: 1.0336448598130836
                    , y: 2.938785046728972
                    }
                }
              , { name: 'B5'
                , coord:
                    { x: 1.602803738317757
                    , y: 0.4462616822429908
                    }
                }
              , { name: 'B6'
                , coord:
                    { x: -1.2859813084112153
                    , y: 3.195794392523365
                    }
                }
              , { name: 'B7'
                , coord:
                    { x: 2.8616822429906534
                    , y: 3.1696261682242994
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
                    { x: -0.09626168224299114
                    , y: -1.9733644859813082
                    }
                }
              , { name: 'C2'
                , coord:
                    { x: -1.5168224299065418
                    , y: 0.37897196261682264
                    }
                }
              , { name: 'C3'
                , coord:
                    { x: -1.330841121495327
                    , y: 1.7172897196261685
                    }
                }
              , { name: 'C4'
                , coord:
                    { x: -4.492523364485981
                    , y: 1.5780373831775707
                    }
                }
              , { name: 'C5'
                , coord:
                    { x: -2.6168224299065423
                    , y: 2.1303738317757013
                    }
                }
              , { name: 'C6'
                , coord:
                    { x: -5.230841121495327
                    , y: 3.1789719626168225
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
                    { x: -1.5682242990654203
                    , y: -1.5939252336448595
                    }
                }
              , { name: 'D2'
                , coord:
                    { x: -2.979439252336449
                    , y: -0.22196261682243001
                    }
                }
              , { name: 'D3'
                , coord:
                    { x: -5.558878504672897
                    , y: -0.34345794392523343
                    }
                }
              , { name: 'D4'
                , coord:
                    { x: -4.876635514018692
                    , y: -2.27803738317757
                    }
                }
              , { name: 'D5'
                , coord:
                    { x: -2.979439252336449
                    , y: -3.4088785046728973
                    }
                }
              ]
          }
        ]
    , tagConfiguration: 
        []
    });
  
  return [rotterdam, rotterdamRaw, rotterdamOud];
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