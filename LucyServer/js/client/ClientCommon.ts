/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />

// Global variables. TODO: put these in some kind of state object

declare var refreshDelay : number;
declare var scale : number;
declare var origin : Shared.Coord;
declare var floorWidth : number;
declare var floorHeight : number;
declare var allAntennas : Shared.Antenna[];
declare var allTagInfo : Shared.TagInfo[];

module ClientCommon {

  var nrOfMarkers = 10; // TODO: should be dynamic
  
  // d3 common code
  
  export function resizeFloor(dim : {width : number; height : number}) {
    floorWidth = scale*dim.width;
    floorHeight = scale*dim.height;
    origin = {x: floorWidth/2, y: floorHeight/2};
  
    d3.select('#floor > svg').attr('width', floorWidth).attr('height', floorHeight);
    d3.select('#floor-background-rect').attr('width', floorWidth).attr('height', floorHeight);
    d3.select('#floor-background-image').attr('width', floorWidth).attr('height', floorHeight);  
  }
  
  export function setBackgroundImage(backgroundImage : string) {
    if (backgroundImage) {
      util.log(backgroundImage);
      d3.select('#floor-background-image').attr('xlink:href', '/img/'+backgroundImage).attr('visibility', 'visible');
    } else {
      d3.select('#floor-background-image').attr('visibility', 'hidden');
    }
  }
  
  export function createAntennaMarkers() {
    var antennaPlaneSVG = d3.select('#antenna-plane');
  
    _.each(allAntennas, (ant, i) => createAntennaMarker(antennaPlaneSVG, ant, i));
  
  }
  
  export function createAntennaMarker(planeSVG : D3.Selection, antenna : Shared.Antenna, antennaNr : number) {
    var pos = ClientCommon.toScreen(antenna.coord);
    var antennaClass = (antenna.shortMidRangeTarget ? (antenna.shortMidRangeTarget.isShortRange ? 'short' : 'mid') :'long') +
                       '-range';
    var antennaSVG = planeSVG.append('g').attr('id', 'a-'+antennaNr).attr('class', 'antenna-marker '+antennaClass)
                       .attr('transform', 'translate('+pos.x+','+pos.y+')');
    // 'g' element with translate is annoying, but nested svg creates clipping problems
    
    // styling is done with css (unfortunately, r is not a css attribute)
    antennaSVG.append('circle').attr('class', 'antenna-max-range').attr('r', Shared.getAntennaMaxRange(antenna)*scale)
    antennaSVG.append('circle').attr('class', 'antenna-shape').attr('r', 8)
    var text = antennaSVG.append('text').attr('id', 'l-'+antennaNr).attr('class', 'antenna-label').text(antenna.name);
    var labelSize = $('#l-'+antennaNr)[0].getBoundingClientRect();
    //util.log('label ' +antenna.name + ' ' , labelSize.width);
    text.attr('x', -labelSize.width/2 + 1)
        .attr('y', labelSize.height/2 - 3.5)
  }

  export function createTagMarker(tag : Shared.TagData) {
    var trilaterationPlaneSVG = d3.select('#trilateration-plane');
   
    trilaterationPlaneSVG.append('circle').attr('id', mkTagId(tag)).attr('class', 'visitor-marker')
      .style('stroke', 'white')
      .style('fill', 'yellow')
      .attr('r', 6)
      .attr('cx', ClientCommon.toScreenX(0))
      .attr('cy', ClientCommon.toScreenY(0))
      .style('display', 'none');
  }
  
  export function removeTagMarker(tag : Shared.TagData) {
    $('#'+mkTagId(tag)).remove();
  }

  export function createSignalMarker(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    var rssiPlaneSVG = d3.select('#rssi-plane');

    var antNr = antennaRssi.antNr;
    var pos = ClientCommon.toScreen(allAntennas[antNr].coord);
    rssiPlaneSVG.append('circle').attr('id', mkSignalId(antennaRssi, tag)).attr('class', 'signal-marker')
              .style('stroke', getTagInfo(tag.epc).color)
              .style('fill', 'transparent')
              .attr('cx', pos.x)
              .attr('cy', pos.y);
  }

  export function removeSignalMarker(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    $('#'+mkSignalId(antennaRssi, tag)).remove();
  }

  export function setSignalMarkerRssi(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    var isRangeRecent = antennaRssi.age<2000; // todo: do this server side

    var signal = d3.select('#'+mkSignalId(antennaRssi, tag));
    signal.transition()
          .duration(refreshDelay)
          .style('stroke-dasharray', isRangeRecent ? 'none' : '5,2')
          .attr('r', antennaRssi.distance*scale);          
  }
  
  export function drawTagSetup() {
    var tagInfoPlaneSVG = d3.select('#tag-info-plane');
    _(allTagInfo).each((tag, tagNr)=>{
      if (tag.coord) {
        var tagCoord = ClientCommon.toScreen(tag.coord);
        drawSquare(tagInfoPlaneSVG, tagCoord.x, tagCoord.y, 10, tag.color);
      }
    });
  }
  
  export function drawSquare(planeSVG : D3.Selection, x : number, y : number, size : number, color : string) {
    planeSVG.append('rect')
      .style('stroke', 'white')
      .style('fill', color)
      .attr('x', x-size/2)
      .attr('y', y-size/2)
      .attr('width', size)
      .attr('height', size);
  }
  
  
  // utility functions
  export function getTagInfo(epc : string) {
    var ix = _(allTagInfo).pluck('epc').indexOf(epc);
    if (ix == -1) {
      //console.log('Tag with epc %s not found in allTagInfo',epc)
      return {epc:epc, color:'red', coord:null}
    } else {
      return allTagInfo[ix];
    }
  }

  export function mkTagId(tag : Shared.TagData) {
    return mkId('tag', tag.epc)
  }
  
  export function getEpcFromTagId(tagId : string) {
    return stripIdPrefix('tag', tagId);
  } 

  export function mkSignalId(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    return mkId('signal', antennaRssi.antNr + '-' + tag.epc);
  }


  function mkId(prefix : string, id : string) {
    return prefix + '-' + id;
  }
  
  function stripIdPrefix(prefix : string, fullId : string) : string {
    var prefixPlusSep = prefix + '-'
    if (!fullId || fullId.indexOf(prefixPlusSep) != 0) {
      util.log('Error: invalid \'' + prefix + '\' id: ' + fullId);
      return null;
    } else {
      return fullId.substring(prefixPlusSep.length);
    }
  } 
  
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