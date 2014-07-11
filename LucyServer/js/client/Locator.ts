/// <reference path="../typings/d3/d3.d.ts" />
/// <reference path="../typings/jquery/jquery.d.ts" />
/// <reference path="../typings/backbone/backbone.d.ts" />
/// <reference path="../typings/underscore/underscore.d.ts" />
/// <reference path="../typings/oblo-util/oblo-util.d.ts" />
/// <reference path="../shared/Shared.ts" />
/// <reference path="./ClientCommon.ts" />

export interface Dummy {}; // Dummy export causes Eclipse-TypeScript to not put this file's declarations in the global namespace (code generation is not affected)

$(document).ready(function(){
  initialize();
});

var debug = true;
var floorHeight = 0;
var floorWidth = 0;

var origin = {x: floorWidth/2, y: floorHeight/2}; // pixel coordinates for (0,0)
var scale = 80; // pixels per meter


var refreshDelay = 200;
var trailLength = 400;
var allTagTrails = {}; // Object that has epc keys for Shared.Coord[] values (can't easily enforce this in TypeScript)

var refreshInterval : number; // setInterval() returns a number
var serverState : Shared.ServerState;
var allAntennas : Shared.Antenna[];
var tagConfiguration : Shared.TagConfiguration[];
var replayInfo : Shared.ReplayInfo; // directory structure of lucyData/savedReaderEvents/

var UIState = Backbone.Model.extend({
  defaults: {
    showMaxAntennaRanges: false,
    showTagZones: true,
    showSignals: true,
    showTrails: true,
    showTagSetup: true
  }
});

var uiState : Backbone.Model = new UIState();

/***** Initialization *****/

function resetClientState() {
  util.log('Resetting client state');
  uiState.trigger('change'); // reflect current values in UI, even when they are not different from defaults (and don't fire change  event)
  serverState.tagsData = [];
  allTagTrails = {};
  d3.selectAll('#trail-plane *').remove();
  d3.selectAll('#antenna-plane *').remove();
  d3.selectAll('#antenna-range-plane *').remove();
  d3.selectAll('#tag-zone *').remove();
  d3.selectAll('#tag-setup-plane *').remove();
  d3.selectAll('#rssi-plane *').remove();
  d3.selectAll('#trilateration-plane *').remove();
  ClientCommon.initDataRows()
  ClientCommon.createTagSetup();
  ClientCommon.createAntennaMarkers();
  initReplaySelectors();
}

function initialize() {
  $.ajaxSetup({ cache: false });
  serverState = Shared.initialServerState();

  uiState.on('change', handleUIStateChange);
  initSelectorButtons();

  ClientCommon.initFloorSVG();
  
  initLayoutSelector(); // initLayoutSelector calls selectLayout, which finishes client init and starts refresh interval
}

function initSelectorButtons() {
  
  $('#show-ranges-selector .select-button:eq(0)').on('click', () => {uiState.set('showMaxAntennaRanges', true)});
  $('#show-ranges-selector .select-button:eq(1)').on('click', () => {uiState.set('showMaxAntennaRanges', false)});
  $('#show-tag-zones-selector .select-button:eq(0)').on('click', () => {uiState.set('showTagZones', true)});
  $('#show-tag-zones-selector .select-button:eq(1)').on('click', () => {uiState.set('showTagZones', false)});
  $('#show-signals-selector .select-button:eq(0)').on('click', () => {uiState.set('showSignals', true)});
  $('#show-signals-selector .select-button:eq(1)').on('click', () => {uiState.set('showSignals', false)});
  $('#show-trails-selector .select-button:eq(0)').on('click', () => {uiState.set('showTrails', true)});
  $('#show-trails-selector .select-button:eq(1)').on('click', () => {uiState.set('showTrails', false)});
  $('#show-tag-setup-selector .select-button:eq(0)').on('click', () => {uiState.set('showTagSetup', true)});
  $('#show-tag-setup-selector .select-button:eq(1)').on('click', () => {uiState.set('showTagSetup', false)});
}

