/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/socket.io/socket.io-client.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="Trilateration.ts" />

/* 
TODO remove errors and warnings
fix antenna nrs and ids
move to server
*/

var tagNrs : any = [];
var tagColors : string[] = [];
var refreshInterval : number; // setInterval() returns a number


function initRefreshSocket(floorSVG : D3.Selection) {
  //util.log(location.host);
  var socket = io.connect('http://'+location.host);
  socket.on('llrp', function (data) {   
    //util.log('LLRP event'+data.RSSI);
    drawLlrpEvent(floorSVG, data.ePC, data.ant, data.RSSI);
  });
}  
  
var debug = true;
var floorHeight = 500;
var floorWidth = 700;

/***** Initialization *****/

$(document).ready(function(){
  initialize();
});

function initialize() {
  initTagData();
  for (var tagNr=0; tagNr<tagColors.length; tagNr++) {
    var $tagLabel = $('.tag-rssis:eq('+tagNr+') .tag-label');
    $tagLabel.css('color',tagColors[tagNr]);
    $tagLabel.text(tagNr + ' ' +tagIds[tagNr].slice(-7));
  }
 
  var floorSVG = d3.select('#floor')
    .append('svg:svg')
    .attr('width', floorWidth)
    .attr('height', floorHeight);

  $('#floor').css('height',floorHeight+'px'); // for some reason height is rendered a bit too large, so we constrain it.

  floorSVG.append('g').attr('id', 'background-plane')
    .append('rect').attr('id', 'floor-background')
    .attr('width', floorWidth)
    .attr('height', floorHeight);
  floorSVG.append('g').attr('id', 'annotation-plane');
  floorSVG.append('g').attr('id', 'rssi-plane');
  floorSVG.append('g').attr('id', 'triangulation-plane');
  floorSVG.append('g').attr('id', 'visitor-plane');

  _.map([1,2,3,4], (ant : number) => drawAntenna(floorSVG, ant));
  drawTagSetup();
  _.map(_.range(0, 10), (i : number) => drawMarker(i));

  connectReader();
}

var signals : any = [];

function drawAntenna(floorSVG : D3.Selection, antenna : number) {
  
  floorSVG.append('circle').attr('class', 'a-'+antenna)
    .style('stroke', 'white')
    .style('fill', 'blue')
    .attr('r', 8)
    .attr('cx', antennaCoords[antenna-1].x)
    .attr('cy', antennaCoords[antenna-1].y);
  floorSVG.append('text').text(''+antenna)
    .attr('x', antennaCoords[antenna-1].x-3)
    .attr('y', antennaCoords[antenna-1].y+3.5)
    .attr('font-family', 'verdana')
    .attr('font-size', '10px')
    .attr('fill', 'white');
  
}

function drawTagSetup() {
  var pxPerCm = 400/300;
  _(tagCoords).each((coord, tagNr)=>{
    drawSquare(coord.x*pxPerCm+350,coord.y*pxPerCm+250,10, tagColors[tagNr]);
  });
}

function drawSquare(x : number, y : number, size : number, color : string) {
  var annotationPlaneSVG = d3.select('#annotation-plane');
 
  annotationPlaneSVG.append('rect')
    .style('stroke', 'white')
    .style('fill', color)
    .attr('x', x-size/2)
    .attr('y', y-size/2)
    .attr('width', size)
    .attr('height', size);
}

function drawMarker(markerNr : number) {
  var triangulationPlaneSVG = d3.select('#triangulation-plane');
 
  triangulationPlaneSVG.append('circle').attr('class', 'm-'+markerNr)
    .style('stroke', 'white')
    .style('fill', tagColors[markerNr])
    .attr('r', 6)
    .attr('cx', 20+markerNr * 10)
    .attr('cy', 20);
}

