/*******************************************************************************/
/* Trilateration.ts                                                            */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />

var useIncrementalTrilateration = true;
var use2dDistance = true;

var meanVisitorHeight = 1.5;
var antennaHeight = 3.0;


import _        = require('underscore');
import util     = require('oblo-util');

var shared = <typeof Shared>require('../shared/Shared.js'); // for functions and vars we need to use lower case, otherwise Eclipse autocomplete fails

export function getPosition(dynConfig : Shared.DynamicConfig, antennas : Shared.Antenna[], epc : string, oldCoord : Shared.Coord, dt : number, antennaRssis : Shared.AntennaRSSI[]) : {coord: Shared.Coord; isRecent : boolean} {
  return useIncrementalTrilateration ?
         incrementalTrilateration(dynConfig, antennas, epc, oldCoord, dt, antennaRssis) : trilateration(dynConfig, epc, antennas, antennaRssis);
}


// Distance functions

export function getRssiForDistance(dist : number) {
  return getRssiForDistance3d(use2dDistance ? convert2dTo3d(dist) : dist);
}


// epc & antNr just for logging
export function getDistanceForRssi(epc : string, antName : string, rssi : number) {
  var dist3d = getDistanceForRssi3d(rssi);
  return (use2dDistance ? convert3dTo2d(dist3d) : dist3d)
  //var dist2d = dist3d;//getDistance2dStaged(rssi);
  
  // log specific tag
  //if (epc == '0000000000000000000000000370870' && antNr == 3) {
  //  util.log(new Date().getSeconds()+' rssi: '+rssi.toFixed(1) + ' dist3d: '+dist3d.toFixed(2)+' dist2d: '+dist2d.toFixed(2));
  //}
  //var dist = convert3dTo2d(dist3d) /2;
  //util.log(dist3d + ' ' +dist);
  
  //return dist ? dist : 0;
  //return dist2d;
}


// Very basic interval-based linear distance function
export function getDistance2dStaged(rssi : number) {
  var intervals = [{r:-50,d:0},{r:-54,d:0.5},{r:-58,d:1.0},{r:-64,d:1.5},{r:-68,d:2.0}]; 
  // These intervals give acceptable results for the horizontal antenna setup
  
  
  if (rssi > intervals[0].r) // rssi is negative
    return intervals[0].d;
  
  for (var i=1; i < intervals.length; i++) {
    var rssiInterval = intervals[i-1].r - intervals[i].r;
    var distInterval = intervals[i].d - intervals[i-1].d;
    
    if (rssi > intervals[i].r) // remember rssi is negative, so this means we're in the right interval
      return intervals[i-1].d + distInterval * (intervals[i-1].r - rssi) / rssiInterval;
  }
  return intervals[intervals.length-1].d;
}

function testGetDistance2dStaged() {
  for (var i=-49; i>-70; i--) {
    util.log('dist2d(' + i + ') = ' + getDistance2dStaged(i) );
  }
}
//testGetDistance2dStaged();

//prd0 is signal in d0 and n is medium (between 2 and 4)

var d0 = 1;     // Google: 1 * exp((-52-x)/(10*2)) from -30 to -80
var prd0 = -52; // Google: -52 - 10*2*log(x/1) from 0 to 5
var n = 2
//var d0 = 1/6000 * 0.7;
//var prd0 = 32;
//var n = 1


  // Google: 1/6000*0.7*exp ((32-x) / (10*1)) from -30 to -80
export function getDistanceForRssi3d(rssi : number) {
  return d0 * Math.exp((prd0-rssi)/(10*n));
}

export function getRssiForDistance2d(dist2d : number) {
  var dist3d = dist2d;
  return getRssiForDistance3d(dist3d);  
}

export function getRssiForDistance3d(dist : number) {
  // dist = d0 * Math.exp((prd0-rssi)/(10*n))
  // dist/d0 = Math.exp((prd0-rssi)/(10*n))
  // Math.log(dist/d0) = (prd0-rssi)/(10*n)
  // Math.log(dist/d0)*(10*n) = prd0-rssi
  // Math.log(dist/d0)*(10*n) = prd0-rssi
  // rssi = prd0 - Math.log(dist/d0)*(10*n);
  return prd0 - Math.log(dist/d0)*(10*n);
}


export function convert2dTo3d(dist2d : number) : number {
  return Math.sqrt( util.square(dist2d) + util.square(antennaHeight - meanVisitorHeight));
}

export function convert3dTo2d(dist3d : number) : number {
  var distSquared = util.square(dist3d) - util.square(antennaHeight - meanVisitorHeight); 
  var dist = distSquared > 0 ? Math.sqrt( distSquared ) : 0; // simply take zero if we're too close too the antenna
  return dist;
}


// Incremental trilateration 

/* For all antennas with a non-stale signal (higher than -100) determine where the signal circle crosses the line between
   the old tag position and the antenna's coordinates. This point may be towards the antenna or away from it (if the tag is
   inside the circle.) Consider these points as vectors starting at the old tag position, and compute the mean vector (variable 'movementVector'
   below).

   The mean vector is applied to the old position, while taking into account dt and the maximum movement speed.

   The resulting algorithm converges to trilateration, when the latter has a solution, but is more robust when it doesn't.
  */

