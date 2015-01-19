/*******************************************************************************/
/* ClientCommon.ts                                                             */
/*                                                                             */
/* Copyright (c) 2014, Martijn Schrage - Oblomov Systems. All Rights Reserved. */
/*                                                                             */
/*******************************************************************************/

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
declare var tagConfiguration : Shared.TagConfiguration[];
declare var allTagTrails : {[index:string]: Shared.Coord[]}; // Object that has epc string keys for Shared.Coord[] values
declare var trailLength : number;

var uiState : Backbone.Model;

module ClientCommon {

  export var colors = ['yellow', 'lightblue', 'orange', 'gray', 'blue', 'green', 'purple', 'black', 'red', 'darkgray'
                      ,'white', 'lightgreen', 'teal', 'black', 'pink', 'lime'];
  
  // d3 common code
  export function initFloorSVG() {
    var floorSVG = d3.select('#floor')
      .append('svg:svg')
      .attr('width', floorWidth)
      .attr('height', floorHeight);
    
    var backgroundPlane = floorSVG.append('g').attr('id', 'background-plane');
    
    backgroundPlane.append('rect').attr('id', 'floor-background-rect')
      .attr('width', floorWidth)
      .attr('height', floorHeight);
    backgroundPlane.append('image').attr('id', 'floor-background-image')
      .attr('width', floorWidth)
      .attr('height', floorHeight);
      
    floorSVG.append('g').attr('id', 'trail-plane');
    floorSVG.append('g').attr('id', 'tag-zone-plane');
    floorSVG.append('g').attr('id', 'antenna-range-plane');
    floorSVG.append('g').attr('id', 'antenna-plane');
    floorSVG.append('g').attr('id', 'tag-setup-plane');
    floorSVG.append('g').attr('id', 'rssi-plane');
    floorSVG.append('g').attr('id', 'trilateration-plane');
    floorSVG.append('g').attr('id', 'visitor-plane');
    floorSVG.append('text').attr('id', 'event-source-label'); // positioned in resizeFloor()
    floorSVG.append('text').attr('id', 'tag-event-time-label'); // positioned in resizeFloor()
  }
  
  export function resizeFloor(antennaInfo : Shared.AntennaInfo) {
    scale = antennaInfo.backgroundScale*antennaInfo.screenZoomFactor;
    floorWidth = antennaInfo.backgroundSize.width*antennaInfo.screenZoomFactor;
    floorHeight = antennaInfo.backgroundSize.height*antennaInfo.screenZoomFactor;
    origin = {x: antennaInfo.backgroundOrigin.x*antennaInfo.screenZoomFactor, y: antennaInfo.backgroundOrigin.y*antennaInfo.screenZoomFactor};
  
    d3.select('#floor > svg').attr('width', floorWidth).attr('height', floorHeight);
    d3.select('#floor-background-rect').attr('width', floorWidth).attr('height', floorHeight);
    d3.select('#floor-background-image').attr('width', floorWidth).attr('height', floorHeight);
    d3.select('#event-source-label').attr('x', floorWidth - 10).attr('y', floorHeight - 60);
    d3.select('#tag-event-time-label').attr('x', floorWidth - 10).attr('y', floorHeight - 33);
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
    var rangePlaneSVG = d3.select('#antenna-range-plane');
    var tagZonePlaneSVG = d3.select('#tag-zone-plane');
    _.each(allAntennas, (ant, i) => createAntennaMarker(antennaPlaneSVG, rangePlaneSVG, tagZonePlaneSVG, ant, i));
  }
  
