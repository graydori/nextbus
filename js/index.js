var style = [{"featureType":"water","elementType":"all","stylers":[{"hue":"#e9ebed"},{"saturation":-78},{"lightness":67},{"visibility":"simplified"}]},{"featureType":"landscape","elementType":"all","stylers":[{"hue":"#ffffff"},{"saturation":-100},{"lightness":100},{"visibility":"simplified"}]},{"featureType":"road","elementType":"geometry","stylers":[{"hue":"#bbc0c4"},{"saturation":-93},{"lightness":31},{"visibility":"simplified"}]},{"featureType":"poi","elementType":"all","stylers":[{"hue":"#ffffff"},{"saturation":-100},{"lightness":100},{"visibility":"off"}]},{"featureType":"road.local","elementType":"geometry","stylers":[{"hue":"#e9ebed"},{"saturation":-90},{"lightness":-8},{"visibility":"simplified"}]},{"featureType":"transit","elementType":"all","stylers":[{"hue":"#e9ebed"},{"saturation":10},{"lightness":69},{"visibility":"on"}]},{"featureType":"administrative.locality","elementType":"all","stylers":[{"hue":"#2c2e33"},{"saturation":7},{"lightness":19},{"visibility":"on"}]},{"featureType":"road","elementType":"labels","stylers":[{"hue":"#bbc0c4"},{"saturation":-93},{"lightness":31},{"visibility":"on"}]},{"featureType":"road.arterial","elementType":"labels","stylers":[{"hue":"#bbc0c4"},{"saturation":-93},{"lightness":-2},{"visibility":"simplified"}]}];

//default center of vancouver
var vancouver = new google.maps.LatLng(49.261226,-123.11392699999998);
var options = {
    zoom: 14,
    center: vancouver, 
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: style,
    disableDefaultUI: true
};
var userPos;

//create the map
var map = new google.maps.Map(document.getElementById('map'),options);
google.maps.event.addListener(map, 'center_changed', function() {
    //todo record the center in local storage for later usage
    userPos = map.getCenter();
});

//http://nb.translink.ca/nextbus.ashx?cp=gsr"%"2F050
//http://nb.translink.ca/nextbus.ashx?cp=gsr%2F099

//cp=gsr/099

var currentData = {};

function animate (marker,fromLat,fromLng,toLat,toLng) {
  frames = [];
  
  for (var percent = 0; percent < 1; percent += 0.01) {
    curLat = fromLat + percent * (toLat - fromLat);
    curLng = fromLng + percent * (toLng - fromLng);
    frames.push(new google.maps.LatLng(curLat, curLng));
  }

  move = function(marker, latlngs, index, wait, newDestination) {
    marker.setPosition(latlngs[index]);
    if(index != latlngs.length-1) {
      // call the next "frame" of the animation
      setTimeout(function() { 
        move(marker, latlngs, index+1, wait, newDestination); 
      }, wait);
    }
    else {
      // assign new route
      marker.position = marker.destination;
      marker.destination = newDestination;
    }
  }

  // begin animation, send back to origin after completion
  move(marker, frames, 0, 20, marker.position);
}

var selectedBuses = $('#buses').val();

function fetchData(callback) {
  var newSelectedBuses = $('#buses').val();
  
  Enumerable.
  From(selectedBuses).
  Except(newSelectedBuses).
  ForEach(function(route) {
    $.each(currentData[route],function(i,bus) {
      bus.Marker.setMap(null);
    });
    
    //delete all the data for that route
    delete currentData[route];
  });
  
  selectedBuses = newSelectedBuses;
  
  $.each(selectedBuses,function(i,route) {
    //get routes for each bus
  $.getJSON(
    'https://cors-anywhere.herokuapp.com/http://nb.translink.ca/nextbus.ashx?cp=gsr/' + route,
    function(data) {
      //go through the current data
      if (!currentData[data.RouteNo]) { currentData[data.RouteNo] = []; }
      
      var current = Enumerable.From(currentData[data.RouteNo]);
      var newData = Enumerable.From(data.Buses);
      
      //determine changed intersect
      var added = 0;
      var updated = 0;
      var removed = 0;
      
      current.Union(newData).
      ToLookup("$.VehicleNo").ToEnumerable().
      Where("$.Count() == 2").
      ForEach(function(group) {
        var oldBus = group.First("$.Marker");
        var newBus = group.First("!$.Marker");
        
        newBus.Marker = oldBus.Marker;
        animate(newBus.Marker,oldBus.Latitude,oldBus.Longitude,newBus.Latitude,
                newBus.Longitude);
        updated++;
      });
      //determine added in the new set and not in the old set
      newData.
        Except(current,"$.VehicleNo").
        ForEach(function(bus){
          bus.Marker = new google.maps.InfoWindow({
            map: map,
            position:  new google.maps.LatLng( bus.Latitude, bus.Longitude ),
            content: data.RouteNo + ' ' + bus.Destination, //bus.Direction
            animation: google.maps.Animation.DROP
          });
        added++;
        });
      //determine removed in the old set and not the new set
      current.
        Except(newData,"$.VehicleNo").
        ForEach(function(bus){
          bus.Marker.setMap(null);
        removed++;
        });
      console.log('added'+added+',removed'+removed+',updated'+updated);
      currentData[data.RouteNo] = newData.ToArray();
    });
  });
}
//fetch data right away for the page
fetchData();

google.maps.event.addListener(map, 'tilesloaded', function() {
  //mark the body as loaded
  $('body').addClass('loaded');
});

//every 10 seconds fetch new bus positions
var interval = setInterval(fetchData,10000);

$('#buses').change(function() {
  //stop any interval
  clearInterval(interval);
  
  //set the interval to be 10secs from the change
  interval = setInterval(fetchData,10000);
});

//was there a center from before?
//Look at the server

// Try HTML5 geolocation
if(navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    
    var pos = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);

    var marker = new google.maps.Marker({
      map: map,
      position: pos,
      title: "You are Here",
      animation: google.maps.Animation.DROP
    });

    map.setCenter(pos);
    
    //found geo acccess
    $('body').addClass('geo');
    $('#lat').text(position.coords.latitude);
    $('#long').text(position.coords.longitude);
  }, function() {
    //no geo access
    $('body').addClass('no-geo-access');
  });
} else {
  //no geo location api is available
  $('body').addClass('no-geo');
}


//google.maps.event.addDomListener(window, 'load', initialize);