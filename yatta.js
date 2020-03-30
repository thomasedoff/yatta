// Default settings
const defaultSettings = {
  "apiKey": "eUdRM0JjQXB4cDIxc0wxcWlhRjFrNTdaWG9NYTp4VG1GSTRYS3Nrakw4bVowRWF0RzNReFlEX2dh",
  "deviceId": Math.random().toString(36).substr(2, 9),
  "stopName": "Centralstationen, Göteborg",
  "stopId": 9021014001950000,
  "lines": [],
  "tracks": [],
  "maxRows": 10,
  "updateInterval": 30,
  "timeZone": "Europe/Stockholm"
}


// Authenticate to VT API
getAccessToken = function(callback) {
  console.log("getAccessToken");
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.vasttrafik.se:443/token");
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Authorization", "Basic " + settings.apiKey);
  xhr.send("grant_type=client_credentials&scope=device_" + settings.deviceId);

  xhr.addEventListener("loadend", function() {
    if (xhr.status === 200) {
      localStorage.setItem("accessToken", JSON.parse(xhr.response).access_token);
      updateHelper(document.getElementById("apiKeyHelper"), true);
      if (callback && typeof callback === "function") {
        console.log("callback:" + callback.name);
        callback();
      }
    } else {
      updateHelper(document.getElementById("apiKeyHelper"), false);
      console.log("No auth!")
    }
  });
};

// Fetch stops
getStops = function(stopName) {
  console.log("getStops");
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.vasttrafik.se/bin/rest.exe/v2/location.name?input=" + stopName + "&format=json");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem("accessToken"));
  xhr.send(null);

  xhr.addEventListener("loadend", function() {
    var json = JSON.parse(xhr.response);
    if (xhr.status === 401) {
      getAccessToken(getStops);
    } else if (xhr.status === 200 && Array.isArray(json.LocationList.StopLocation)) {
      generateDataList(json.LocationList.StopLocation);
    } else {
      console.log("No stops!")
    }
  });
};

// Fetch departures
getDepartures = function() {
  console.log("getDepartures");
  if (settings.blinkClock) document.getElementById("clock").innerText = "--:--";
  // Quickfix for old settings
  if (!settings.timeZone) settings.timeZone = "Europe/Stockholm";
  var date = moment().tz(settings.timeZone).format("YYYY-MM-DD");
  var time = moment().tz(settings.timeZone).format("HH:mm");

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.vasttrafik.se/bin/rest.exe/v2/departureBoard?id=" + settings.stopId + "&date=" + date + "&time=" + time + "&maxdeparturesPerLine=2&format=json");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem("accessToken"));
  xhr.send(null);

  xhr.addEventListener("loadend", function() {
    var json = JSON.parse(xhr.response);
    if (xhr.status === 401) {
      getAccessToken(getDepartures);
    } else if (xhr.status === 200 && !json.DepartureBoard.error) {
      sortDepartures(json.DepartureBoard);
    } else {
      console.log("No departures!")
    }
  });
};

