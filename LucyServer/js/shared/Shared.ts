module Shared {
  export interface Coord { x: number; y : number}

  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface AntennaSpec { name : string; coord : Coord }

  export interface Antenna extends AntennaSpec { antId : string }
  
  export interface TagInfo { epc : string; color: string; coord: Coord}
  
  export interface AntennaRSSI {antNr : number; value : number; timestamp : Date; age? : number; distance? : number}
   
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    tagsData : {epc : string; color : string; antennaRssis : AntennaRSSI[]; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } }[]
  }
} 
