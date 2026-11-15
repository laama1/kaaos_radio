const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

// Supplies the DOM behavior used by the player without a server or live audio.
class Control extends EventTarget {
    // Initializes media state and mutable UI properties.
    constructor() {
        super();
        this.paused = true;
        this.bufferedSeconds = 0;
        this.loadCount = 0;
        this.value = '75';
        this.attributes = {};
        this.style = {
            // Stores slider custom properties for assertions.
            setProperty(name, value) {
                this[name] = value;
            }
        };
    }

    // Records accessibility state.
    setAttribute(name, value) {
        this.attributes[name] = value;
    }

    // Simulates successful media playback and its event.
    async play() {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
        this.dispatchEvent(new Event('playing'));
    }

    // Simulates pauses from either the user or external media controls.
    pause() {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    }

    // Simulates resetting a media resource and discarding its buffered audio.
    load() {
        this.pause();
        this.bufferedSeconds = 0;
        this.loadCount += 1;
    }
}

// Creates isolated containers, timers, fetch responses, and a fresh class definition.
function fixture() {
    const timers = new Set();
    const errors = [];
    const responses = [];
    const requests = [];
    const context = vm.createContext({
        URL,
        AbortController,
        document: { baseURI: 'https://site.example/' },
        console: {
            // Captures failures without hiding them from assertions.
            error(...args) {
                errors.push(args);
            }
        },
        // Tracks polling lifecycle without leaving running timers.
        setInterval(callback) {
            timers.add(callback);
            return callback;
        },
        // Removes only the requested player's polling timer.
        clearInterval(timer) {
            timers.delete(timer);
        },
        // Returns queued Icecast responses or a deliberately pending request.
        async fetch(url, options) {
            requests.push({ url, options });
            if (responses.length) {
                return responses.shift();
            }
            // Waits for destruction to abort the initial metadata request.
            return new Promise((resolve, reject) => {
                // Simulates a browser fetch abort.
                options.signal.addEventListener('abort', () => reject(new Error('aborted')));
            });
        }
    });
    vm.runInContext(
        `${readFileSync(require.resolve('../scripts/player.js'), 'utf8')}\nthis.Player = IcecastPlayer;`,
        context
    );
    // Builds the required scoped controls for one instance.
    function create(options = {}) {
        const controls = new Map();
        for (const selector of [
            'audio', '[data-player-toggle]', '[data-player-play]', '[data-player-pause]',
            '[data-player-volume]', '[data-player-volume-value]', '[data-player-title]',
            '[data-station-name]', '.volume-label'
        ]) {
            controls.set(selector, new Control());
        }
        const root = {
            style: {},
            attributes: {},
            // Stores each panel's accessible state.
            setAttribute(name, value) {
                this.attributes[name] = value;
            },
            // Restricts selectors to this container.
            querySelector(selector) {
                return controls.get(selector);
            }
        };
        return new context.Player(root, { streamUrl: '/live', ...options });
    }
    return { create, timers, errors, responses, requests, Player: context.Player, context };
}

