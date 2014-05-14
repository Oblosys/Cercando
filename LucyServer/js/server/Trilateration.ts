import _        = require('underscore');
import util     = require('oblo-util');

// epc : string, antNr : number just for logging
export function getRssiDistance(epc : string, antNr : number, rssi : number) {
  var dist3d = getDistance3d(rssi);
  //var dist2d = convert3dTo2d(dist3d);
  var dist2d = getDistance2dStaged(rssi);
  
  // log specific tag
  //if (epc == '0000000000000000000000000370870' && antNr == 3) {
  //  util.log(new Date().getSeconds()+' rssi: '+rssi.toFixed(1) + ' dist3d: '+dist3d.toFixed(2)+' dist2d: '+dist2d.toFixed(2));
  //}
  //var dist = convert3dTo2d(dist3d) /2;
  //util.log(dist3d + ' ' +dist);
  
  //return dist ? dist : 0;
  return dist2d;
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

export function testGetDistance2dStaged() {
  for (var i=-49; i>-70; i--) {
    util.log('dist2d(' + i + ') = ' + getDistance2dStaged(i) );
  }
}
//testGetDistance2dStaged();

export function getDistance3d(rssi : number) {
  //var d0 = 1;
  //var prd0 = -52;
  //var n = 0.5

  var d0 = 1/6000;
  var prd0 = 32;
  var n = 1
  return d0 * Math.exp((prd0-rssi)/(10*n));
}

export function convert3dTo2d(dist3d : number) : number {
  var meanVisitorHeight = 1.5;
  var antennaHeight = 2.7;
  var distSquared = util.square(dist3d) - util.square(antennaHeight - meanVisitorHeight); 
  var dist = distSquared > 0 ? Math.sqrt( distSquared ) : 0; // simply take zero if we're too close too the antenna
  return dist;
}

function isRecentRSSI(rssi : Shared.RSSI) : boolean {
  return rssi.age < 2000; // TODO: duplicated code from Locator.ts
}

export function trilaterateRssis(epc : string, antennas : Shared.Antenna[], rssis : Shared.RSSI[]) : {coord: Shared.Coord; isRecent : boolean} {
  //util.log('Trilaterate'+JSON.stringify(ranges));
  var recentRssis = _.filter(rssis, isRecentRSSI);
  var outdatedRssis = _.filter(rssis, (rssi:Shared.RSSI)=> {return !isRecentRSSI(rssi);});
  var isRecent = recentRssis.length >= 3;
  
  //util.log(recentRssis.length +' outdated:' +outdatedRssis.length);
  var recentCircles = mkCircles(antennas, recentRssis);
  var outdatedCircles = mkCircles(antennas, outdatedRssis);
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

function mkCircles (antennas : Shared.Antenna[], rssis : Shared.RSSI[]) : Circle[] {
  var circles : Circle[] = [];
  for (var i=0; i<rssis.length; i++) {
    if (rssis[i])
      var antNr = rssis[i].ant-1;
      circles.push({x: antennas[antNr].coord.x, y: antennas[antNr].coord.y, r: rssis[i].distance});
  }
  var sortedCircles = _.sortBy(circles, function(c:Circle) {return c.r;});
    
  return sortedCircles;
}

util.log('Trilateration test: '+JSON.stringify(trilaterate(
  {"x":0,"y":0,"r":4},{"x":1,"y":0,"r":1} ,{"x":0.5,"y":1,"r":1})));

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
  var x = (square(r1)-square(r2)+square(d)) / (2*d);

  var y = (square(r1)-square(r3)+square(i)+square(j)) / (2*j) - i/j*x;
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
function square(x : number) : number {
  return x*x;
}

function distance(x1 : number, y1 : number, x2 : number, y2 : number) : number {
  return Math.sqrt(square(x1-x2) + square(y1-y2));
} 
