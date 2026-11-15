const stations = {
    live: { streamUrl: 'https://kaaos.radio/stream', mount: '/stream' },
    '247stream': { streamUrl: 'https://kaaos.radio/stream2', mount: '/stream2' },
    chip: { streamUrl: 'https://kaaos.radio/chip', mount: '/chip' },
    chillout: { streamUrl: 'https://kaaos.radio/chill', mount: '/chill' }
};
const stationButtons = document.querySelectorAll('[data-station]');
const playerTrack = document.getElementById('playerTrack');
const playerTemplate = document.getElementById('radioPlayerTemplate');
const stationNames = Object.keys(stations);
const radioPlayers = new Map();
let radioPlayer;
let selectedStation;

for (const name of stationNames) {
    const playerContainer = playerTemplate.content.firstElementChild.cloneNode(true);
    playerContainer.id = `radioPlayer-${name}`;
    playerContainer.setAttribute('aria-label', `${name} radio player`);
    const volumeId = `volumeSlider-${name}`;
    playerContainer.querySelector('[data-player-volume]').id = volumeId;
    playerContainer.querySelector('.volume-label').setAttribute('for', volumeId);
    playerContainer.querySelector('[data-player-volume-value]').setAttribute('for', volumeId);
    playerContainer.querySelector('audio').id = `audioPlayer-${name}`;
    playerContainer.querySelector('[data-station-name]').textContent = name;
    playerContainer.querySelector('[data-player-title]').textContent = `KAAOS.RADIO - ${name}`;
    playerTrack.appendChild(playerContainer);
    radioPlayers.set(name, new IcecastPlayer(playerContainer, {
        ...stations[name],
        statusUrl: 'https://stream.kaaosradio.fi:8001/status-json.xsl',
        beforePlay: setupAnalyser,
        // Removes the station prefix from the now-playing title.
        titleFormatter(title) {
            return title.replace(/Kaaosradio 24h (.*?) - /, '');
        }
    }));
    const audio = radioPlayers.get(name).audio;
    for (const event of ['playing', 'pause', 'waiting', 'ended', 'error', 'emptied']) {
        audio.addEventListener(event, updateStationPlayback.bind(null, name));
    }
}

// Marks the stream that is actually playing, independently of the selected panel.
function updateStationPlayback(name, event) {
    const audio = radioPlayers.get(name).audio;
    const playing = event.type === 'playing' && !audio.paused && !audio.ended && !audio.error;
    for (const button of stationButtons) {
        if (button.dataset.station === name) {
            button.setAttribute('data-playing', String(playing));
            button.setAttribute('aria-label', playing ? `${name} (playing)` : name);
        }
    }
}

// Slides the persistent panels without changing any station's playback.
function selectStation(name) {
    if (!radioPlayers.has(name)) {
        throw new Error(`Unknown station: ${name}`);
    }
    if (name === selectedStation) {
        return;
    }

    radioPlayer = radioPlayers.get(name);
    selectedStation = name;
    playerTrack.style.transform = `translateX(-${stationNames.indexOf(name) * 100}%)`;
    for (const [station, player] of radioPlayers) {
        const active = station === name;
        player.container.inert = !active;
        player.container.setAttribute('aria-hidden', String(!active));
    }
    for (const button of stationButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.station === name));
    }
}

// Selects the requested stream without starting playback.
function handleStationClick(event) {
    selectStation(event.currentTarget.dataset.station);
}

for (const button of stationButtons) {
    button.addEventListener('click', handleStationClick);
}

selectStation('247stream');
