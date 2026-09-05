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

audio.addEventListener('play', () => {
    // Shows the pause icon whenever playback starts, including external playback changes.
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
});
audio.addEventListener('pause', () => {
    // Shows the play icon whenever playback stops or is paused.
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
});