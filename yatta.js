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
      var options = "";
      for (var suggestion of json.LocationList.StopLocation) {
        options += "<option value='" + suggestion.name + "'></option>";
      }
      document.getElementById("suggestions").innerHTML = options;

      // Populate stopId if a match is found
      if (object = json.LocationList.StopLocation.find(o => o.name.toLowerCase() === document.getElementById("stopName").value.toLowerCase())) {
        document.getElementById("stopId").value = object.id;
      } else {
        document.getElementById("stopId").value = "";
      }
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

  xhr.addEventListener("error", function() {
    document.getElementById("table").innerHTML = "";
  });

  xhr.addEventListener("loadend", function() {
    var json = JSON.parse(xhr.response);
    if (xhr.status === 401) {
      getAccessToken(getDepartures);
    } else if (xhr.status === 200 && !json.DepartureBoard.error) {
      sortDepartures(json);
    } else {
      console.log("No departures!")
    }
  });
};

// Extracts relevant entries to a new object
sortDepartures = function(json) {
  console.log("sortDepartures")
  var ServerDatetime = moment(json.DepartureBoard.serverdate + " " + json.DepartureBoard.servertime, "YYYY-MM-DD HH:mm");

  var departures = [];
  for (var departure in json.DepartureBoard.Departure) {
    // Use rtTime if exists, calculate minutes left, use specified format
    var dynamicTime = json.DepartureBoard.Departure[departure].rtTime ? json.DepartureBoard.Departure[departure].rtTime : json.DepartureBoard.Departure[departure].time;
    var absoluteDepartureDatetime = moment(json.DepartureBoard.Departure[departure].date + " " + dynamicTime, "YYYY-MM-DD HH:mm")
    var relativedepartureTime = parseInt(moment.duration(absoluteDepartureDatetime.diff(ServerDatetime)).asMinutes());
    var departureTime = settings.absoluteTime ? dynamicTime : relativedepartureTime;

    // Only traverse departures on specific tracks
    if (
      (settings.tracks.includes(json.DepartureBoard.Departure[departure].track) || settings.tracks.length === 0) &&
      (settings.lines.includes(json.DepartureBoard.Departure[departure].sname) || settings.lines.length === 0)
    ) {
      if (!settings.absoluteTime && departureTime <= 0) departureTime = "Now";
      if (json.DepartureBoard.Departure[departure].cancelled) departureTime = "Cancelled"

      if (settings.groupDepartures) {
        // Append to existing line if it already exists
        var object = departures.find(o => o.Line === json.DepartureBoard.Departure[departure].sname) && departures.find(o => o.Destination === json.DepartureBoard.Departure[departure].direction);
        if (object && object.Next === "") object.Next = departureTime;
        if (!object) {
          departures.push({"Line": json.DepartureBoard.Departure[departure].sname,
                          "Destination": json.DepartureBoard.Departure[departure].direction,
                          "Departure": departureTime, "Next": "",
                          "Track": json.DepartureBoard.Departure[departure].track,
                          "color": json.DepartureBoard.Departure[departure].bgColor,
                          "background": json.DepartureBoard.Departure[departure].fgColor}
                        );
        }
      } else {
        // Otherwise simply populate with current
        departures.push({"Line": json.DepartureBoard.Departure[departure].sname,
                        "Destination": json.DepartureBoard.Departure[departure].direction,
                        "Departure": departureTime,
                        "Track": json.DepartureBoard.Departure[departure].track,
                        "color": json.DepartureBoard.Departure[departure].bgColor,
                        "background": json.DepartureBoard.Departure[departure].fgColor});
      }
    }
  };

  document.getElementById("clock").innerText = json.DepartureBoard.servertime;
  generateTable(departures);
}

// Generates HTML table
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
    for (var setting in settings) {
      if (typeof settings[setting] === "boolean") document.getElementById(setting).checked = settings[setting];
      if (Array.isArray(settings[setting])) document.getElementById(setting).value = settings[setting].toString();
      if (typeof settings[setting] === "string" || typeof settings[setting] === "number") document.getElementById(setting).value = settings[setting];
    }
    document.getElementById("dark").media = settings.darkTheme ? "" : "none";
    if (settings.apiKey && settings.stopId && settings.tracks && settings.lines && settings.updateInterval) {
      clearInterval(window.loop);
      window.loop = setInterval(getDepartures, settings.updateInterval * 1000);
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