  export function createAntennaMarker(planeSVG : D3.Selection, rangePlaneSVG : D3.Selection, tagZonePlaneSVG : D3.Selection, antenna : Shared.Antenna, antennaNr : number) {
    var pos = ClientCommon.toScreen(antenna.coord);
    var antennaClass = (antenna.shortMidRange ? (antenna.shortMidRange.isShortRange ? 'short' : 'mid')
                                              : 'long') + '-range';

    // styling is done with css (unfortunately, r is not a css attribute)
    tagZonePlaneSVG.append('circle').attr('id', mkTagZoneId(antennaNr)).attr('class', 'tag-zone '+antennaClass)
      .attr('r', Shared.getAntennaMaxRange(antenna)*scale)
      .attr('cx', pos.x)
      .attr('cy', pos.y);
    rangePlaneSVG.append('circle').attr('id', mkAntennaRangeId(antennaNr)).attr('class', 'antenna-max-range '+antennaClass)
      .attr('r', Shared.getAntennaMaxRange(antenna)*scale)
      .attr('cx', pos.x)
      .attr('cy', pos.y);

    var antennaSVG = planeSVG.append('g').attr('id', mkAntennaId(antennaNr)).attr('class', 'antenna-marker '+antennaClass)
                       .attr('transform', 'translate('+pos.x+','+pos.y+')');
    // 'g' element with translate is annoying, but nested svg creates clipping problems
   
    var size = 16;
    antennaSVG.append('rect').attr('class', 'antenna-shape')
      .attr('x', -size/2)
      .attr('y', -size/2)
      .attr('width', size)
      .attr('height', size);
    var text = antennaSVG.append('text').attr('id', mkAntennaLabelId(antennaNr)).attr('class', 'antenna-label').text(antenna.name);
    var labelSize = $('#'+mkAntennaLabelId(antennaNr))[0].getBoundingClientRect();
    //util.log('label ' +antenna.name + ' ' , labelSize.width);
    text.attr('x', -labelSize.width/2 + 1)
        .attr('y', labelSize.height/2 - 3.5)
  }

  export function createTagMarker(tag : Shared.TagData) {
    var trilaterationPlaneSVG = d3.select('#trilateration-plane');
    
    var markerSVG = trilaterationPlaneSVG.append('g').attr('id', mkTagId(tag)).attr('class', 'tag-marker')
                       .style('fill', getTagColor(tag))
                       .attr('transform', 'translate('+ClientCommon.toScreenX(tag.coordinate ? tag.coordinate.coord.x : 0)+
                                                   ','+ClientCommon.toScreenY(tag.coordinate ? tag.coordinate.coord.y : 0)+')');
 
    markerSVG.append('circle')
      .attr('r', 6)
      .attr('cx',0)
      .attr('cy',0);
    markerSVG.append('text')
      .text(tag.metaData ? tag.metaData.name : '')
      .attr('x',0)
      .attr('y',17);
  }
  
  export function removeTagMarker(tag : Shared.TagData) {
    $('#'+mkTagId(tag)).remove();
  }

  export function createSignalMarker(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    var rssiPlaneSVG = d3.select('#rssi-plane');

    var antNr = antennaRssi.antNr;
    var pos = ClientCommon.toScreen(allAntennas[antNr].coord);
    rssiPlaneSVG.append('circle').attr('id', mkSignalId(antennaRssi, tag)).attr('class', 'signal-marker')
              .style('stroke', getTagColor(tag))
              .style('fill', 'transparent')
              .attr('cx', pos.x)
              .attr('cy', pos.y);
  }

  export function removeSignalMarker(antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    $('#'+mkSignalId(antennaRssi, tag)).remove();
  }

  export function setSignalMarkerRssi(serverInfo : Shared.ServerInfo, antennaRssi : Shared.AntennaRSSI, tag : Shared.TagData) {
    var dashArray : string;
    if (Shared.isRecentAntennaRSSI(serverInfo.staleAgeMs, antennaRssi)) 
      dashArray = 'none';
    else {
      var maxStalePeriod = serverInfo.ancientAgeMs - serverInfo.staleAgeMs;
      var staleIndex = Math.floor(((util.clip(0,maxStalePeriod-1,antennaRssi.age-serverInfo.staleAgeMs) / maxStalePeriod)*9))+1;
      // staleIndex lies between 1 and 9, 1: just became stale, 9: almost ancient
      dashArray = ''+(10-staleIndex)+','+staleIndex;
    }
    var signal = d3.select('#'+mkSignalId(antennaRssi, tag));
    signal.style('stroke', getTagColor(tag));
    signal.transition()
          .duration(refreshDelay)
          .style('stroke-dasharray', dashArray)
          .attr('r', antennaRssi.distance*scale);          
  }
  
  export function initDataRows() {
    $('#tags-data *').remove();
    $('#tags-data').append('<tr class="data-row"><td>EPC</td>' +
                             _(_.range(0,allAntennas.length)).map((i) => {return '<td class="ant-rssi">' + allAntennas[i].name + '</td>'}).join('') +
                           '</tr>');
  }
  
