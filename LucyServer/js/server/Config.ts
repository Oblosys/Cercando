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
  
  // Layout that is computed from measured coordinates of long range antennas in "140903 RFID antenne plaatsing .pdf",
  // except for A3, which has incorrect coordinates in this pdf and should be at {x:13.768, y:1.907} (e-mail Denny van Dijk, 6-10-14)
  // The short/mid range antennas have been manually positioned according to the background image
  var rotterdam : Shared.AntennaLayout =
    { name: 'Rotterdam'
    , id: 'rotterdam-3.0'
    , backgroundImage: 'floorPlans/Blueprint-Lucy-Rotterdam-v3.0.png'
    , backgroundSize: {width: 2134, height: 1092} // in pixels, actual dimensions of png that was obtained by Save for Web & Devices of "141006 NHMR_plattegrond_schaal 1-50 - blueprint CS5.ai"
    , backgroundOrigin: {x: 34, y: 34}            // in pixels, left corner, measured in resulting png
    , backgroundScale:  2134 / (37.66*50/100)     // pixels per meter: png width / (AI artboard width in cm / AI scale / 100))  
    , screenZoomFactor: 1000/2134
    , readerAntennaSpecs: // copied from Antenne layout 3 - RFID Blueprint versie 3.jpg
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
            [ {name: 'A1', coord: {x:10.450, y:2.992}}
            , {name: 'A2', coord: {x:11.993, y:2.368}}
            , {name: 'A3', coord: {x:13.768, y:1.907}}
            , {name: 'A4', coord: {x:13.083 /*13.789*/, y:4.438 /*3.909*/}}
            , {name: 'A5', coord: {x:10.703, y:0.545}} // mid range, manually positioned
            , {name: 'A6', coord: {x:14.535, y:5.320}} // short range, manually positioned
            , {name: 'A7', coord: {x:15.308, y:3.923}} // short range, manually positioned
            , {name: 'A8', coord: {x:15.535, y:1.772}} // mid range, manually positioned
            ]
          }
        , { readerIp: '10.0.0.31'
          , antennaSpecs:
            [ {name: 'B1', coord: {x:10.111, y:7.966}} // mid range, manually positioned
            , {name: 'B2', coord: {x:12.465 /*12.641*/, y:6.941 /*4.824*/}}
            , {name: 'B3', coord: {x: 9.303 /* 8.950*/, y:5.025 /*5.201*/}}
            , {name: 'B4', coord: {x:10.094 /* 9.918*/, y:7.692 /*7.339*/}}
            , {name: 'B5', coord: {x:10.703 /*10.527*/, y:5.025 /*4.672*/}}
            , {name: 'B6', coord: {x: 7.612 /* 8.723*/, y:7.967 /*7.967*/}}
            , {name: 'B7', coord: {x:12.050 /*11.609*/, y:7.939 /*6.193*/}}
            , {name: 'B8', coord: {x:12.244, y:7.966}} // mid range, manually positioned
            ]
          }
        , { readerIp: '10.0.0.32'
          , antennaSpecs:
            [ {name: 'C1', coord: {x:8.885, y:2.436}}
            , {name: 'C2', coord: {x:7.365 /*6.307*/, y:4.953 /*4.247*/}}
            , {name: 'C3', coord: {x:7.564, y:6.385 /*6.032*/}}
            , {name: 'C4', coord: {x:4.181, y:6.236}}
            , {name: 'C5', coord: {x:6.188, y:6.827}}
            , {name: 'C6', coord: {x:3.391 /*6.566*/, y:7.949 /*8.125*/}}
            , {name: 'C7', coord: {x:3.071, y:8.193}} // mid range, manually positioned
            , {name: 'C8', coord: {x:1.505, y:4.550}} // mid range, manually positioned
            ]
          }
        , { readerIp: '10.0.0.33'
          , antennaSpecs:
            [ {name: 'D1', coord: {x:7.310, y:2.842}}
            , {name: 'D2', coord: {x:5.800 /*5.037*/, y:4.310 /*4.807*/}}
            , {name: 'D3', coord: {x:3.040, y:4.180}}
            , {name: 'D4', coord: {x:3.770, y:2.110}}
            , {name: 'D5', coord: {x:5.800, y:0.900}}
          
            , {name: 'NW', coord: {x:0,      y:0}}
            , {name: 'NE', coord: {x:16.936, y:0}}
            , {name: 'SE', coord: {x:16.936, y:9.045}}
            , {name: 'SW', coord: {x:0,      y:9.045}}
            ]
          }      
        ]
    , tagConfiguration: 
        []
    };

  // Old layout obtained from '140526 RFID antenne plaatsing' and '140825 RFID antenne plaatsing' after
  // correcting for mistakes and adding short-range antennas 
  var rotterdamOud : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    scaleAndTranslate(1,0,0,
    { name: 'Rotterdam oud'
    , id: 'rotterdam-2.0'
    , backgroundImage: 'floorPlans/Blueprint Lucy Rotterdam v2.0.png'
    , backgroundSize: {width: 2340, height: 1257} // in pixels
    , backgroundOrigin: {x: 2340/2, y: 1257/2} // in pixels
    , backgroundScale: 137.70883054892602 // pixels per meter
    , screenZoomFactor: 850/2340
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

  var groningenHorizontaal : Shared.AntennaLayout =
    { name: 'Groningen (horizontaal)'
    , id: 'groningen-1.0'
    , backgroundSize: {width:600 , height: 600} // in pixels
    , backgroundOrigin: {x: 300, y: 300} // in pixels
    , backgroundScale: 100 // pixels per meter
    , screenZoomFactor: 1
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
    , id: 'groningen-schuin-1.0'
    , backgroundSize: {width:600 , height: 600} // in pixels
    , backgroundOrigin: {x: 300, y: 300} // in pixels
    , backgroundScale: 10 // pixels per meter
    , screenZoomFactor: 1

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

  return [rotterdam, rotterdamOud];
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