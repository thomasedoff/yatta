# YATTA - Yet Another Time Table Application
This app shows real time information on Västtrafik departures for a given stop (similar to the "Nästa tur" digital displays and "Skylt På Arbetsplats") .

![YATTA on a PC](https://user-images.githubusercontent.com/51061686/78002588-c264c180-7337-11ea-8df7-4518035e17d4.png)

**To use the app, visit [thomasedoff.github.io/yatta](https://thomasedoff.github.io/yatta/).**

## Instructions
Visit the above link on any device, go to settings and search for the name of your stop (eg: `Centralstationen, Göteborg`), then save the settings. Initially, all lines on any track to any destination will be displayed. You can control what is displayed by specifying what tracks and lines to monitor in the settings.

There are also some optional settings that you can play with in order to find a layout that fit you needs and the screen real estate of your device.

## Tips
 - Click the clock to force a refresh.
 - The layout is responsive, so try different orientations.
 - To go fullscreen in iOS, follow the instructions on how to [Add a website icon to your iPhone Home screen](https://support.apple.com/guide/iphone/bookmark-favorite-webpages-iph42ab2f3a7/ios).
 - Similar features to the above are available in [Firefox](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Add_to_home_screen#How_do_you_use_it) and Chrome which can make the app behave like a native app.
  - YATTA is not meant to function as a travel planner. If that is what you're looking for try [Västtrafik To Go](https://www.vasttrafik.se/biljetter/mer-om-biljetter/vasttrafik-to-go/).
 
## More information
The app queries Västtrafik's [Reseplaneraren v2 API](https://developer.vasttrafik.se/portal/#/api/Reseplaneraren/v2/landerss) to search for stops and departures. If available, YATTA will display the estimated (real-time) departure time rather than scheduled departure time.

If you wish to host a local copy of this app, or fork this repo, please [create your own API key](https://developer.vasttrafik.se/portal/#/guides/get-started) for Västtrafik's API.
