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
(`/chillout`) on `https://kaaos.radio`. Change URLs and Icecast mounts in
the `stations` map in `scripts/main.js`.
Selecting another station destroys the previous player and creates a new
instance, stopping its playback and metadata polling. Volume is preserved,
and playback waits for Play. Selecting the already-active station does nothing.
All stations use the existing Icecast status endpoint for now-playing titles.

To add another player, copy the `.player-container` markup in `index.html`,
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
constellation hook is intended for the main player only; other players
work independently without it.

Call `secondPlayer.destroy()` when removing a player to stop playback,
polling, requests, and event listeners.

Run player tests with `npm test`.
