const stations = {
    live: { streamUrl: 'https://kaaos.radio/stream', mount: '/stream' },
    '247stream': { streamUrl: 'https://kaaos.radio/stream2', mount: '/stream2' },
    chip: { streamUrl: 'https://kaaos.radio/chip', mount: '/chip' },
    chillout: { streamUrl: 'https://kaaos.radio/chill', mount: '/chill' }
};
const stationButtons = document.querySelectorAll('[data-station]');
const playerContainer = document.getElementById('radioPlayer');
let radioPlayer;
let selectedStation;

// Replaces the player on the same audio element to preserve its Web Audio connection.
function selectStation(name) {
    if (!Object.hasOwn(stations, name)) {
        throw new Error(`Unknown station: ${name}`);
    }
    if (name === selectedStation) {
        return;
    }

    radioPlayer?.destroy();
    playerContainer.querySelector('[data-station-name]').textContent = name;
    playerContainer.querySelector('[data-player-title]').textContent = `KAAOS.RADIO - ${name}`;
    radioPlayer = new IcecastPlayer(playerContainer, {
        ...stations[name],
        statusUrl: 'https://stream.kaaosradio.fi:8001/status-json.xsl',
        beforePlay: setupAnalyser,
        // Removes the station prefix from the now-playing title.
        titleFormatter(title) {
            return title.replace(/Kaaosradio 24h (.*?) - /, '');
        }
    });
    selectedStation = name;
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