// Verifies one network request fans out to all mounts, including cached late subscribers.
test('shared status polls once, updates all mounts, and survives individual destruction', async () => {
    const { create, responses, requests, timers, errors } = fixture();
    let deliver;
    // Holds the first response while all four players subscribe.
    responses.push(new Promise((resolve) => {
        deliver = resolve;
    }));
    const players = ['live', 'stream2', 'chip', 'chill'].map(function createStation(mount) {
        // Uses relative and absolute forms of the same status URL.
        return create({
            streamUrl: `/${mount}`,
            statusUrl: mount === 'live' ? '/status' : 'https://site.example/status'
        });
    });
    assert.equal(requests.length, 1);
    assert.equal(timers.size, 1);
    await players[1].updateNowPlaying();
    assert.equal(requests.length, 1);
    deliver({
        ok: true,
        // Supplies all mounts in a single Icecast response.
        async json() {
            return { icestats: { source: ['live', 'stream2', 'chip', 'chill'].map(function source(mount) {
                // Returns distinct titles to verify exact per-player routing.
                return { listenurl: `https://icecast.example/${mount}`, title: `${mount} song` };
            }) } };
        }
    });
    await new Promise(setImmediate);
    for (const player of players) {
        assert.equal(player.marqueeText.textContent, `${player.mount.slice(1)} song`);
        assert.deepEqual(Array.from(player.trackHistory), [`${player.mount.slice(1)} song`]);
    }
    const late = create({ statusUrl: '/status' });
    assert.equal(late.marqueeText.textContent, 'live song');
    assert.equal(requests.length, 1);
    responses.push({
        ok: true,
        // Missing live metadata must not prevent other subscribers from updating.
        async json() {
            return { icestats: { source: [
                { listenurl: 'https://icecast.example/stream2', title: 'next song' },
                { listenurl: 'https://icecast.example/chip', title: 'chip song' },
                { listenurl: 'https://icecast.example/chill', title: 'chill song' }
            ] } };
        }
    });
    await Array.from(timers)[0]();
    assert.equal(requests.length, 2);
    assert.equal(players[1].marqueeText.textContent, 'next song');
    assert.deepEqual(Array.from(players[1].trackHistory), ['stream2 song', 'next song']);
    assert.equal(players[0].marqueeText.textContent, 'live song');
    assert.equal(errors.length, 2);
    players[0].destroy();
    assert.equal(timers.size, 1);
    // Leaves the next network request pending until the final subscriber is removed.
    const pending = players[1].updateNowPlaying();
    const request = requests.at(-1);
    for (const player of players.slice(1)) {
        player.destroy();
        assert.equal(request.options.signal.aborted, false);
    }
    late.destroy();
    await pending;
    assert.equal(request.options.signal.aborted, true);
    assert.equal(timers.size, 0);
    assert.equal(errors.length, 2);
});

// Ensures different Icecast servers do not share cached status or polling lifecycles.
test('different status URLs have independent services', async () => {
    const { create, requests, timers } = fixture();
    const first = create({ statusUrl: '/status' });
    const second = create({ statusUrl: 'https://other.example/status' });
    assert.notEqual(first.statusService, second.statusService);
    assert.equal(requests.length, 2);
    assert.equal(timers.size, 2);
    first.destroy();
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(requests[1].options.signal.aborted, false);
    assert.equal(timers.size, 1);
    second.destroy();
    await new Promise(setImmediate);
    assert.equal(timers.size, 0);
});

// Confirms playback, controls, and source URLs remain independent.
test('multiple instances isolate source, playback, volume, and destruction', async () => {
    const { create } = fixture();
    const first = create();
    const second = create({ streamUrl: 'https://other.example/other' });
    assert.equal(first.audio.src, 'https://site.example/live');
    assert.equal(second.audio.src, 'https://other.example/other');
    first.volumeSlider.value = '20';
    first.volumeSlider.dispatchEvent(new Event('input'));
    assert.equal(first.audio.volume, 0.2);
    assert.equal(second.audio.volume, 0.75);
    assert.equal(first.volumeValue.textContent, '20%');
    assert.equal(first.volumeSlider.style['--volume-level'], '20%');
    await first.togglePlayback();
    assert.equal(first.pauseIcon.style.display, 'block');
    assert.equal(second.audio.paused, true);
    first.audio.pause();
    assert.equal(first.playPauseBtn.attributes['aria-label'], 'Play');
    first.destroy();
    first.volumeSlider.value = '90';
    first.volumeSlider.dispatchEvent(new Event('input'));
    assert.equal(first.audio.volume, 0.2);
    await second.togglePlayback();
    assert.equal(second.audio.paused, false);
    second.destroy();
});

