/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');

var Shared = require('../shared/Shared.js');
 
export interface ReaderEvent { readerIp : string; ant : number; epc : string; rssi : number
                             ; firstSeen : string; lastSeen : string }

export function mkReaderAntennas(readerAntennaSpecs : Shared.ReaderAntennaSpec[]) : Shared.Antenna[] {
  var antennas = _.map(readerAntennaSpecs, (readerAntennaSpec) => {return mkAntennas(readerAntennaSpec.readerIp, readerAntennaSpec.antennaSpecs);});
  return _.flatten(antennas);
}

function mkAntennas(readerIp : string, antennaLocations : Shared.AntennaSpec[] ) : Shared.Antenna[] {
  return antennaLocations.map((antSpec, ix) => {
    return {antennaId: {readerIp: readerIp, antennaNr: ix+1}, name: antSpec.name, coord: antSpec.coord, shortMidRangeTarget: antSpec.shortMidRangeTarget}
  });
}
