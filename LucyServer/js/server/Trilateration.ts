import _        = require('underscore');
import util     = require('oblo-util');

export function getRssiDistance(rssi : number) {
  var dist3d = getDistance3d(rssi);
  //var dist = convert3dTo2d(dist3d) /2;
  //util.log(dist3d + ' ' +dist);
  
  //return dist ? dist : 0;
  return dist3d;
}

function getDistance3d(rssi : number) {
  //var d0 = 1;
  //var prd0 = -52;
  //var n = 0.5

  var d0 = 1/6000;
  var prd0 = 32;
  var n = 1
  return d0 * Math.exp((prd0-rssi)/(10*n));
}

function convert3dTo2d(dist3d : number) {
  var meanVisitorHeight = 1.5;
  var antennaHeight = 2.7;
  
  return  Math.sqrt( util.square(dist3d) - util.square(antennaHeight - meanVisitorHeight) );
}

function isRecentRSSI(rssi : Shared.RSSI) : boolean {
  return rssi.age < 2000; // TODO: duplicated code from Locator.ts
}

export function trilaterateRssis(antennas : Shared.Antenna[], rssis : Shared.RSSI[]) : {coord: Shared.Coord; isRecent : boolean} {
  //util.log('Trilaterate'+JSON.stringify(ranges));
  var recentRssis = _.filter(rssis, isRecentRSSI);
  var outdatedRssis = _.filter(rssis, (rssi:Shared.RSSI)=> {return !isRecentRSSI(rssi);});
  var isRecent = recentRssis.length >= 3;
  
  util.log(recentRssis.length +' outdated:' +outdatedRssis.length);
  var recentCircles = mkCircles(antennas, recentRssis);
  var outdatedCircles = mkCircles(antennas, outdatedRssis);
  var sortedCircles = _.union(recentCircles, outdatedCircles).slice(0,3);
  var result : {coord: Shared.Coord; isRecent : boolean};
  if (sortedCircles.length == 3) {
    //var triangle = [sortedCircles[0],sortedCircles[1],sortedCircles[2]];
    util.log(JSON.stringify(sortedCircles));
    var coord = trilaterate(sortedCircles[0],sortedCircles[1],sortedCircles[2]);
    if (coord.x==null || coord.y==null || isNaN(coord.x) || isNaN(coord.y))
      coord = null;
    //util.log('coord '+JSON.stringify(coord) + 'X:'+coord.x+ ' x is null: '+(coord.x==null));
    result = {coord: coord, isRecent : isRecent};
  } else {
    result = null;
  } 
  //util.log(JSON.stringify(result));
  return result;  
}


interface Circle { x: number; y : number; r : number; inTriangle : boolean};

function mkCircles (antennas : Shared.Antenna[], rssis : Shared.RSSI[]) : Circle[] {
  var circles : Circle[] = [];
  for (var i=0; i<antennas.length; i++) {
    if (rssis[i])
      circles.push({x: antennas[i].coord.x, y: antennas[i].coord.y, r: rssis[i].distance, inTriangle: false});
  }
  var sortedCircles = _.sortBy(circles, function(c:Circle) {return c.r;});
    
  return sortedCircles;
}

function trilaterate(c1 : Circle, c2 : Circle, c3 : Circle) : Shared.Coord {
  // assume 3 receivers
  // http://en.wikipedia.org/wiki/Trilateration
  var r1 = c1.r;
  var r2 = c2.r;
  var r3 = c3.r;
  
  //  (0,0)   (d,0)
  //
  //      (i,j)
 
  var ct2 = transform(c1.x,c1.y, c2.x,c2.y, c2.x,c2.y);
  var ct3 = transform(c1.x,c1.y, c2.x,c2.y, c3.x,c3.y);

  
  var d = ct2.x;
  
  var i = ct3.x;
  var j = ct3.y;

  var x = (square(r1)-square(r2)+square(d)) / (2*d);

  var y = (square(r1)-square(r3)+square(i)+square(j)) / (2*j) - i/j*x;
  
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
function square(x : number) : number {
  return x*x;
}

function distance(x1 : number, y1 : number, x2 : number, y2 : number) : number {
  return Math.sqrt(square(x1-x2) + square(y1-y2));
} 
