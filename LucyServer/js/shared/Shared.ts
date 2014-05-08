module Shared {
  export interface ServerState {
    status : {isConnected : boolean; isSaving : boolean}
    tagData : {epc : string; color : string; rssis : number[]; coordinate? : {x : number; y : number} }[]
  }
} 