// Verifies stopping, restarting, and destruction discard buffered live audio.
test('playback resets the live buffer on start, stop, and destroy', async () => {
    const { create } = fixture();
    const player = create();
    assert.equal(player.audio.preload, 'none');
    player.audio.bufferedSeconds = 12;
    await player.togglePlayback();
    assert.equal(player.audio.bufferedSeconds, 0);
    assert.equal(player.audio.loadCount, 1);
    assert.equal(player.audio.paused, false);
    player.audio.bufferedSeconds = 20;
    await player.togglePlayback();
    assert.equal(player.audio.bufferedSeconds, 0);
    assert.equal(player.audio.loadCount, 2);
    assert.equal(player.audio.paused, true);
    assert.equal(player.playPauseBtn.attributes['aria-pressed'], 'false');
    await player.togglePlayback();
    assert.equal(player.audio.loadCount, 3);
    assert.equal(player.audio.paused, false);
    player.audio.bufferedSeconds = 8;
    player.destroy();
    assert.equal(player.audio.bufferedSeconds, 0);
    assert.equal(player.audio.loadCount, 4);
    assert.equal(player.audio.paused, true);
});

// Checks exact mount selection, status URL resolution, and optional title formatting.
test('metadata accepts both Icecast source shapes and matches exact mounts', async () => {
    for (const array of [false, true]) {
        const { create, responses, requests, timers } = fixture();
        const player = create({
            statusUrl: '/status-json.xsl',
            // Makes formatting observable without station-specific logic in the class.
            titleFormatter(title) {
                return title.toUpperCase();
            }
        });
        player.statusService.request.abort();
        await new Promise(setImmediate);
        const source = { listenurl: 'https://icecast.example/live', title: 'selected' };
        responses.push({
            ok: true,
            // Supplies either supported Icecast JSON representation.
            async json() {
                return { icestats: { source: array
                    ? [{ listenurl: 'https://icecast.example/live-backup', title: 'wrong' }, source]
                    : source } };
            }
        });
        await player.updateNowPlaying();
        assert.equal(player.marqueeText.textContent, 'SELECTED');
        assert.equal(requests[0].url, 'https://site.example/status-json.xsl');
        assert.equal(timers.size, 1);
        player.destroy();
        assert.equal(timers.size, 0);
    }
});

// Ensures a proxy stream can select a differently named Icecast mount.
test('explicit mount and unformatted titles are supported', async () => {
    const { create, responses } = fixture();
    responses.push({
        ok: true,
        // Returns the upstream mount rather than the public proxy pathname.
        async json() {
            return { icestats: { source: { listenurl: 'https://icecast.example/upstream', title: 'Artist - Track' } } };
        }
    });
    const player = create({ statusUrl: '/status', mount: '/upstream' });
    await new Promise(setImmediate);
    assert.equal(player.marqueeText.textContent, 'Artist - Track');
    player.destroy();
});

// Records title transitions, not repeated polls, independently for each player.
test('track history records formatted song changes and returning songs per player', async () => {
    const { create, responses, errors } = fixture();
    const first = create({
        // Demonstrates the same formatting used by the marquee.
        titleFormatter(title) {
            return title.replace('Station - ', '');
        }
    });
    const second = create();
    first.statusUrl = 'https://site.example/status';
    second.statusUrl = first.statusUrl;
    for (const title of ['Station - Song A', 'Station - Song A', 'Station - Song B', 'Station - Song A']) {
        responses.push({
            ok: true,
            // Supplies a metadata poll for the selected mount.
            async json() {
                return { icestats: { source: { listenurl: 'https://site.example/live', title } } };
            }
        });
        await first.updateNowPlaying();
    }
    assert.deepEqual(Array.from(first.trackHistory), ['Song A', 'Song B', 'Song A']);
    assert.equal(first.marqueeText.textContent, 'Song A');
    assert.equal(second.trackHistory.length, 0);
    responses.push({ ok: false, status: 503 });
    await first.updateNowPlaying();
    assert.equal(first.trackHistory.length, 3);
    assert.equal(errors.length, 1);
    first.stop();
    assert.equal(first.trackHistory.length, 3);
    first.destroy();
    await first.updateNowPlaying();
    assert.equal(first.trackHistory.length, 3);
    second.destroy();
});

// Validates opt-in metadata and cleanup of an in-flight metadata request.
test('polling is optional and pending requests are aborted on destroy', async () => {
    const { create, requests, timers, errors } = fixture();
    const plain = create();
    assert.equal(requests.length, 0);
    assert.equal(timers.size, 0);
    const player = create({ statusUrl: '/status' });
    await player.updateNowPlaying();
    assert.equal(requests.length, 1);
    player.destroy();
    await new Promise(setImmediate);
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(errors.length, 0);
    plain.destroy();
});