// Filter matching departures
sortDepartures = function(allDepartures) {
  console.log("sortDepartures")
  var ServerDatetime = moment(allDepartures.serverdate + " " + allDepartures.servertime, "YYYY-MM-DD HH:mm");
  var filteredDepartures = [];
  var i = 0;
  for (var departure in allDepartures.Departure) {
    // Use rtTime if exists, calculate minutes left, use specified format
    var dynamicTime = allDepartures.Departure[departure].rtTime ? allDepartures.Departure[departure].rtTime : allDepartures.Departure[departure].time;
    var absoluteDepartureDatetime = moment(allDepartures.Departure[departure].date + " " + dynamicTime, "YYYY-MM-DD HH:mm")
    var relativedepartureTime = parseInt(moment.duration(absoluteDepartureDatetime.diff(ServerDatetime)).asMinutes());
    var departureTime = settings.absoluteTime ? dynamicTime : relativedepartureTime;

    // Only traverse departures on specific tracks
    if (
      (settings.tracks.includes(allDepartures.Departure[departure].track) || settings.tracks.length === 0) &&
      (settings.lines.includes(allDepartures.Departure[departure].sname) || settings.lines.length === 0) &&
      (i < settings.maxRows || !settings.maxRows)
    ) {
      if (!settings.absoluteTime && departureTime <= 0) departureTime = "Now";
      if (allDepartures.Departure[departure].cancelled) departureTime = "Cancelled"

      if (settings.groupDepartures) {
        // Append to existing line if it already exists
        var object = filteredDepartures.find(o => o.Line === allDepartures.Departure[departure].sname) && filteredDepartures.find(o => o.Destination === allDepartures.Departure[departure].direction);
        if (object && object.Next === "") object.Next = departureTime;
        if (!object) {
          filteredDepartures.push({"Line": allDepartures.Departure[departure].sname,
                          "Destination": allDepartures.Departure[departure].direction,
                          "Departure": departureTime, "Next": "",
                          "Track": allDepartures.Departure[departure].track,
                          "color": allDepartures.Departure[departure].bgColor,
                          "background": allDepartures.Departure[departure].fgColor}
                        );
        }
      } else {
        // Otherwise simply populate with current
        filteredDepartures.push({"Line": allDepartures.Departure[departure].sname,
                        "Destination": allDepartures.Departure[departure].direction,
                        "Departure": departureTime,
                        "Track": allDepartures.Departure[departure].track,
                        "color": allDepartures.Departure[departure].bgColor,
                        "background": allDepartures.Departure[departure].fgColor});
      }
      i++;
    }
  };

  document.getElementById("clock").innerText = allDepartures.servertime;
  generateTable(filteredDepartures);
}

// Generate HTML datalist
generateDataList = function(locations) {
  console.log("generateDataList");
  var options = "";
  for (var location of locations) {
    options += "<option value='" + location.name + "'></option>";
  }
  document.getElementById("locations").innerHTML = options;

  // Populate stopId if a match is found
  if (object = locations.find(o => o.name.toLowerCase() === document.getElementById("stopName").value.toLowerCase())) {
    document.getElementById("stopId").value = object.id;
    updateHelper(document.getElementById("stopNameHelper"), true);
  } else {
    document.getElementById("stopId").value = "";
    updateHelper(document.getElementById("stopNameHelper"), false);
  }
}

// Generate HTML table
generateTable = function(departures) {
  console.log("generateTable");
  var tbody = "<tbody><tr><th>Line</th>"
  if (settings.showDestinations) tbody += "<th>Destination</th>";
  tbody += "<th>Departure</th>";
  if (settings.groupDepartures) tbody += "<th>Next</th>";
  if (settings.showTracks) tbody += "<th>Track</th>";
  tbody += "</tr></tbody>"

  var columns = ""
  for (departure of departures) {
    // Use VT colors
    var divStyle = "background: " + departure.background + "; color:" + departure.color;
    var spanClass = departure.Line.length > 2 ? "Line--small" : "";
    columns += "<tr><td><div class='Line' style='" + divStyle + "'><span class='" + spanClass + "'>" + departure.Line + "</span></div></td>";
    if (settings.showDestinations) columns += "<td>" + departure.Destination + "</td>";
    columns += "<td>" + departure.Departure + "</td>";
    if (settings.groupDepartures) columns +=  "<td><span>" + departure.Next + "</span></td>";
    if (settings.showTracks) columns += "<td>" + departure.Track + "</td>";
    columns += "</tr>"
  }

  tbody += "<tbody>" + columns + "</tbody>";
  document.getElementById("table").innerHTML = tbody;
}

// Load settings
loadSettings = function(defaultSettings) {
  console.log("loadSettings");
  var settings = localStorage.getItem("settings") ? JSON.parse(localStorage.getItem("settings")) : defaultSettings;
    // Populate HTML fields
  for (var setting in settings) {
    if (setting === "skipWelcome") continue;
    if (typeof settings[setting] === "boolean") document.getElementById(setting).checked = settings[setting];
    if (Array.isArray(settings[setting])) document.getElementById(setting).value = settings[setting].toString();
    if (typeof settings[setting] === "string" || typeof settings[setting] === "number") document.getElementById(setting).value = settings[setting];
  }

  document.getElementById("dark").media = settings.darkTheme ? "" : "none";
  if (document.getElementById("stopName").validity.valid && document.getElementById("stopId").validity.valid) updateHelper(document.getElementById("stopNameHelper"), true)

  clearInterval(window.loop);
  window.loop = setInterval(getDepartures, settings.updateInterval * 1000);

  localStorage.setItem("settings", JSON.stringify(settings));
  return settings;
}