function updateTags(tagsState : Shared.TagState[]) {
  var rssiPlaneSVG = d3.select('#rssi-plane');
  
  _.map(tagsState, (tagState) => {
    var tagNr = tagNrs[tagState.epc];
    //util.log(tagState.epc + '(' + tagNr + ':' + tagColors[tagNr] + ')' + tagState.rssis);
    
    for (var ant=0; ant<antennaCoords.length; ant++) {
      var rssi = tagState.rssis[ant];

      // show in table
      if (rssi) {
        $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+ant+')').text(rssi);
      }
      //util.log(tagNr + '-' + ant +' '+ rssi);

      var rangeClass = 'r-'+(ant+1)+'-'+tagNr; 
      var range = d3.select('.'+rangeClass)
      if (range.empty() && tagNr <=11) { // use <= to filter tags
        util.log('Creating range for ant '+(ant+1) + ': '+rangeClass);
        
        var tagColor = tagColors[tagNr];
        range = rssiPlaneSVG.append('circle').attr('class', rangeClass)
                  .style('stroke', tagColor ? tagColor : 'transparent')
                  .style('fill', 'transparent')
                  .attr('cx', antennaCoords[ant].x)
                  .attr('cy', antennaCoords[ant].y);
      }
      var distance = Trilateration.dist(rssi)/50;
  
      if (false && tagNr == 1) { // override for testing
        switch(ant) {
          case 1:
            distance = 100;
            break;
          case 2:
            distance = 200;
            break;
          case 3:
            distance = 200;
            break;
          case 4:
            distance = 300;
            break;
        }
      }
  
      //util.log('A'+ant+': tag'+tagNr+': '+distance);
      storeRange(tagNr, ant+1, distance);
      range.attr('r', distance+tagNr); // +tagNr to prevent overlap

    }
    
  });
  Trilateration.trilaterateRanges(rssiPlaneSVG);
  util.log(count);
  
  
}

var count = 1;

function drawLlrpEvent(floorSVG : D3.Selection, epc : string, ant : number, rawRssi : number) {
  var rssi = tweakAntenna(ant, rawRssi);
  var tagNr = tagNrs[epc];
  //util.log(tagNr+ ' ant '+ ant);

  /*
  if (count%40==0) {
    util.log('clearing');
    for (var a=1; a<5; a++) {
        $('#t1-a'+a).text('-');
        $('#t2-a'+a).text('-');
    }
  }*/
  $('.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+(ant-1)+')').text(rawRssi);
 
  if (epc=='0000000000000000000000000503968') {
    util.log('signal for black '+tagNr +' from antenna '+ant +'  '+'.tag-rssis:eq('+tagNr+') .ant-rssi:eq('+ant+')');
  }
  var rangeClass = 'r-'+ant+'-'+tagNr; 
  var range = d3.select('.'+rangeClass)
  if (range.empty() && tagNr <=11) { // use <= to filter tags
    //util.log('Creating range for ant '+ant + ': '+rangeClass);
    
    var tagColor = tagColors[tagNr];
    range = floorSVG.append('circle').attr('class', rangeClass)
              .style('stroke', tagColor ? tagColor : 'transparent')
              .style('fill', 'transparent')
              .attr('cx', antennaCoords[ant-1].x)
              .attr('cy', antennaCoords[ant-1].y);
  }
  var distance = Trilateration.dist(rssi)/50;
  
  if (false && tagNr == 1) { // override for testing
    switch(ant) {
      case 1:
        distance = 100;
        break;
      case 2:
        distance = 200;
        break;
      case 3:
        distance = 200;
        break;
      case 4:
        distance = 300;
        break;
    }
  }
  
  //util.log('A'+ant+': tag'+tagNr+': '+distance);
  range.attr('r', distance+tagNr); // +tagNr to prevent overlap
  //range.attr('r',-(50+rssi)*20+tagNr);  
  //storeRange(tagNr, ant, distance);
  //if (count % 50 == 0) {
  //  trilaterateRanges(floorSVG);
  //}
  //util.log(count);
  count++;
}   

var antennaTweaks = [1,0.97,1,0.97];
function tweakAntenna(antennaNr : number, rssi : number) : number {
  return rssi * antennaTweaks[antennaNr-1];
}

var ranges : any = [];

function storeRange(tagNr : number, antenna : number, distance : number) {
  if (!ranges[tagNr]) {
    ranges[tagNr] = [];
  }
  var tagRanges = ranges[tagNr];
  tagRanges[antenna-1] = distance;
}