  export function createDataRow(tag : Shared.TagData) {
    $('#tags-data').append('<tr id="' + mkDataRowId(tag) + '" class="data-row"><td class="tag-label">'+tag.epc.slice(-7)+'</td>' +
                             util.replicate(allAntennas.length, '<td class="ant-rssi">&nbsp;</td>').join('') +
                           '</tr>');
    //$('.tag-rssis:eq('+tagNr+') .tag-label').text(tagData.epc);
    var $tagLabel = $('#'+mkDataRowId(tag));
    $tagLabel.css('color', getTagColor(tag));

  }
  
  export function removeDataRow(tag : Shared.TagData) {
    $('#'+mkDataRowId(tag)).remove();
  }

  export function createTrail(tag : Shared.TagData) {
    allTagTrails[tag.epc] = [];
  
    var color = getTagColor(tag);
    var visitorTrail = d3.select('#trail-plane')
      .append('path')
      .attr('id', mkTrailId(tag))
      .attr('class', 'tag-trail')
      .attr('stroke-dasharray','none')
      .style('stroke', color)
      .attr('fill', 'none');
  }

  export function removeTrail(tag : Shared.TagData) {
    delete allTagTrails[tag.epc];
     
    $('#'+mkTrailId(tag)).remove();
  }
  
  export function updateTrail(tag : Shared.TagData) {
    // Store coord at the head of the corresponding trail, moving up the rest, and clipping at trailLength.
    allTagTrails[tag.epc] = _.union([tag.coordinate.coord], allTagTrails[tag.epc]).slice(0,trailLength);

    var tagTrail = allTagTrails[tag.epc];
    
    var lineFunction = d3.svg.line()
      .x(function(d) { return ClientCommon.toScreenX(d.x); })
      .y(function(d) { return ClientCommon.toScreenY(d.y); })
      .interpolate('linear');
  
    d3.select('#'+ClientCommon.mkTrailId(tag))
      .attr('d', lineFunction(tagTrail.slice(1)))
      .attr('stroke-dasharray','none')
      .style('stroke-opacity', 0.5)
      .attr('fill', 'none');
}

  export function createTagSetup() {
    var tagInfoPlaneSVG = d3.select('#tag-setup-plane');
    _(tagConfiguration).each((tag, tagNr)=>{
      if (tag.testCoord) {
        var tagCoord = ClientCommon.toScreen(tag.testCoord);
        createSquare(tagInfoPlaneSVG, tagCoord.x, tagCoord.y, 10, tag.color);
      }
    });
  }
  
  export function createSquare(planeSVG : D3.Selection, x : number, y : number, size : number, color : string) {
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
    var ix = _(tagConfiguration).pluck('epc').indexOf(epc);
    if (ix == -1) {
      //console.log('Tag with epc %s not found in allTagInfo',epc)
      return {epc:epc, color:colors[parseInt(epc.charAt(epc.length-1),16)], testCoord:null}
    } else {
      return tagConfiguration[ix];
    }
  }
  
  export function mkAntennaId(nr : number) {
    return mkId('antenna', ''+nr)
  }
  
  export function getAntennaNrFromId(antennaId : string) {
    return stripIdPrefix('antenna', antennaId);
  } 

  export function mkAntennaLabelId(nr : number) {
    return mkId('antenna-label', ''+nr)
  }

  export function mkAntennaRangeId(nr : number) {
    return mkId('antenna-range', ''+nr)
  }
  
  export function mkTagZoneId(nr : number) {
    return mkId('tag-zone', ''+nr)
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

  export function mkDataRowId(tag : Shared.TagData) {
    return mkId('data-row', tag.epc)
  }

  export function mkTrailId(tag : Shared.TagData) {
    return mkId('trail', tag.epc)
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
  
  export function getTagColor(tag : Shared.TagData) {
    return tag.metaData && tag.metaData.color ? tag.metaData.color : getTagInfo(tag.epc).color;
  }
  
  export function showDate(date : Date) {
    return date.getDate() + "-" + (date.getMonth()+1) + "-" + date.getFullYear() 
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