// Save settings
saveSettings = function(defaultSettings) {
  console.log("saveSettings");
  var settings = {};
  settings.skipWelcome = true;
  settings.timeZone = defaultSettings.timeZone;
  settings.apiKey = document.getElementById("apiKey").value;
  settings.deviceId = localStorage.getItem("deviceId") || defaultSettings.deviceId;
  settings.stopName = document.getElementById("stopName").value ? document.getElementById("stopName").value : defaultSettings.stopName;
  settings.stopId = parseInt(document.getElementById("stopId").value) ? document.getElementById("stopId").value : defaultSettings.stopId;
  settings.lines = document.getElementById("lines").value ? document.getElementById("lines").value.replace(/\s+/, "").split(",") : defaultSettings.lines;
  settings.tracks = document.getElementById("tracks").value ? document.getElementById("tracks").value.toUpperCase().replace(/\s+/, "").split(",") : defaultSettings.tracks;
  settings.maxRows = parseInt(document.getElementById("maxRows").value) || defaultSettings.maxRows;
  settings.updateInterval = parseInt(document.getElementById("updateInterval").value) || defaultSettings.updateInterval;

  // These defaults are set in index.html
  settings.blinkClock = document.getElementById("blinkClock").checked ? true : false;
  settings.groupDepartures = document.getElementById("groupDepartures").checked ? true : false;
  settings.absoluteTime = document.getElementById("absoluteTime").checked ? true : false;
  settings.showDestinations = document.getElementById("showDestinations").checked ? true : false;
  settings.showTracks = document.getElementById("showTracks").checked ? true : false;
  settings.darkTheme = document.getElementById("darkTheme").checked ? true : false;
  localStorage.setItem("settings", JSON.stringify(settings));
}

// updateHelper
updateHelper = function(element, success) {
  console.log("updateHelper");
  if (success) {
    element.value = "✓"
    element.classList.add("helper--ok");
    element.classList.remove("helper--error");
  } else {
    element.value = "✗"
    element.classList.remove("helper--ok");
    element.classList.add("helper--error");
  }
}

// showElement
showElement = function(targetElement) {
  var elements = document.querySelectorAll('[data-toggleable]');
  for (var element of elements) {
    if (element === targetElement) {
      targetElement.classList.remove("invisible");
    } else {
      element.classList.add("invisible");
    }
  }
}


/* EVENT LISTENERS */
document.addEventListener("DOMContentLoaded", function() {
  // Safari doesn't support the fullscreen API?
  if (document.documentElement.requestFullscreen) document.getElementById("fullscreen-icon").classList.remove("hidden");

  // clock
  document.getElementById("clock").addEventListener("click", function() {
    if (document.getElementById("settings-form").classList.contains("invisible")) getDepartures();
  });

  // fullscreen
  document.getElementById("fullscreen-icon").addEventListener("click", function() {
    window.fullScreen ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  });

  // settings-form
  document.getElementById("settings-icon").addEventListener("click", function() {
    if (document.getElementById("settings-form").classList.contains("invisible")) {
      showElement(document.getElementById("settings-form"));
    } else {
      showElement(document.getElementById("table"));
    }
  });

  // apiKey
  document.getElementById("apiKey").addEventListener("input", function() {
    if (this.validity.valid) {
      settings.apiKey = this.value;
      getAccessToken(null);
    }
  });

  // stopName
  document.getElementById("stopName").addEventListener("input", function(e) {
    if (this.validity.valid) {
      getStops(this.value);
    }
  });

  // save
  document.getElementById("settings-form").addEventListener("submit", function(e){
    e.preventDefault();
    saveSettings(defaultSettings);
    if (settings = loadSettings()) {
      showElement(document.getElementById("table"));
      getDepartures(null);
    }
  });

  // go!
  if (settings = loadSettings(defaultSettings)) getAccessToken(getDepartures(null));
  if (!settings.skipWelcome) showElement(document.getElementById("welcome"));
});
