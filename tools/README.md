# Banff 2026 — encrypted itinerary

`index.html` is the itinerary encrypted with [StatiCrypt](https://github.com/robinmoisson/staticrypt) (AES-256, decrypted in the browser). The readable version is never stored here.

To update: `BANFF_PW='<password>' tools/build.sh /path/to/itinerary.html`, then commit and push.
Do not change `tools/.staticrypt.json` (the salt); changing it or the password invalidates the shared link.

Offline: `sw.js` keeps a copy of the (still encrypted) page, icons and fonts on each device after one online visit, plus the photos already displayed (thumbnails are all fetched once online; enlarged photos when opened). Bump `VERSION` in `sw.js` if the list of cached files changes.

Icons: `tools/icon-square.svg` (home screen, square) and `tools/favicon.svg` (rounded, browser tab).
