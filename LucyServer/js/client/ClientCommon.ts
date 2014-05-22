/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />

// Global variables. TODO: put these in some kind of state object
declare var scale : number;
declare var origin : Shared.Coord;

module ClientCommon {
  
  // utility functions
  
  export function showTime(date : Date) {
    return util.padZero(2, date.getHours()) + ":" + util.padZero(2, date.getMinutes()) + ":" + util.padZero(2, date.getSeconds()) 
  }  
  
  // convert betweem coordinates in meters and coordinates in pixels
  
  export function toScreen(coord : {x : number; y : number }) {
    return {x: toScreenX(coord.x), y: toScreenY(coord.y)};
  }
  
  export function toScreenX(x : number) {
    return x*scale + origin.x;
  }
  
  export function toScreenY(y : number) {
    return y*scale + origin.y;
  }

  export function fromScreenX(x : number) {
    return (x - origin.x)/scale;
  }
  
  export function fromScreenY(y : number) {
    return (y - origin.y)/scale;
  }
}