/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');

var Shared = require('../shared/Shared.js');
 
export interface ReaderEvent { readerIp : string; ant : number; epc : string; rssi : number; timestamp : string }

export function mkReaderAntennas(readerAntennaLayout : Shared.AntennaLayout) : Shared.Antenna[] {
  var antennas = _.map(readerAntennaLayout.readerAntennaSpecs, (readerAntennaSpec) => {return mkAntennas(readerAntennaSpec.readerIp, readerAntennaSpec.antennaSpecs, readerAntennaLayout.shortMidRangeSpecs);});
  return _.flatten(antennas);
}

function mkAntennas(readerIp : string, antennaSpecs : Shared.AntennaSpec[], shortMidRangeSpecs : Shared.ShortMidRangeSpec[]) : Shared.Antenna[] {
  return antennaSpecs.map((antSpec, ix) => {
    var shortMidRange = _(shortMidRangeSpecs).findWhere({antennaName: antSpec.name});
    return {antennaId: {readerIp: readerIp, antennaNr: ix+1}, name: antSpec.name, coord: antSpec.coord, shortMidRange: shortMidRange}
  });
}