export function incrementalTrilateration(dynConfig : Shared.DynamicConfig, antennas : Shared.Antenna[], epc : string, oldCoord : Shared.Coord, dt : number, antennaRssis : Shared.AntennaRSSI[]): {coord: Shared.Coord; isRecent : boolean} {
  var antennaCoords : {x:number; y:number; signalDistance:number}[] = []; // get positions of antennas that have a signal
  _(antennaRssis).each((antennaRssi) => {
    if (antennaRssi.value > -100 && shared.isRecentAntennaRSSI(dynConfig.staleAgeMs, antennaRssi)) { // -100 is never reached, could be made dynamic if we need to vary it.
      var antNr = antennaRssi.antNr;
      antennaCoords.push({x: antennas[antNr].coord.x, y: antennas[antNr].coord.y, signalDistance: antennaRssi.distance});
    }
  });

  if (antennaCoords.length == 0) { // if there's no recent signals, return the old coordinate as nonrecent
    return {coord: oldCoord, isRecent: false};
  } 
  
  var walkingSpeedKmHr = dynConfig.walkingSpeedKmHr;
  
  var oldCoordWasNull = oldCoord == null
  oldCoord = oldCoordWasNull ? {x: 0, y:0} : oldCoord;
   
  var movementVectors : PositionVector[] = _(antennaCoords).map((antennaCoord) => {
    //return getPositionVector(oldCoord, antennaCoord) // Ernst: simply return vector itself
    
    //util.log(oldCoord);
    var positionVector = getPositionVector(oldCoord, antennaCoord);
    var antennaDistance = getVectorLength(positionVector);
    var vLength = antennaDistance - antennaCoord.signalDistance; // may be negative (if we need to move away from the antenna)
    // NOTE: here we express a preference for a point between the current location and the antenna. The point could also be 
    // beyond the antenna (vLength = antennaDistance + antennaCoord.signalDistance), which is not handled well now.
    // The point lying before the antenna is the more common case though. 
     
    var movementVector = antennaDistance > 0.0000001 ? scaleVector( vLength/antennaDistance, positionVector) : positionVector;
    return movementVector;
  });

  var movementVector = scaleVector(1/movementVectors.length, getVectorSum(movementVectors));

  var newCoord : Shared.Coord;
  if (oldCoordWasNull) { // if there was no previous point, we take the movementVector as the starting point
    newCoord = {x: movementVector.x, y: movementVector.y};
  } else {
    var movement = getVectorLength(movementVector);
    var maxDistance = walkingSpeedKmHr/3.6*dt;
    if (movement > maxDistance) { // make sure we don't exceed the walking speed for this time slice
      movementVector = scaleVector(maxDistance / movement, movementVector);
    }
    
    var deltaVector = movementVector;// scaleVector (dt, movementVector); 
    
    newCoord = {x: oldCoord.x + deltaVector.x, y: oldCoord.y + deltaVector.y};
  }
  return {coord: newCoord, isRecent: true};
}


// Normal Trilateration


export function trilateration(dynConfig : Shared.DynamicConfig, epc : string, antennas : Shared.Antenna[], antennaRssis : Shared.AntennaRSSI[]) : {coord: Shared.Coord; isRecent : boolean} {
  //util.log('Trilaterate'+JSON.stringify(ranges));
  var recentAntennaRssis   = _.filter(antennaRssis, (rssi:Shared.AntennaRSSI)=> {return shared.isRecentAntennaRSSI(dynConfig.staleAgeMs, rssi);});
  var outdatedAntennaRssis = _.filter(antennaRssis, (rssi:Shared.AntennaRSSI)=> {return !shared.isRecentAntennaRSSI(dynConfig.staleAgeMs, rssi);});
  var isRecent = recentAntennaRssis.length >= 3;
  
  //util.log(recentRssis.length +' outdated:' +outdatedRssis.length);
  var recentCircles = mkCircles(antennas, recentAntennaRssis);
  var outdatedCircles = mkCircles(antennas, outdatedAntennaRssis);
  var sortedCircles = _.union(recentCircles, outdatedCircles).slice(0,3);
  var result : {coord: Shared.Coord; isRecent : boolean};
  if (sortedCircles.length == 3) {
    //var triangle = [sortedCircles[0],sortedCircles[1],sortedCircles[2]];
    //util.log(JSON.stringify(sortedCircles));
    var coord = trilaterate(sortedCircles[0],sortedCircles[1],sortedCircles[2]);
    if (coord.x==null || coord.y==null || isNaN(coord.x) || isNaN(coord.y))
      coord = null;
    
    // log specific tag
    //if (epc == '0000000000000000000000000370870')
    //  util.log('trilateration:' + JSON.stringify(coord) + ' '+JSON.stringify(sortedCircles) + JSON.stringify(rssis));
    //util.log('coord '+JSON.stringify(coord) + 'X:'+coord.x+ ' x is null: '+(coord.x==null));
    result = {coord: coord, isRecent : isRecent};
  } else {
    result = null;
  } 
  //util.log(JSON.stringify(result));
  return result;  
}