function startRefreshInterval() {
  refreshInterval = <any>setInterval(refresh, 500); 
  // unfortunately Eclipse TypeScript is stupid and doesn't respect reference paths, so it includes all TypeScript
  // declarations in the source tree and assumes a different type for setInterval here
  // (returning NodeTimer instead of number, as declared in node.d.ts)
}

function stopRefreshInterval() {
  <any>clearInterval(refreshInterval); // see Eclipse TypeScript comment above
}

function refresh() {
  $.getJSON( 'query/tags', function( data ) {
    updateTags(data);
  }) .fail(function(jqXHR : any, status : any, err : any) {
    console.error( "Error:\n\n" + jqXHR.responseText );
  });
}

function connectReader() {
  $.get('/query/connect', function() {
    util.log('Connected to reader.');
    startRefreshInterval();
  });
}

function disconnectReader() {
  $.get('/query/disconnect', function() {
    util.log('Disconnected from reader.');
    stopRefreshInterval();  
  });
}

function handleConnectButton() {
  connectReader();
}

function handleDisconnectButton() {
  disconnectReader();
}

function handleToggleTagLocationsButton() {
  util.log('test:' + $('#annotation-plane').css('display')=='none');
  
  if ($('#annotation-plane').css('display')=='none') {
    $('#toggle-locations-button').attr('value','Show tag locations');
    $('#annotation-plane').show();
  } else {
    $('#toggle-locations-button').attr('value','Hide tag locations');
    $('#annotation-plane').hide();
  }
}


//var antennaCoords = [{x:150,y:250},{x:350,y:50},{x:550,y:250},{x:350,y:450}] 
var antennaCoords = [{x:550,y:250},{x:350,y:450},{x:150,y:250},{x:350,y:50}] 
var tagCoords =
  [ {x:0,y:0}
  , {x:53,y:-53},{x:53,y:53},{x:-53,y:53},{x:-53,y:-53}
  , {x:106,y:-106},{x:106,y:106},{x:-106,y:106},{x:-106,y:-106}
  , {x:142,y:0},{x:142,y:-50}
  ];

var tagIds = 
  [ '0000000000000000000000000370802'
  , '0000000000000000000000000370870'
  , '0000000000000000000000000370869'
  , '0000000000000000000000000503968'
  , '0000000000000000000000000503972'
  , '0000000000000000000000000370845'
  , '0000000000000000000000000000795'
  , '0000000000000000000000000023040'
  , '0000000000000000000000000023140'
  , '0000000000000000000000000100842'
  , '0000000000000000000000000103921'
  ]
   
function initTagData() {
  tagNrs['0000000000000000000000000100842'] = 0; // 1 (floor antenna 3)
  tagColors[0]                              = "red";
  tagNrs['0000000000000000000000000503968'] = 1; // 2 on chair, underneath antenna 1
  tagColors[1]                              = "yellow";
  tagNrs['0000000000000000000000000503972'] = 2; // 3 window, near antenna 1
  tagColors[2]                              = "gray";
  tagNrs['0000000000000000000000000370802'] = 3; // 4 on chair, underneath antenna 4
  tagColors[3]                              = "black";
  tagNrs['0000000000000000000000000370870'] = 4; // 5 (stuck on antenne 3?)
  tagColors[4]                              = "orange";
  tagNrs['0000000000000000000000000370869'] = 5; // 6 on chair, underneath antenna 2
  tagColors[5]                              = "green";
  tagNrs['0000000000000000000000000103921'] = 6;
  tagColors[6]                              = "purple";
  tagNrs['0000000000000000000000000000795'] = 7;
  tagColors[7]                              = "brown"
  tagNrs['0000000000000000000000000023040'] = 8;
  tagColors[8]                              = "lightblue";
  tagNrs['0000000000000000000000000023140'] = 9;
  tagColors[9]                              = "darkgray";
  tagNrs['0000000000000000000000000370845'] = 10;
  tagColors[10]                             = "white";
}
