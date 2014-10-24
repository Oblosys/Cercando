/*******************************************************************************/
/* ServerCommon.ts                                                             */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="../shared/Shared.ts" />

import _        = require('underscore');
import util     = require('oblo-util');

var Shared = require('../shared/Shared.js');
 
export interface ReaderEvent { readerIp : string; ant : number; epc : string; rssi : number; timestamp : string }

export function mkReaderAntennas(readerAntennaLayout : Shared.AntennaLayout, shortMidRangeSpecs : Shared.ShortMidRangeSpec[]) : Shared.Antenna[] {
  var antennas = _.map(readerAntennaLayout.readerAntennaSpecs, (readerAntennaSpec) => {return mkAntennas(readerAntennaSpec.readerIp, readerAntennaSpec.antennaSpecs, shortMidRangeSpecs);});
  return _.flatten(antennas);
}

function mkAntennas(readerIp : string, antennaSpecs : Shared.AntennaSpec[], shortMidRangeSpecs : Shared.ShortMidRangeSpec[]) : Shared.Antenna[] {
  return antennaSpecs.map((antSpec, ix) => {
    var shortMidRange = _(shortMidRangeSpecs).findWhere({antennaName: antSpec.name});
    return {antennaId: {readerIp: readerIp, antennaNr: ix+1}, name: antSpec.name, coord: antSpec.coord, shortMidRange: shortMidRange}
  });
}

export function log(msg : string) {
  var date = new Date();
  util.log( util.padZero(4, date.getFullYear()) + '-' + util.padZero(2, date.getMonth()+1) + '-' + util.padZero(2, date.getDate())
          + ' ' + util.showTime(date) + ': ' + msg);
}
