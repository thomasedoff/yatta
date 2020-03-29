// Authenticate to VT API
getAccessToken = function(callback) {
  console.log("getAccessToken");
  if (!settings) return false;
  if (!localStorage.getItem("deviceId")) localStorage.setItem("deviceId", Math.random().toString(36).substr(2, 9));

  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://api.vasttrafik.se:443/token");
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader("Authorization", "Basic " + settings.apiKey);
  xhr.send("grant_type=client_credentials&scope=device_" + localStorage.getItem("deviceId"));

  xhr.addEventListener("loadend", function() {
    var json = JSON.parse(xhr.response);
    if (xhr.status === 200 && json.access_token) {
      localStorage.setItem("accessToken", json.access_token);
      apiKeyHelper(true)
      if (callback && typeof callback === "function") {
        console.log("callback:" + callback.name);
        callback();
      }
    } else {
      apiKeyHelper(false)
      console.log("No auth!")
    }
  });
};

// Fetch stops
getStops = function(stop) {
  console.log("getStops")
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.vasttrafik.se/bin/rest.exe/v2/location.name?input=" + stop + "&format=json");
  xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem("accessToken"));
  xhr.send(null);

  xhr.addEventListener("loadend", function() {
    var json = JSON.parse(xhr.response);
    if (xhr.status === 401) {
      getAccessToken();
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

  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://api.vasttrafik.se/bin/rest.exe/v2/departureBoard?id=" + settings.stopId + "&date=" + moment().format("YYYY-MM-DD") + "&time=" + moment().format("HH:mm") + "&maxdeparturesPerLine=2&format=json");
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
  var i = 0;
  var filteredDepartures = [];
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
  } else {
    document.getElementById("stopId").value = "";
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
loadSettings = function() {
  console.log("loadSettings");
  if (settings = JSON.parse(localStorage.getItem("settings"))) {
    // Lazy ...
    for (var setting in settings) {
      if (typeof settings[setting] === "boolean") document.getElementById(setting).checked = settings[setting];
      if (Array.isArray(settings[setting])) document.getElementById(setting).value = settings[setting].toString();
      if (typeof settings[setting] === "string" || typeof settings[setting] === "number") document.getElementById(setting).value = settings[setting];
    }

    if (settings.apiKey && settings.stopId && settings.tracks && settings.lines && settings.updateInterval) {
      clearInterval(window.loop);
      window.loop = setInterval(getDepartures, settings.updateInterval * 1000);
      document.getElementById("dark").media = settings.darkTheme ? "" : "none";
      return settings;
    }
  }
  console.log("No load!");
}

// Save settings
saveSettings = function() {
  console.log("saveSettings");
  var settings = {};
  settings.apiKey = document.getElementById("apiKey").value;
  settings.stopName = document.getElementById("stopName").value;
  settings.stopId = parseInt(document.getElementById("stopId").value);
  settings.lines = document.getElementById("lines").value ? document.getElementById("lines").value.replace(/\s+/, "").split(",") : [];
  settings.tracks = document.getElementById("tracks").value ? document.getElementById("tracks").value.toUpperCase().replace(/\s+/, "").split(",") : [];
  settings.maxRows = parseInt(document.getElementById("maxRows").value) || 10;
  settings.updateInterval = parseInt(document.getElementById("updateInterval").value) || 30;

  settings.blinkClock = document.getElementById("blinkClock").checked ? true : false;
  settings.groupDepartures = document.getElementById("groupDepartures").checked ? true : false;
  settings.absoluteTime = document.getElementById("absoluteTime").checked ? true : false;
  settings.showDestinations = document.getElementById("showDestinations").checked ? true : false;
  settings.showTracks = document.getElementById("showTracks").checked ? true : false;
  settings.darkTheme = document.getElementById("darkTheme").checked ? true : false;

  if (settings.apiKey && settings.stopId && settings.tracks && settings.lines && settings.updateInterval) {
    localStorage.setItem("settings", JSON.stringify(settings));
    return settings;
  } else {
    console.log("No save!");
  }
}

// apiKeyHelper
apiKeyHelper = function(success) {
  console.log("apiKeyHelper");
  if (success) {
    document.getElementById("apiKeyHelper").value = "OK";
    document.getElementById("apiKeyHelper").classList.add("apiKeyHelper--ok");
    document.getElementById("apiKeyHelper").classList.remove("apiKeyHelper--error");
  } else {
    document.getElementById("apiKeyHelper").value = "Error"
    document.getElementById("apiKeyHelper").classList.remove("apiKeyHelper--ok");
    document.getElementById("apiKeyHelper").classList.add("apiKeyHelper--error");

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
    document.getElementById("welcome").classList.add("invisible");
    document.getElementById("settings-form").classList.toggle("invisible");
    document.getElementById("table").classList.toggle("invisible");
  });

  // apiKey
  document.getElementById("apiKeyHelper").addEventListener("click", function() {
    if (document.getElementById("apiKey").validity.valid) {
      // Temporary settings
      localStorage.setItem("settings", JSON.stringify({"apiKey": document.getElementById("apiKey").value}));
      settings = JSON.parse(localStorage.getItem("settings"));
      getAccessToken();
    }
  });

  // stopName
  document.getElementById("stopName").addEventListener("input", function(e) {
    if (localStorage.getItem("accessToken")) {
      getStops(this.value);
    } else {
      apiKeyHelper(false);
    }
  });

  // save
  document.getElementById("settings-form").addEventListener("submit", function(e){
    e.preventDefault();
    if (saveSettings()) {
      document.getElementById("settings-form").classList.toggle("invisible");
      document.getElementById("table").classList.toggle("invisible");
      settings = loadSettings();
      getDepartures();
    }
  });

  // go!
  if (settings = loadSettings()) {
    getDepartures();
  } else {
    console.log("No init!")
    document.getElementById("welcome").classList.remove("invisible");
    document.getElementById("table").classList.remove("invisible");
  }
});
