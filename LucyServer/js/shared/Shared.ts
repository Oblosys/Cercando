module Shared {
  export interface ServerState {
    status: {isConnected : boolean; isSaving : boolean}
    tagRssis: {epc : string; rssis : number[]}[]
  }
}