function initReplaySelectors() {
  $.getJSON( "query/replay-info", function(newReplayInfo : Shared.ReplayInfo) {
    replayInfo = newReplayInfo;
    
    util.log('New replay info ' + util.showJSON(replayInfo));
    
    $('#replay-level-1-selector').empty();
    _(replayInfo.contents).chain().pluck('name').each((level1Name) => {
      $('#replay-level-1-selector').append('<option value="'+level1Name+'">'+level1Name+'</option>');
    });
    handleSelectReplayLevel1(); 
  });
}

function handleSelectReplayLevel1() {
  var selectedLevel1Name = $('#replay-level-1-selector').val();
  console.log('Select replay level 1 name: ' + selectedLevel1Name);
  var selectedLevel1Entry = _(replayInfo.contents).findWhere({name: selectedLevel1Name});
  
  $('#replay-level-2-selector').empty();
  if (selectedLevel1Entry) {
    _(selectedLevel1Entry.contents).chain().pluck('name').each(level2Name => {
      $('#replay-level-2-selector').append('<option value="'+level2Name+'">'+level2Name+'</option>');
    });
  }
  handleSelectReplayLevel2();
}

function handleSelectReplayLevel2() {
  var selectedLevel1Name = $('#replay-level-1-selector').val();
  var selectedLevel1Entry = _(replayInfo.contents).findWhere({name: selectedLevel1Name});
  
  $('#replay-level-3-selector').empty();
  if (selectedLevel1Entry) {
    var selectedLevel2Name = $('#replay-level-2-selector').val();
    console.log('Select replay level 2 name: ' + $('#replay-level-2-selector').val());
    var selectedLevel2Entry = selectedLevel1Entry && _(selectedLevel1Entry.contents).findWhere({name: selectedLevel2Name});
    
    if (selectedLevel2Entry) {
      _(selectedLevel2Entry.contents).chain().pluck('name').each(level3Name => {
        $('#replay-level-3-selector').append('<option value="'+level3Name+'">'+level3Name+'</option>');
      });
    }
  }
  handleSelectReplayLevel3();
}

function handleSelectReplayLevel3() {
  var selectedLevel1Name = $('#replay-level-1-selector').val();
  var selectedLevel1Entry = _(replayInfo.contents).findWhere({name: selectedLevel1Name});
  
  $('#replay-level-4-selector').empty();
  if (selectedLevel1Entry) {
    var selectedLevel2Name = $('#replay-level-2-selector').val();
    console.log('Select replay level 2 name: ' + $('#replay-level-2-selector').val());
    var selectedLevel2Entry = selectedLevel1Entry && _(selectedLevel1Entry.contents).findWhere({name: selectedLevel2Name});
    
    if (selectedLevel2Entry) {
      var selectedLevel3Name = $('#replay-level-3-selector').val();
      var selectedLevel3Entry = selectedLevel2Entry && _(selectedLevel2Entry.contents).findWhere({name: selectedLevel3Name});
 
      if (selectedLevel3Entry) {
        _(selectedLevel3Entry.contents).chain().pluck('name').each(level4Name => {
          $('#replay-level-4-selector').append('<option value="'+level4Name+'">'+level4Name+'</option>');
        });
      }      
    }
  }
}

function handleStartReplayButton() {
  var filename = encodeURI( $('#replay-level-1-selector').val() +
                            (!$('#replay-level-2-selector').val() ? '' : '/' + $('#replay-level-2-selector').val() + 
                            (!$('#replay-level-3-selector').val() ? '' : '/' + $('#replay-level-3-selector').val() +
                            (!$('#replay-level-4-selector').val() ? '' : '/' + $('#replay-level-4-selector').val()))) 
                          );
  util.log('Request start replay for ' + filename);
  return;
  $.get('/query/start-replay', {filename: filename}, function() {
      util.log('Started replay.');
    }).fail(function(data : JQueryXHR) {
      console.log(data);
      alert('Start replay failed:\n'+JSON.parse(data.responseText).error);
    });

}

