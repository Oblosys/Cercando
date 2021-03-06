/*******************************************************************************/
/* Shared.ts                                                                   */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

module Shared {
  // TODO: find a way to import other libs (e.g. underscore) in a type-safe way. Adding import hides Shared namespace.
  
  export var maxAntennaRangeShort = 0.25;
  export var maxAntennaRangeMid = 0.5;
  export var maxAntennaRangeLong = 1.5;

  export var shortMidRangeRssiThreshold = -50; // TODO: Maybe we need separate values for short and mid 

  var defaultAntennaLayoutNr = 0;

  export interface Coord { x: number; y : number }

  export interface UserRecord { username : string; passwordHash : string; firstName : string; lastName : string; eMail : string } // information in users.json

  export interface LoginResponse { userInfo : UserInfo; err : string } // response to login http request

  export interface AntennaLayout { name : string
                                 ; id: string
                                 ; backgroundImage? : string
                                 ; backgroundSize : {width : number; height : number} // in pixels
                                 ; backgroundOrigin : Coord                           // in pixels
                                 ; backgroundScale: number                            // pixels per meter
                                 ; screenZoomFactor: number                           // zoom factor by which background is shown on screen
                                 ; tagConfiguration : TagConfiguration[]
                                 ; readerAntennaSpecs : ReaderAntennaSpec[]
                                 }
  
  export interface ReaderAntennaSpec { readerIp : string; antennaSpecs : AntennaSpec[] }

  export var defaultDynamicConfig : DynamicConfig = { positioningInterval: 250
                                                    , positionSaveInterval: 1000
                                                    , smootherRC: 0.5
                                                    , staleAgeMs: 2000
                                                    , ancientAgeMs: 5000
                                                    , walkingSpeedKmHr: 5.0
                                                    , shortMidRangeSpecs: <ShortMidRangeSpec[]>[]
                                                    };

  // NOTE: keep this documentation in sync with explanation in LucyServer.ts at app.get('/query/view-config', ..
  export interface DynamicConfig { positioningInterval : number  // time in ms between computing coordinates of all tags (and purging old signals/tags)
                                 ; positionSaveInterval : number // keep this a multiple of positioningInterval to keep time between saves constant (save is only done on positioning)
                                 ; smootherRC : number           // filter constant for smoother (closer to 0.0 is more responsive but less stable, above 0.5 is already quite slow)
                                 ; staleAgeMs : number           // time before antenna signal is no longer used for positioning
                                 ; ancientAgeMs: number          // time before tag is purged
                                 ; walkingSpeedKmHr : number     // maximum assumed movement speed of (carriers of) tags
                                 ; shortMidRangeSpecs : ShortMidRangeSpec[]
                                 }
  // for dynamically checking uploaded config file:
  export var dynamicConfigType = { positioningInterval: 'number', positionSaveInterval: 'number', smootherRC: 'number'
                                 , staleAgeMs: 'number', ancientAgeMs: 'number'
                                 , walkingSpeedKmHr: 'number', shortMidRangeSpecs: 'object' 
                                 };
  
  export interface ShortMidRangeSpec { antennaName : string; isShortRange : boolean; serverIp : string }
  // for dynamically checking uploaded config file:
  export var shortMidRangeSpecType = {antennaName: 'string', isShortRange: 'boolean', serverIp: 'string'};
  
  export interface AntennaSpec { name : string; coord : Coord }

  export interface AntennaId { readerIp : string; antennaNr : number }
  
  // Besides the antennaId, we add the ShortMidRangeSpec to the antenna object, so we don't need to look it up each time.
  export interface Antenna extends AntennaSpec { antennaId : AntennaId; shortMidRange : ShortMidRangeSpec }
  
  export interface AntennaRSSI { antNr : number; value : number; timestamp : Date; distance : number; age : number /* milliseconds */}
   
  export interface LayoutInfo { selectedLayoutNr : number; names : string[] }
  
