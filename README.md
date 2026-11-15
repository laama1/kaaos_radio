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
each with its own audio element, controls, volume, and track history.
Selecting a station slides the contents inside the fixed `.player-container`:
selecting a station to the right moves the contents left, and vice versa.
Selection does not start or stop audio: a playing stream continues when its
panel is hidden. Use each station's Play/Pause control to manage playback;
multiple streams can play together, with a speaker icon on each playing station.
Each station remembers its volume. Inactive panels are inaccessible
to keyboard and screen-reader navigation. Reduced-motion preferences disable
the slide animation. Selecting the already-active station does nothing.
All stations use the existing Icecast status endpoint for now-playing titles.
A small speaker icon after a station label indicates actual playback, not
selection. It disappears when playback pauses, buffers, ends, or fails.

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
now-playing polling. `IcecastStatusService` in `scripts/player.js` shares
one request and one 10-second timer per status URL. All subscribed players
receive each response and select their own mount. Later subscribers receive
the latest cached status without another request. Destroying one player
leaves the others subscribed; destroying the last stops polling and aborts
any pending request. Calling `player.updateNowPlaying()` refreshes the shared
status for all players on that URL, unless a request is already pending.
Each player's `trackHistory` is an in-memory array of formatted song titles,
oldest first. The first detected song is included; repeated polls of the
same title are skipped. A song returning after another song is recorded again.
Access it with `radioPlayers.get('247stream').trackHistory`, for example.
Histories are independent per station and reset when the page reloads.

`mount` defaults to the stream URL's pathname; set it explicitly when a
proxy URL differs from the mount reported in Icecast's `listenurl`.
Cross-origin audio and status endpoints must allow browser access.

Optional `titleFormatter(title)` customizes titles, and
`beforePlay(audio)` connects a visualizer before playback. The site's
constellation hook supports all four station panels, reusing each audio
element's Web Audio source and keeping sources connected so simultaneous
streams remain audible and contribute to the animation.
Standalone players work independently without it.

Call `secondPlayer.destroy()` when removing a player to stop playback,
polling, requests, and event listeners.
Stopping playback (including `player.stop()`) clears buffered audio.
Starting playback reloads the stream to reconnect live rather than resuming
old buffered content. Audio preloading is disabled while stopped.

## Particle collisions

`PARTICLE_SPEED` in `scripts/constellation.js` scales initial particle
velocities. The default `2` doubles their original speed; `1` restores it.
Audio-reactive movement and collision speed preservation still apply.

The constellation's `PARTICLE_COLLISION_ENABLED` flag in
`scripts/constellation.js` enables collision responses. Centers closer than
20 pixels are separated to 20 pixels and redirected onto mutually perpendicular,
outward paths while keeping their speeds. This threshold is independent of
the audio-reactive hole radius.

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
