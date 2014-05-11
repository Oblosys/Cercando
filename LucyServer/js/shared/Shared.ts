module Shared {
  export interface Coord { x: number; y : number}
  
  export interface Antenna { id : string; name : string; coord : Coord }

  export interface TagInfo { epc : string; color: string; coord: Coord}
   
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean; webServerTime : string; readerServerTime : string }
    tagsData : {epc : string; color : string; rssis : {value : number; timestamp : Date; age? : number; distance? : number}[]; coordinate? : {x : number; y : number} }[]
  }
} 
