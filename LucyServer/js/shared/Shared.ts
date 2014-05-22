module Shared {
  // TODO: find a way to import other libs (e.g. underscore) in a type-safe way. Adding import hides Shared namespace.

  // NOTE: When adding constants or functions, also add them to exports declaration below
  
  export var maxAntennaRange = 1.5;

  export interface Coord { x: number; y : number}

  export interface AntennaLayout { name : string; dimensions: {width : number; height : number}; scale: number
                                 ; backgroundImage? : string
                                 ; readerAntennaSpecs : ReaderAntennaSpec[]; tagConfiguration : TagInfo[] }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface ShortMidRangeTarget { isShortRange : boolean; serverIp : string; antennaIndex : number }
  
  export interface AntennaSpec { name? : string; coord : Coord; shortMidRangeTarget? : ShortMidRangeTarget }

  export interface AntennaId { readerIp : string; antennaNr : number }
  
  export interface Antenna extends AntennaSpec { antennaId : AntennaId }
  
  export interface AntennaRSSI {antNr : number; value : number; timestamp : Date; age? : number; /* milliseconds */ distance? : number}
   
  export interface LayoutInfo { selectedLayout : number; names : string[] }
  
  export interface TagInfo { epc : string; color: string; coord: Coord}
  
  export interface AntennaInfo { name : string; dimensions: {width : number; height : number}
                               ; scale: number // pixels per meter
                               ; backgroundImage? : string
                               ; antennaSpecs : Antenna[] }
  
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    selectedAntennaLayout : number
    tagsData : {epc : string; antennaRssis : AntennaRSSI[]; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } }[]
    unknownAntennaIds : AntennaId[]
  }
  
  // NOTE: When adding constants or functions, also add them to exports declaration below
  
  export function initialServerState() : Shared.ServerState {
    return {
      status: {isConnected: false, isSaving: false, webServerTime : null, readerServerTime : null},
      selectedAntennaLayout: 2,
      tagsData: [],
      unknownAntennaIds: []
    };
  }
} 

declare var exports: any;
if (typeof exports != 'undefined') {
  exports.maxAntennaRange = Shared.maxAntennaRange;
  exports.initialServerState = Shared.initialServerState;
}