// Verifies failures are reported without falsely showing playback or replacing titles.
test('playback and metadata failures are explicit', async () => {
    const { create, errors, responses } = fixture();
    const player = create();
    // Simulates a browser playback rejection.
    player.audio.play = async function () {
        throw new Error('play denied');
    };
    await player.togglePlayback();
    assert.equal(player.playIcon.style.display, 'block');
    assert.equal(errors.length, 1);
    player.statusUrl = 'https://site.example/status';
    responses.push({ ok: false, status: 503 });
    await player.updateNowPlaying();
    assert.match(errors[1][1].message, /503/);
    responses.push({
        ok: true,
        // Simulates an offline or missing Icecast mount.
        async json() {
            return { icestats: {} };
        }
    });
    await player.updateNowPlaying();
    assert.match(errors[2][1].message, /mount \/live/);
    player.destroy();
});

// Prevents pending visualizer setup from starting removed players or duplicate playback.
test('async beforePlay is instance-scoped and destruction prevents delayed playback', async () => {
    const { create } = fixture();
    let finish;
    let receivedAudio;
    const player = create({
        // Holds initialization until the test removes the player.
        beforePlay(audio) {
            receivedAudio = audio;
            // Exposes completion of the asynchronous setup.
            return new Promise((resolve) => {
                finish = resolve;
            });
        }
    });
    const pending = player.togglePlayback();
    await player.togglePlayback();
    assert.equal(receivedAudio, player.audio);
    player.destroy();
    finish();
    await pending;
    assert.equal(player.audio.paused, true);
});

// Rejects missing source URLs and missing controls during initialization.
test('invalid initialization fails explicitly', () => {
    const { create, Player } = fixture();
    assert.throws(() => create({ streamUrl: '' }), /requires a streamUrl/);
    assert.throws(() => new Player(null, { streamUrl: '/live' }), /requires a player container/);
    assert.throws(() => new Player({
        // Represents incomplete player markup.
        querySelector() {
            return null;
        }
    }, { streamUrl: '/live' }), /missing control: audio/);
});

