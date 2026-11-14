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
}

// Slides the persistent panels in station order and stops the outgoing live stream.
function selectStation(name) {
    if (!radioPlayers.has(name)) {
        throw new Error(`Unknown station: ${name}`);
    }
    if (name === selectedStation) {
        return;
    }

    radioPlayer?.stop();
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