function handleUIStateChange(m : Backbone.Model, newValue : any) {
 // util.log('handleUIStateChange', m, newValue); // note that m and newValue not set on trigger('change')
  var showMaxAntennaRanges = uiState.get('showMaxAntennaRanges');
  util.setAttr($('#show-ranges-selector .select-button:eq(0)'),'selected', showMaxAntennaRanges);
  util.setAttr($('#show-ranges-selector .select-button:eq(1)'),'selected', !showMaxAntennaRanges);
  $('#antenna-range-plane').attr('visibility', showMaxAntennaRanges ? 'visible' : 'hidden');
  var showTagZones = uiState.get('showTagZones');
  util.setAttr($('#show-tag-zones-selector .select-button:eq(0)'),'selected', showTagZones);
  util.setAttr($('#show-tag-zones-selector .select-button:eq(1)'),'selected', !showTagZones);
  $('#tag-zone-plane').attr('visibility', showTagZones ? 'visible' : 'hidden');
  var showSignals = uiState.get('showSignals');
  util.setAttr($('#show-signals-selector .select-button:eq(0)'),'selected', showSignals);
  util.setAttr($('#show-signals-selector .select-button:eq(1)'),'selected', !showSignals);
  $('#rssi-plane').attr('visibility', showSignals ? 'visible' : 'hidden');
  var showTrails = uiState.get('showTrails');
  util.setAttr($('#show-trails-selector .select-button:eq(0)'),'selected', showTrails);
  util.setAttr($('#show-trails-selector .select-button:eq(1)'),'selected', !showTrails);
  $('#trail-plane').attr('visibility', showTrails ? 'visible' : 'hidden');
  var showTagSetup = uiState.get('showTagSetup');
  util.setAttr($('#show-tag-setup-selector .select-button:eq(0)'),'selected', showTagSetup);
  util.setAttr($('#show-tag-setup-selector .select-button:eq(1)'),'selected', !showTagSetup);
  $('#tag-setup-plane').attr('visibility', showTagSetup ? 'visible' : 'hidden');
}

function initLayoutSelector() {
  $.getJSON( "query/layout-info", function(layoutInfo : Shared.LayoutInfo) {
    $.each(layoutInfo.names, function( index, name ) {
      $('#layout-selector').append('<option value="'+name+'">'+name+'</option>');
    });
    selectLayout(layoutInfo.selectedLayoutNr);
  });
}


// TODO: maybe use D3 for adding and removing? Is this possible when we also add/remove non-d3 elements? (e.g. data rows) 
function addRemoveSVGElements(oldTagsData : Shared.TagData[], currentTagsData : Shared.TagData[]) {
  // Remove disappeared signals and tags
  _(oldTagsData).each((oldTag) => {
    var currentTag = _(currentTagsData).findWhere({epc: oldTag.epc});
    _(oldTag.antennaRssis).each((oldAntennaRssi) => { // todo: refactor pluck call
      if (!currentTag || !_(_(currentTag.antennaRssis).pluck('antNr')).contains(oldAntennaRssi.antNr)) {
        util.log('Removed signal for antenna ' + oldAntennaRssi.antNr + ' for tag ' + oldTag.epc); 
        ClientCommon.removeSignalMarker(oldAntennaRssi, oldTag);
      }
    });
    if (!currentTag) {
      util.log('Removed tag ' + oldTag.epc); 
      ClientCommon.removeTagMarker(oldTag);
      ClientCommon.removeDataRow(oldTag);
      ClientCommon.removeTrail(oldTag);
    }
  });

  // Add newly-appeared signals and tags
  _(currentTagsData).each((currentTag) => {
    var oldTag = _(oldTagsData).findWhere({epc: currentTag.epc});
    _(currentTag.antennaRssis).each((currentAntennaRssi) => { // todo: refactor pluck call
      if (!oldTag || !_(_(oldTag.antennaRssis).pluck('antNr')).contains(currentAntennaRssi.antNr)) {
        //util.log('New signal for antenna ' + currentAntennaRssi.antNr + ' for tag ' + currentTag.epc); 
        ClientCommon.createSignalMarker(currentAntennaRssi, currentTag);
      }
    });
    if (!oldTag) {
      //util.log('New tag ' + currentTag.epc); 
      ClientCommon.createTagMarker(currentTag);
      ClientCommon.createDataRow(currentTag);
      ClientCommon.createTrail(currentTag);
    }
  });
}

