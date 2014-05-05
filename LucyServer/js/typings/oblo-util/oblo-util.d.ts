// Type definitions for oblo-util 0.2.0
// Definitions by: Martijn Schrage <https://github.com/Oblosys/>
/// <reference path="../jquery/jquery.d.ts" />


interface ObloUtilStatic {
  debug : boolean;
  
  log(msg : any) : void;
  clip(min : number, max : number, x : number) : number;
  square(x : number) : number;
  replicate<X>(n : number, x : X) : X[];
  padZero(l : number, n : number) : string;
  showJSON(json : string, indent : number, depth : number) : string;
  showTime(date : Date) : string;
  showDate(date : Date) : string;
  readDate(dateStr : string) : Date;
  setAttr($elt : JQuery, attrName : string, isSet : boolean) : void;
}

declare var util: ObloUtilStatic;

declare module "oblo-util" {
	export = util;
}
