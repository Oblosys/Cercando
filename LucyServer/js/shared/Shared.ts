module Shared {
  export interface Coord { x: number; y : number}
  
  export interface Antenna { id : string; name : string; coord : Coord }

  export interface TagInfo { epc : string; color: string; coord: Coord}
   
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean}
    tagsData : {epc : string; color : string; rssis : number[]; distances? : number[]; coordinate? : {x : number; y : number} }[]
  }
} 