function updateLabels() {
  $('#client-time-label').text(ClientCommon.showTime(new Date()));
  $('#reader-time-label').text(ClientCommon.showTime(new Date(serverState.status.readerServerTime)));
  
  $('#connection-label').text(serverState.status.isConnected ? 'Connected' : 'Not connected');
  $('#connection-label').css('color', serverState.status.isConnected ? 'lime' : 'red');
}

function updateTags() {
  updateLabels();
    
  var now = new Date();
  var unknownAntennasHtml = serverState.unknownAntennaIds.length == 0 ? 'None' :
    _(serverState.unknownAntennaIds).map((unknownAntenna) => {
      return '<div id="unknown-antenna">' + unknownAntenna.readerIp + '-' + unknownAntenna.antennaNr + '</div>';
    }).join('');
  $('#unknown-antennas').html(unknownAntennasHtml);
 
  $('.tag-zone').css('fill', '').css('stroke', 'none'); // remove background overrides coming from strongest signals

  _.map(serverState.tagsData, (tagData) => {
    var tagNr = getTagNr(tagData.epc);
    
    // Mark the most-likely zone this tag is located in, based on the strongest antenna signal
    var strongestAntennaNr = _(tagData.antennaRssis).max((antennaRssi) => {return antennaRssi.value;}).antNr;

    var $tagZone = $('#'+ClientCommon.mkTagZoneId(strongestAntennaNr));
    $tagZone.css('fill', ClientCommon.getTagColor(tagData)); // override fill
    $tagZone.css('stroke', 'white'); // override stroke
    
    for (var i=0; i < tagData.antennaRssis.length; i++) {
      var antRssi = tagData.antennaRssis[i];
      var antNr = antRssi.antNr;
      //util.log('epc:'+tagData.epc+'  '+tagNr);
      var rssi = antRssi.value;
      var dist =  antRssi.distance;
      var isSignalRecent = Shared.isRecentAntennaRSSI(antRssi);
        
      // show in table
      if (rssi) {
        var $dataCell = $('#'+ClientCommon.mkDataRowId(tagData)+' .ant-rssi:eq('+antNr+')');
        $dataCell.html('<span class="dist-label">' + dist.toFixed(1) + 'm</span>' +
                       '<span class="rssi-label">(' + rssi.toFixed(1) + ')</span>');
        $dataCell.css('background-color', antNr == strongestAntennaNr ? '#333' : 'transparent')
        $('#'+ClientCommon.mkDataRowId(tagData)+' .dist-label').css('color', isSignalRecent ? 'white' : 'red');
        $('#'+ClientCommon.mkDataRowId(tagData)+' .rssi-label').css('color', isSignalRecent ? '#bbb' : 'red');
      }
      
      var signal = d3.select('#'+ClientCommon.mkSignalId(antRssi, tagData));
      if (signal.empty())
        ClientCommon.createSignalMarker(antRssi, tagData);
        
      //util.log('A'+ant+': tag'+tagNr+': '+dist);
      ClientCommon.setSignalMarkerRssi(antRssi, tagData);
    }
    var markerD3 = d3.select('#' + ClientCommon.mkTagId(tagData));
    
    if (tagData.coordinate && tagData.coordinate.coord) {
      ClientCommon.updateTrail(tagData);
      var pos = ClientCommon.toScreen(tagData.coordinate.coord);
      markerD3.style('display', 'block');
      markerD3.style('stroke', tagData.coordinate.isRecent ? 'white' : 'red');
      markerD3.style('fill', ClientCommon.getTagColor(tagData));
      markerD3.transition()
              .duration(refreshDelay)
              .attr('transform', 'translate('+pos.x+','+pos.y+')');
    } else {
      util.error('No coordinate for tag '+tagData.epc);
      markerD3.style('display', 'none'); 
    }
  });
}

