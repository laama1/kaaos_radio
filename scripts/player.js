playPauseBtn.addEventListener('click', () => {
    // Starts or pauses the stream and synchronizes the visible play/pause icon.
    if (audio.paused) {
        setupAnalyser();
        if (audioContext) audioContext.resume();
        audio.play();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        audio.pause();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
});

const nowPlayingEndpoint = 'https://stream.kaaosradio.fi:8001/status-json.xsl';
const marqueeText = document.getElementById('marqueeText');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');

// Applies the selected volume to the audio stream and updates the control display.
function updateVolume() {
    const volume = Number(volumeSlider.value);
    audio.volume = volume / 100;
    volumeValue.textContent = `${volume}%`;
    volumeSlider.style.setProperty('--volume-level', `${volume}%`);
}

// Fetches the Icecast status and displays the stream2 title in the marquee.
async function updateNowPlaying() {
    console.log('Updating now-playing title...');
    try {
        const response = await fetch(nowPlayingEndpoint, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Icecast status request failed with HTTP ${response.status}`);
        }

        const status = await response.json();
        const rawSources = status.icestats?.source;
        const sources = Array.isArray(rawSources) ? rawSources : [rawSources];
        const stream = sources.find((source) => source?.listenurl?.includes('stream2'));

        if (!stream?.title) {
            throw new Error('The stream2 source or its title was not found');
        }

        marqueeText.textContent = stream.title;
        // regexp remove Kaaosradio 24h (.*) - from the title
        marqueeText.textContent = marqueeText.textContent.replace(/Kaaosradio 24h (.*?) - /, '');
    } catch (error) {
        console.error('Unable to update the now-playing title:', error);
    }
}

volumeSlider.addEventListener('input', updateVolume);
updateVolume();
updateNowPlaying();
setInterval(updateNowPlaying, 10000);