// Exercises persistent panels, directional sliding, and isolated media controls.
test('station buttons slide persistent players without changing playback', async () => {
    const { create, context, timers, errors } = fixture();
    const track = {
        style: {},
        children: [],
        // Records the four generated player panels.
        appendChild(container) {
            this.children.push(container);
        }
    };
    const template = { content: { firstElementChild: {
        // Supplies a fresh panel's controls for each template clone.
        cloneNode() {
            const placeholder = create();
            placeholder.destroy();
            return placeholder.container;
        }
    } } };
    const names = ['live', '247stream', 'chip', 'chillout'];
    const buttons = names.map(function createStationButton(name) {
        // Supplies the data attribute read by the station click handler.
        const button = new Control();
        button.dataset = { station: name };
        return button;
    });
    // Exposes the carousel track and template to site initialization.
    context.document.getElementById = function getElementById(id) {
        return id === 'playerTrack' ? track : template;
    };
    // Exposes all four station buttons to the site's initialization script.
    context.document.querySelectorAll = function querySelectorAll(selector) {
        assert.equal(selector, '[data-station]');
        return buttons;
    };
    const hookAudio = [];
    // Records which audio element is connected to the visualizer.
    context.setupAnalyser = function setupAnalyser(audio) {
        hookAudio.push(audio);
    };
    vm.runInContext(readFileSync(require.resolve('../scripts/main.js'), 'utf8'), context);
    let player = vm.runInContext('radioPlayer', context);
    const original = player;
    assert.equal(track.children.length, 4);
    assert.equal(player.audio.src, 'https://kaaos.radio/stream2');
    assert.equal(player.audio.paused, true);
    assert.equal(timers.size, 1);
    player.volumeSlider.value = '32';
    player.volumeSlider.dispatchEvent(new Event('input'));
    await player.togglePlayback();
    assert.equal(player.audio.paused, false);
    assert.equal(buttons[1].attributes['data-playing'], 'true');
    assert.equal(buttons[1].attributes['aria-label'], '247stream (playing)');
    player.audio.dispatchEvent(new Event('waiting'));
    assert.equal(buttons[1].attributes['data-playing'], 'false');
    player.audio.dispatchEvent(new Event('playing'));
    assert.equal(buttons[1].attributes['data-playing'], 'true');
    const mounts = ['/stream', '/stream2', '/chip', '/chill'];

    for (let index = 0; index < buttons.length; index += 1) {
        const previous = player;
        previous.audio.bufferedSeconds = 12;
        const previousLoadCount = previous.audio.loadCount;
        buttons[index].dispatchEvent(new Event('click'));
        player = vm.runInContext('radioPlayer', context);
        assert.notEqual(player, previous);
        assert.equal(previous.destroyed, false);
        assert.equal(previous.audio.paused, false);
        assert.equal(previous.audio.bufferedSeconds, 12);
        assert.equal(previous.audio.loadCount, previousLoadCount);
        assert.notEqual(player.audio, previous.audio);
        assert.equal(player.container, track.children[index]);
        assert.equal(track.style.transform, `translateX(-${index * 100}%)`);
        assert.equal(buttons[names.indexOf(previous.container.querySelector('[data-station-name]').textContent)]
            .attributes['data-playing'], 'true');
        assert.equal(player.audio.src, `https://kaaos.radio${mounts[index]}`);
        assert.equal(player.mount, mounts[index]);
        assert.equal(player.audio.volume, index === 1 ? 0.32 : 0.75);
        assert.equal(player.volumeValue.textContent, index === 1 ? '32%' : '75%');
        assert.equal(player.container.querySelector('[data-station-name]').textContent, names[index]);
        assert.equal(player.marqueeText.textContent, `KAAOS.RADIO - ${names[index]}`);
        assert.equal(timers.size, 1);
        for (let other = 0; other < buttons.length; other += 1) {
            assert.equal(buttons[other].attributes['aria-pressed'], String(other === index));
            assert.equal(track.children[other].inert, other !== index);
            assert.equal(track.children[other].attributes['aria-hidden'], String(other !== index));
        }
        if (player.audio.paused) {
            await player.togglePlayback();
        }
        assert.equal(player.audio.paused, false);
        assert.equal(buttons[index].attributes['data-playing'], 'true');
        assert.equal(buttons[index].attributes['aria-label'], `${names[index]} (playing)`);
        buttons[index].dispatchEvent(new Event('click'));
        assert.equal(vm.runInContext('radioPlayer', context), player);
        assert.equal(player.audio.paused, false);
    }

    assert.equal(hookAudio.length, 4);
    buttons[1].dispatchEvent(new Event('click'));
    assert.equal(vm.runInContext('radioPlayer', context), original);
    assert.equal(original.audio.paused, false);
    assert.ok(buttons.every(function isPlaying(button) {
        // All four streams keep playing regardless of which panel is visible.
        return button.attributes['data-playing'] === 'true';
    }));
    await original.togglePlayback();
    assert.equal(original.audio.paused, true);
    assert.equal(buttons[1].attributes['data-playing'], 'false');
    assert.equal(vm.runInContext("radioPlayers.get('chillout').audio.paused", context), false);
    assert.equal(original.audio.volume, 0.32);
    vm.runInContext('for (const player of radioPlayers.values()) player.destroy();', context);
    await new Promise(setImmediate);
    assert.equal(timers.size, 0);
    assert.equal(errors.length, 0);
});

// Stops an asynchronous start without destroying the persistent player.
test('stop cancels delayed playback and allows a later start', async () => {
    const { create } = fixture();
    let finish;
    const player = create({
        // Delays the visualizer hook to simulate switching during setup.
        beforePlay() {
            // Exposes the pending setup completion.
            return new Promise((resolve) => {
                finish = resolve;
            });
        }
    });
    const pending = player.togglePlayback();
    player.stop();
    finish();
    await pending;
    assert.equal(player.audio.paused, true);
    player.beforePlay = null;
    await player.togglePlayback();
    assert.equal(player.audio.paused, false);
    player.destroy();
});
