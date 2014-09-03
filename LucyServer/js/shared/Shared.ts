module Shared {
  // TODO: find a way to import other libs (e.g. underscore) in a type-safe way. Adding import hides Shared namespace.
  
  export var maxAntennaRangeShort = 0.25;
  export var maxAntennaRangeMid = 0.5;
  export var maxAntennaRangeLong = 1.5;

  export var shortMidRagneRssiThreshold = -50; // TODO: Maybe we need separate values for short and mid 

  export var staleAgeMs = 2000;
  export var ancientAgeMs = 5000;
  
  export interface Coord { x: number; y : number}

  export interface AntennaLayout { name : string; dimensions: {width : number; height : number}; scale: number
                                 ; backgroundImage? : string
                                 ; tagConfiguration : TagConfiguration[]
                                 ; readerAntennaSpecs : ReaderAntennaSpec[]
                                 }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export interface ShortMidRangeSpec { antennaName : string; isShortRange : boolean; serverIp : string }
  export var shortMidRangeSpecKeys = ['antennaName', 'isShortRange', 'serverIp']; // for dynamically checking uploaded config file
  
  export interface AntennaSpec { name : string; coord : Coord }

  export interface AntennaId { readerIp : string; antennaNr : number }
  
  // Besides the antennaId, we add the ShortMidRangeSpec to the antenna object, so we don't need to look it up each time.
  export interface Antenna extends AntennaSpec { antennaId : AntennaId; shortMidRange : ShortMidRangeSpec }
  
  export interface AntennaRSSI { antNr : number; value : number; timestamp : Date; distance : number; age : number /* milliseconds */}
   
  export interface LayoutInfo { selectedLayoutNr : number; names : string[] }
  
  export interface TagConfiguration { epc : string; color : string; testCoord : Coord} // testCoord is the actual (non-computed) position of this tag in a test setup
  
  export interface AntennaInfo { name : string; dimensions: {width : number; height : number}
                               ; scale: number // pixels per meter
                               ; backgroundImage? : string
                               ; tagConfiguration : TagConfiguration[]
                               ; antennaSpecs : Antenna[] }
  
  export interface ReplayInfo { contents : DirEntry[] }
  
  export interface DirEntry { name : string; contents : DirEntry[] }

  export interface TagMetaData { name : string; color : string }
  
  export interface TagData { epc : string; antennaRssis : AntennaRSSI[]
                           ; coordinate? : { coord: {x : number; y : number}; isRecent : boolean } 
                           ; metaData : TagMetaData }[]
  
  // Format for communicating with diColore servers
  export interface DiColoreTagLocations { timestamp : string; tagLocations : { epc : string ; x : number; y : number}[] } 
  
  // Format for communicating with diColore servers
  export interface DiColoreTagDistances { antennaName : string
                                        ; tagDistances : { epc: string
                                                         ; rssi: number
                                                         ; distance : number}[] }  

  export interface TagsState { mostRecentEventTimeMs : number     // time in milliseconds of the latest reader event (may be in the past for replays)
                             ; previousPositioningTimeMs : number // contains the value of latestReaderEventTimeMs at the previous moment of positioning     
                             ; tagsData : TagData[]
                             }

  // The part of TagsData that is sent to the client
  export interface TagsInfo { mostRecentEventTimeMs : number
                            ; tagsData : TagData[]
                            }

  // The part of ServerState that is sent to the client
  export interface ServerInfo { status : { isConnected : boolean; isSaving : boolean; replayFileName : string }
                              ; selectedAntennaLayoutNr : number
                              ; unknownAntennaIds : AntennaId[]
                              ; diColoreStatus : { locationServerOperational : boolean ; shortMidRangeServers : {antennaName : string; operational : boolean}[] }
                              }
  
  // Object that is sent to the client periodically
  export interface TagsServerInfo { tagsInfo : TagsInfo; serverInfo : ServerInfo }
  
  export interface ServerState {
    status : { isConnected : boolean; isSaving : boolean; replayFileName : string } // replayFileName is relative to saveDirectoryPath and without .csv extension
    selectedAntennaLayoutNr : number
    liveTagsInfo : TagsState
    unknownAntennaIds : AntennaId[]
    diColoreStatus : { locationServerOperational : boolean ; shortMidRangeServers : {antennaName : string; operational : boolean}[] } 
  }
  
  export interface ReplaySession { fileReader : any; startClockTime : number; startEventTime : number; tagsInfo : TagsState }

  export function initialTagsServerInfo() : TagsServerInfo {
    return { tagsInfo : { mostRecentEventTimeMs: null, previousPositioningTimeMs: null, tagsData : []}
           , serverInfo :
             { status: {isConnected: false, isSaving: false, replayFileName: null},
               selectedAntennaLayoutNr: 0,
               unknownAntennaIds: [],
               diColoreStatus: { locationServerOperational: false, shortMidRangeServers : [] }
             }
           }
  }
  
  export function initialServerState() : ServerState {
    return {
      status: {isConnected: false, isSaving: false, replayFileName: null},
      selectedAntennaLayoutNr: 0,
      liveTagsInfo: {mostRecentEventTimeMs: null, previousPositioningTimeMs: null, mostRecentEventTime: null, tagsData: []},
      unknownAntennaIds: [],
      diColoreStatus: { locationServerOperational: false, shortMidRangeServers : [] }
    };
  }
  
  export function getAntennaMaxRange(antenna : Antenna) : number {
    return antenna.shortMidRange ? (antenna.shortMidRange.isShortRange ? maxAntennaRangeShort : maxAntennaRangeMid) 
                                 : maxAntennaRangeLong;
  }
  
  export function isRecentAntennaRSSI(antennaRssi : AntennaRSSI) : boolean {
    return antennaRssi.age < staleAgeMs;
  }

} 

// Workaround for preventing typescript warning about implicit any on index signature
// See: http://typescript.codeplex.com/discussions/535628
interface Object {
  [idx: string]: any;
}

// Automatically export all declarations in this module. (Necessary, because in node modules we import this as a .js module instead of .ts)  
declare var exports : any;
if (typeof exports != 'undefined') {
  for (var decl in Shared) {
    if (Shared.hasOwnProperty(decl))
      exports[decl] = Shared[decl];
  }
}
