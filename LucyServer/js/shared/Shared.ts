module Shared {
  export interface Coord { x: number; y : number};

  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean}
    tagsData : {epc : string; color : string; rssis : number[]; distances? : number[]; coordinate? : {x : number; y : number} }[]
  }
} 
