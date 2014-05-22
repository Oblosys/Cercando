/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />

// Global variables. TODO: put these in some kind of state object
declare var scale : number;
declare var origin : Shared.Coord;
declare var floorWidth : number;
declare var floorHeight : number;
declare var allAntennas : Shared.Antenna[];
declare var allTagInfo : Shared.TagInfo[];

module ClientCommon {

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
  
  export function drawAntennas() {
    var antennaPlaneSVG = d3.select('#antenna-plane');
  
    _.each(allAntennas, (ant, i) => drawAntenna(antennaPlaneSVG, ant, i));
  
  }
  
  export function drawAntenna(planeSVG : D3.Selection, antenna : Shared.Antenna, antennaNr : number) {
    var pos = ClientCommon.toScreen(antenna.coord);
    var antennaSVG = planeSVG.append('svg').attr('id', 'a-'+antennaNr).attr('class', 'antenna-marker'); 
    // don't use a group, a nested svg is easier and we don't need transformations on antennas
    antennaSVG.append('circle')
      .style('stroke', 'white')
      .style('fill', 'blue')
      .attr('r', 8)
      .attr('cx', pos.x)
      .attr('cy', pos.y);
    var text = antennaSVG.append('text').attr('class', 'l-'+antennaNr).text(antenna.name)
      .attr('font-family', 'verdana')
      .attr('font-size', '10px')
      .attr('fill', 'white');
    var labelSize = $('.l-'+antennaNr)[0].getBoundingClientRect();
    //util.log('label ' +antenna.name + ' ' , labelSize.width);
    text.attr('x', pos.x-labelSize.width/2 + 1)
        .attr('y', pos.y+labelSize.height/2 - 3.5)
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
  
  export function createMarkers() {
    _.map(_.range(0, allTagInfo.length), (i : number) => createMarker(i));
  }
  
  export function createMarker(markerNr : number) {
    var trilaterationPlaneSVG = d3.select('#trilateration-plane');
   
    trilaterationPlaneSVG.append('circle').attr('class', 'm-'+markerNr)
      .style('stroke', 'white')
      .style('fill', 'yellow')
      .attr('r', 6)
      .attr('cx', ClientCommon.toScreenX(0))
      .attr('cy', ClientCommon.toScreenY(0))
      .style('display', 'none');
  }

  
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