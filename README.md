# README
Install and configure icecast.
Install and configure a web server.

Install node dependencies like sass using:

> npm install

Compile scss manually using:

> npx sass style.scss style.css --no-source-map

or in real time after every save, using "watch" parameter

> npx sass --watch style.scss:style.css

## Reusable Icecast player

`scripts/player.js` defines the standalone `IcecastPlayer` class.
`scripts/main.js` configures the existing station and its constellation hook.
Load the class before your initialization script, using `defer` for both.

The four station buttons above the player select live (`/stream`),
247stream (`/stream2`, selected initially), chip (`/chip`), or chillout
(`/chill`) on `https://kaaos.radio`. Change URLs and Icecast mounts in
the `stations` map in `scripts/main.js`.
Four persistent `.radio-player` panels are created from `radioPlayerTemplate`,
each with its own audio element, controls, volume, and metadata polling.
Selecting a station slides the contents inside the fixed `.player-container`:
selecting a station to the right moves the contents left, and vice versa.
The outgoing stream stops and clears its buffer; the incoming stream waits
for Play. Each station remembers its volume. Inactive panels are inaccessible
to keyboard and screen-reader navigation. Reduced-motion preferences disable
the slide animation. Selecting the already-active station does nothing.
All stations use the existing Icecast status endpoint for now-playing titles.

To add a standalone player, copy the `.radio-player` markup from the template in `index.html`,
give its container a unique ID, and make the audio ID and volume input
ID unique (including the label's `for` and output's `for` attributes).
Keep the `data-player-*` attributes: controls are looked up only within
each container.

```js
const secondPlayer = new IcecastPlayer('#secondPlayer', {
    streamUrl: 'https://radio.example.org/live',
    statusUrl: 'https://radio.example.org/status-json.xsl',
    mount: '/live'
});
```

`streamUrl` is required. `statusUrl` is optional; omit it to disable
now-playing polling. Metadata refreshes immediately and every 10 seconds.
`mount` defaults to the stream URL's pathname; set it explicitly when a
proxy URL differs from the mount reported in Icecast's `listenurl`.
Cross-origin audio and status endpoints must allow browser access.

Optional `titleFormatter(title)` customizes titles, and
`beforePlay(audio)` connects a visualizer before playback. The site's
constellation hook supports all four station panels, reusing each audio
element's Web Audio source and connecting only the last played source.
Standalone players work independently without it.

Call `secondPlayer.destroy()` when removing a player to stop playback,
polling, requests, and event listeners.
Stopping playback (including `player.stop()`) clears buffered audio.
Starting playback reloads the stream to reconnect live rather than resuming
old buffered content. Audio preloading is disabled while stopped.

## Running tests

With Node.js and npm installed, run the tests from the project root:

```sh
npm test
```

This runs Node.js's built-in test runner (`node --test`). Tests use simulated
DOM controls and Icecast responses; no web server, browser, or live stream
is required.

To run only the player and station-switching tests:

```sh
node --test tests/player.test.js
```

The output shows passing and failing tests. A nonzero exit code means a test
failed.
