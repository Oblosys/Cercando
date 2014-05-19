module Shared {

  export interface Coord { x: number; y : number}

  export interface AntennaLayout { name : string; dimensions: {width : number; height : number}; scale: number
                                 ; backgroundImage? : string
                                 ; readerAntennaSpecs : ReaderAntennaSpec[]; tagConfiguration : TagInfo[] }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface AntennaSpec { name : string; coord : Coord }

  export interface AntennaId { readerIp : string; antennaNr : number }
  
  export interface Antenna extends AntennaSpec { antennaId : AntennaId }
  
  export interface AntennaRSSI {antNr : number; value : number; timestamp : Date; age? : number; distance? : number}
   
  export interface LayoutInfo { selectedLayout : number; names : string[] }
  
  export interface TagInfo { epc : string; color: string; coord: Coord}
  
  export interface AntennaInfo { name : string; dimensions: {width : number; height : number}
                               ; scale: number // pixels per meter
                               ; backgroundImage? : string
                               ; antennaSpecs : Antenna[] }
  
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    tagsData : {epc : string; antennaRssis : AntennaRSSI[]; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } }[]
    unknownAntennaIds : AntennaId[]
  }
  
  export function initialServerState() : Shared.ServerState {
    return {
      visibleTags: [],
      status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
      tagsData: [],
      unknownAntennaIds: []
    };
  }
} 

declare var exports: any;
if (typeof exports != 'undefined') {
  exports.initialServerState = Shared.initialServerState;
}