  export interface TagConfiguration { epc : string; color : string; testCoord : Coord} // testCoord is the actual (non-computed) position of this tag in a test setup
  
  export interface AntennaInfo { name : string
                               ; backgroundImage : string
                               ; backgroundSize : {width : number; height : number} // in pixels
                               ; backgroundOrigin : Coord                           // in pixels
                               ; backgroundScale: number                            // pixels per meter
                               ; screenZoomFactor: number                           // zoom factor by which background is shown on screen
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
                              ; staleAgeMs : number
                              ; ancientAgeMs: number
                              ; selectedAntennaLayoutNr : number
                              ; unknownAntennaIds : AntennaId[]
                              ; diColoreStatus : { locationServerOperational : boolean ; shortMidRangeServers : {antennaName : string; operational : boolean}[] }
                              }
  
  export interface UserInfo { username : string; firstName : string } // part of SessionUser that is sent to client
  
  export interface SessionInfo { userInfo : UserInfo; nrOfSessions : number } // part of SessionState that is sent to client
  
  // Object that is sent to the client periodically
  export interface TagsServerInfo { tagsInfo : TagsInfo; serverInfo : ServerInfo; sessionInfo : SessionInfo }
  
  export interface ServerState
    { status : { isConnected : boolean; isSaving : boolean; replayFileName : string } // replayFileName is relative to saveDirectoryPath and without .csv extension
    ; selectedAntennaLayoutNr : number
    ; liveTagsState : TagsState
    ; unknownAntennaIds : AntennaId[]
    ; diColoreStatus : { locationServerOperational : boolean ; shortMidRangeServers : {antennaName : string; operational : boolean}[] } 
    }
  
  export interface SessionState { sessionId : string; lastAccess : Date; user : SessionUser
                                ; tagsState : TagsState; replaySession : ReplaySession } // user is null if no user is logged in
  
  export interface SessionUser { username : string; firstName : string; lastName : string; eMail : string } // user information the session keeps track of
  
  export interface ReplaySession { fileReader : any; startClockTime : number; startEventTime : number }

  export function initialTagsServerInfo() : TagsServerInfo {
    return { tagsInfo: { mostRecentEventTimeMs: null, tagsData : []}
           , serverInfo:
             { status: {isConnected: false, isSaving: false, replayFileName: null}
             , staleAgeMs:   0
             , ancientAgeMs: 0
             , selectedAntennaLayoutNr: defaultAntennaLayoutNr
             , unknownAntennaIds: []
             , diColoreStatus: { locationServerOperational: false, shortMidRangeServers : [] }
             }
           , sessionInfo: null 
           }
  }
  
  export function initialServerState() : ServerState {
    return {
      status: {isConnected: false, isSaving: false, replayFileName: null},
      selectedAntennaLayoutNr: defaultAntennaLayoutNr,
      liveTagsState: {mostRecentEventTimeMs: null, previousPositioningTimeMs: null, tagsData: []},
      unknownAntennaIds: [],
      diColoreStatus: { locationServerOperational: false, shortMidRangeServers : [] }
    };
  }
  
  export function getAntennaMaxRange(antenna : Antenna) : number {
    return antenna.shortMidRange ? (antenna.shortMidRange.isShortRange ? maxAntennaRangeShort : maxAntennaRangeMid) 
                                 : maxAntennaRangeLong;
  }
  
  export function isRecentAntennaRSSI(staleAgeMs : number, antennaRssi : AntennaRSSI) : boolean {
    return antennaRssi.age < staleAgeMs;
  }

} 

// Automatically export all declarations in this module. (Necessary, because in node modules we import this as a .js module instead of .ts)  
declare var exports : any;
if (typeof exports != 'undefined') {
  for (var decl in Shared) {
    if (Shared.hasOwnProperty(decl)) {
      var p = (<any>Shared)[decl]; // signature to prevent warning about index signature 'any' type
      exports[decl] = p;
    }
  }
}
