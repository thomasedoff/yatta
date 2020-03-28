var cacheName = 'yatta-v1.1211';
var appShellFiles = [
  './style.css',
  './dark.css',
  './light.css',
  './yatta.png',
  './favicon.png',
  './index.html',
  './moment.js',
  './yatta.js'
];

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
          console.log('[Service Worker] Caching all: app shell and content');
      return cache.addAll(appShellFiles);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
          return Promise.all(keyList.map((key) => {
        if(key !== cacheName) {
          console.log('[Service Worker] Removing cache');
          return caches.delete(key);
        }
      }));
    })
  );
});