interface Circle { x: number; y : number; r : number};

function mkCircles (antennas : Shared.Antenna[], antennaRssis : Shared.AntennaRSSI[]) : Circle[] {
  var circles : Circle[] = [];
  for (var i=0; i<antennaRssis.length; i++) {
    if (antennaRssis[i]) {
      var antNr = antennaRssis[i].antNr;
      circles.push({x: antennas[antNr].coord.x, y: antennas[antNr].coord.y, r: antennaRssis[i].distance});
    }
  }
  var sortedCircles = _.sortBy(circles, function(c:Circle) {return c.r;});
    
  return sortedCircles;
}

//util.log('Trilateration test: '+JSON.stringify(trilaterate({"x":0,"y":0,"r":4},{"x":1,"y":0,"r":1} ,{"x":0.5,"y":1,"r":1})));

function trilaterate(c1 : Circle, c2 : Circle, c3 : Circle) : Shared.Coord {
  // assume 3 receivers
  // http://en.wikipedia.org/wiki/Trilateration
  var r1 = c1.r;
  var r2 = c2.r;
  var r3 = c3.r;
  
  //  ct1:(0,0)    ct3:(d,0)
  //
  //        ct2:(i,j)
 
  var ct2 = transform(c1.x,c1.y, c2.x,c2.y, c2.x,c2.y);
  var ct3 = transform(c1.x,c1.y, c2.x,c2.y, c3.x,c3.y);

  
  var d = ct2.x;
  var i = ct3.x;
  var j = ct3.y;

  /*
  util.log('r1= '+r1);
  util.log('r2= '+r2);
  util.log('r3= '+r3);
  util.log('d=  '+d);
  util.log('i=  '+i);
  util.log('j=  '+j);
  */
  // d and j are never 0: two antennas won't have the same coordinate (-> d>0) and are not on a straight line (-> j>0)
  var x = (util.square(r1)-util.square(r2)+util.square(d)) / (2*d);

  var y = (util.square(r1)-util.square(r3)+util.square(i)+util.square(j)) / (2*j) - i/j*x;
  //util.log('(x,y): '+x+','+y);
  
  var p = untransform(c1.x,c1.y,c2.x,c2.y, x, y);

  return p;
}
// tranform p(x,y) to coordinate system in which P1 = (0,0) and P2( distance(P1,P2), 0)
function transform(x1 : number, sy1 : number, x2 : number, sy2 : number, x : number, sy : number) : Shared.Coord {
  // positive y is downward in screencoordinates, so we need to flip y's
  var y1 = -sy1;
  var y2 = -sy2;
  var y = -sy;
  
  var angleP1P2andP1P = Math.atan2(y-y1,x-x1) - Math.atan2(y2-y1,x2-x1); // NOTE: atan2 is (y,x) instead of (x,y) 
  var distanceP1toP = distance(x1,y1,x,y);
  //log(angle);
  var x = Math.cos(angleP1P2andP1P)*distanceP1toP;
  var y = Math.sin(angleP1P2andP1P)*distanceP1toP;
 
  return {x:x, y: -y}; // flip y again for screen coordinates  
}

function untransform(x1 : number, sy1 : number, x2 : number, sy2 : number, x : number, sy : number) : Shared.Coord {
  // positive y is downward in screencoordinates, so we need to flip y's
  var y1 = -sy1;
  var y2 = -sy2;
  var y = -sy;
  var angleP1P2andP1P = Math.atan2(y,x);
  var angleP1P2andXAxis = Math.atan2(y2-y1,x2-x1);
  var angleP1PandXAxis = angleP1P2andP1P + angleP1P2andXAxis;

  var distanceP1toP = distance(0,0,x,y);
  var x = x1+Math.cos(angleP1PandXAxis)*distanceP1toP;//Math.cos(angleP1PandXAxis)*distanceP1toP;
  var y = y1+Math.sin(angleP1PandXAxis)*distanceP1toP;//parseInt(y1);
  //util.log(''+distanceP1toP + angleP1P2andXAxis + ' ' + angleP1P2andP1P + ' ' + angleP1PandXAxis);

  return {x:x, y: -y};
}

// Utility functions

export function distance(x1 : number, y1 : number, x2 : number, y2 : number) : number {
  return Math.sqrt(util.square(x1-x2) + util.square(y1-y2));
} 

// PositionVector functions

interface PositionVector extends Shared.Coord {} // Vector starts in (0,0)

function getPositionVector(origin : Shared.Coord, coord : Shared.Coord) : PositionVector {
  return {x: coord.x-origin.x, y: coord.y-origin.y};
}

function getVectorSum(vectors : PositionVector[]) {
  var sumVectorX = 0, sumVectorY = 0;
  _(vectors).each((vector) => { sumVectorX += vector.x; sumVectorY += vector.y });
  return {x: sumVectorX, y:sumVectorY};
}

function getVectorLength(v : PositionVector) {
  return distance(0, 0, v.x, v.y);
}

function scaleVector(scale : number, v : PositionVector) {
  return {x: scale*v.x, y: scale*v.y};
}

