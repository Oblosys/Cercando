export function getAllAntennaLayouts() : Shared.AntennaLayout[] {
  var groningenHorizontaal =
    { name: 'Groningen (horizontaal)'
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

  var groningenSchuin =
    { name: 'Groningen (schuin)'
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
  
  return [groningenHorizontaal, groningenSchuin];
}
