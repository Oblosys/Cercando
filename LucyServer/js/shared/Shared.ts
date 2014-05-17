module Shared {
  export interface Coord { x: number; y : number}

  export interface AntennaLayout { name : string; readerAntennaSpecs : ReaderAntennaSpec[]; tagConfiguration : TagInfo[] }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface AntennaSpec { name : string; coord : Coord }

  export interface Antenna extends AntennaSpec { antId : string }
  
  export interface TagInfo { epc : string; color: string; coord: Coord}
  
  export interface AntennaRSSI {antNr : number; value : number; timestamp : Date; age? : number; distance? : number}
   
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    tagsData : {epc : string; antennaRssis : AntennaRSSI[]; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } }[]
  }
  
  export function initialServerState() : Shared.ServerState {
    return {
      visibleTags: [],
      status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
      tagsData: []
    };
  }
} 

declare var exports: any;
if (typeof exports != 'undefined') {
  exports.initialServerState = Shared.initialServerState;
}