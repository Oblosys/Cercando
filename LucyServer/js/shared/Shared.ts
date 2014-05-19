module Shared {

  export interface Coord { x: number; y : number}

  export interface AntennaLayout { name : string; dimensions: {width : number; height : number}; scale: number
                                 ; readerAntennaSpecs : ReaderAntennaSpec[]; tagConfiguration : TagInfo[] }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface AntennaSpec { name : string; coord : Coord }

  export interface Antenna extends AntennaSpec { antId : string }
  
  export interface AntennaRSSI {antNr : number; value : number; timestamp : Date; age? : number; distance? : number}
   
  export interface LayoutInfo { selectedLayout : number; names : string[] }
  
  export interface TagInfo { epc : string; color: string; coord: Coord}
  
  export interface AntennaInfo { name : string; dimensions: {width : number; height : number}
                               ; scale: number // pixels per meter
                               ; antennaSpecs : Antenna[] }
  
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    tagsData : {epc : string; antennaRssis : AntennaRSSI[]; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } }[]
    unknownAntennas : {readerIp : string; antennaNr : number}[]
  }
  
  export function initialServerState() : Shared.ServerState {
    return {
      visibleTags: [],
      status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
      tagsData: [],
      unknownAntennas: []
    };
  }
} 

declare var exports: any;
if (typeof exports != 'undefined') {
  exports.initialServerState = Shared.initialServerState;
}