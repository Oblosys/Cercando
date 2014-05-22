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
         [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
         , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:1.2-1*0.35, y:1.2-1*0.35}}
         , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000000795', color:'red',       coord:{x:1.2-3*0.35, y:1.2-3*0.35}}
         , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:1.2-4*0.35, y:1.2-4*0.35}}
         , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.35, y:1.2-0.5-0*0.5}}
         , {epc:'0000000000000000000000000100842', color:'brown',     coord:{x:1.35, y:1.2-0.5-1*0.5}} 
         , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:1.35, y:1.2-0.5-2*0.5}}
         , {epc:'0000000000000000000000000023040', color:'lightblue', coord:null}
         , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:null}
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
         [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
         , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:1.2-1*0.35, y:1.2-1*0.35}}
         , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000000795', color:'red',       coord:{x:1.2-3*0.35, y:1.2-3*0.35}}
         , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:1.2-4*0.35, y:1.2-4*0.35}}
         , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.35, y:1.2-0.5-0*0.5}}
         , {epc:'0000000000000000000000000100842', color:'brown',     coord:{x:1.35, y:1.2-0.5-1*0.5}} 
         , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:1.35, y:1.2-0.5-2*0.5}}
         , {epc:'0000000000000000000000000023040', color:'lightblue', coord:null}
         , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:null}
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
         [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
         , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:1.2-1*0.35, y:1.2-1*0.35}}
         , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000000795', color:'red',       coord:{x:1.2-3*0.35, y:1.2-3*0.35}}
         , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:1.2-4*0.35, y:1.2-4*0.35}}
         , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.35, y:1.2-0.5-0*0.5}}
         , {epc:'0000000000000000000000000100842', color:'brown',     coord:{x:1.35, y:1.2-0.5-1*0.5}} 
         , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:1.35, y:1.2-0.5-2*0.5}}
         , {epc:'0000000000000000000000000023040', color:'lightblue', coord:null}
         , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:null}
         ]
    };
  var rotterdam : Shared.AntennaLayout = // TODO: Without this signature, type errors in shortMidRangeTarget are not reported
    { name: 'Rotterdam'
    //, dimensions: {width: 14, height: 14 * 1686/3183}
    , dimensions: {width: 14, height: 14 * 734/1365}
    , scale: 100
    //, backgroundImage: 'floorPlans/Rotterdam floor plan - grid.png' // width="3183" height="1686"
    , backgroundImage: 'floorPlans/Antenne layout 3 - RFID Blueprint versie 3.jpg' // width="1365" height="734"
    , readerAntennaSpecs: // copied from Antenne layout 3 - RFID Blueprint versie 3.jpg
        [ { readerIp: '10.0.0.30'
          , antennaSpecs:
            [ { name: '1'
              , coord:
                { x: 5.29066650390625
                , y: -2.339935846573267
                }
              }
            , { name: '2'
              , coord:
                { x: 4.48066650390625
                , y: -0.3399356939853766
                }
              }
            , { name: '3'
              , coord:
                { x: 3.86066650390625
                , y: 0.7350640008388422
                }
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
              }
            , { name: '6'
              , coord:
                { x: 0.14066650390625
                , y: 2.8500643060146236
                }
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
         [ {epc:'0000000000000000000000000370869', color:'green',     coord:{x:1.2-0*0.35, y:1.2-0*0.35}}
         , {epc:'0000000000000000000000000503968', color:'yellow',    coord:{x:1.2-1*0.35, y:1.2-1*0.35}}
         , {epc:'0000000000000000000000000370802', color:'black',     coord:{x:1.2-2*0.35-0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000103921', color:'purple',    coord:{x:1.2-2*0.35+0.03, y:1.2-2*0.35}}
         , {epc:'0000000000000000000000000000795', color:'red',       coord:{x:1.2-3*0.35, y:1.2-3*0.35}}
         , {epc:'0000000000000000000000000370870', color:'orange',    coord:{x:1.2-4*0.35, y:1.2-4*0.35}}
         , {epc:'0000000000000000000000000370845', color:'white',     coord:{x:1.35, y:1.2-0.5-0*0.5}}
         , {epc:'0000000000000000000000000100842', color:'brown',     coord:{x:1.35, y:1.2-0.5-1*0.5}} 
         , {epc:'0000000000000000000000000503972', color:'gray',      coord:{x:1.35, y:1.2-0.5-2*0.5}}
         , {epc:'0000000000000000000000000023040', color:'lightblue', coord:null}
         , {epc:'0000000000000000000000000023140', color:'darkgray',  coord:null}
         ]
    };
  return [groningenHorizontaal, groningenSchuin, rotterdam];
}