function selectLayout(layoutNr : number) {
  util.log('Selecting layout '+layoutNr);
  stopRefreshInterval();
  (<HTMLSelectElement>$('#layout-selector').get(0)).selectedIndex = layoutNr;
  $.getJSON( 'query/select-layout/'+layoutNr, function(antennaInfo : Shared.AntennaInfo) {
    serverState.selectedAntennaLayoutNr = layoutNr;
    allAntennas = antennaInfo.antennaSpecs;
    tagConfiguration = antennaInfo.tagConfiguration;
    //util.log(JSON.stringify(antennaInfo));
    scale = antennaInfo.scale;
    ClientCommon.resizeFloor(antennaInfo.dimensions);
    ClientCommon.setBackgroundImage(antennaInfo.backgroundImage);
    resetClientState();
    startRefreshInterval();
  }) .fail(function(jqXHR : any, status : any, err : any) {
    util.error( "Error:\n\n" + jqXHR.responseText );
  });
}
  
function startRefreshInterval() {
  util.log('Starting refresh interval');
  refreshInterval = <any>setInterval(refresh, refreshDelay); 
  // unfortunately Eclipse TypeScript is stupid and doesn't respect reference paths, so it includes all TypeScript
  // declarations in the source tree and assumes a different type for setInterval here
  // (returning NodeTimer instead of number, as declared in node.d.ts)
}

function stopRefreshInterval() {
  util.log('Stopping refresh interval');
  <any>clearInterval(<any>refreshInterval); // see Eclipse TypeScript comment above
}

function refresh() {
  $.getJSON( 'query/tags', function(newServerState : Shared.ServerState) {
    //util.log(JSON.stringify('old epcs: '+_(serverState.tagsData).pluck('epc')));
    //util.log(JSON.stringify('new epcs: '+_(newServerState.tagsData).pluck('epc')));
    addRemoveSVGElements(serverState.tagsData, newServerState.tagsData)

    var oldSelectedAntennaLayoutNr = serverState.selectedAntennaLayoutNr;    
    serverState = newServerState;
    if (serverState.selectedAntennaLayoutNr != oldSelectedAntennaLayoutNr) {
      util.log('old layout was ' + oldSelectedAntennaLayoutNr + ' selecting new layout');
      selectLayout(serverState.selectedAntennaLayoutNr);
    }

    updateTags();
  }).fail(function(jqXHR : JQueryXHR, status : any, err : any) {
    resetClientState();
    util.error( "Error:\n\n" + jqXHR.responseText );
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
    serverState.status.isConnected = false;
    updateLabels();  
  });
}

function handleStartRefreshButton() {
  startRefreshInterval();
}

function handleStopRefreshButton() {
  stopRefreshInterval();
}

function handleConnectButton() {
  connectReader();
}

function handleDisconnectButton() {
  disconnectReader();
}

function handleResetButton() {
  stopRefreshInterval();
  $.get('/query/reset', function() {
    resetClientState();
    serverState = Shared.initialServerState();
    util.log('Server and client were reset.');
    startRefreshInterval();
  });
}

function handleSaveButton() {
  if ($('#save-button').val() == 'Start saving') { // Not the prettiest way, but it saves us from keeping another state variable for isSaving
    var filename = encodeURI($('#filename-field').val());
    util.setAttr($('#save-button'), 'disabled', true);
    $.get('/query/start-saving', {filename: filename}, function() {
      util.log('Started saving events.');
      $('#save-button').val('Stop saving');
      util.setAttr($('#save-button'), 'disabled', false);
    }).fail(function(data : JQueryXHR) {
      console.log(data);
      alert('Save failed:\n'+JSON.parse(data.responseText).error);
      util.setAttr($('#save-button'), 'disabled', false);
    });
  } else {
    $.get('/query/stop-saving', {filename: filename}, function() {
      util.log('Stopped saving events.');
      $('#save-button').val('Start saving');
    }); // Assume that stop won't fail
  }
}

function handleSelectLayout(selectElt : HTMLSelectElement) {
  selectLayout(selectElt.selectedIndex);
}

// return the index in tagsData for the tag with this epc 
function getTagNr(epc : string) {
  return _(serverState.tagsData).pluck('epc').indexOf(epc);
}
