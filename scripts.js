const audio = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const constellation = document.getElementById('constellation');
const canvasContext = constellation.getContext('2d');
const particles = [];
let analyser;
let frequencyData;
let audioContext;
let animationFrame;

// Matches the canvas resolution to the viewport and accounts for high-density screens.
function resizeConstellation() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    constellation.width = window.innerWidth * pixelRatio;
    constellation.height = window.innerHeight * pixelRatio;
    constellation.style.width = `${window.innerWidth}px`;
    constellation.style.height = `${window.innerHeight}px`;
    canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

// Creates the moving dots and gives each one a random position, speed, and size.
function createParticles() {
    particles.length = 0;
    const particleCount = Math.min(60, Math.max(28, Math.floor(window.innerWidth / 24)));

    for (let index = 0; index < particleCount; index += 1) {
        particles.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            velocityX: (Math.random() - 0.5) * 0.24,
            velocityY: (Math.random() - 0.5) * 0.24,
            size: Math.random() * 1.5 + 1
        });
    }
}

// Connects the audio element to the Web Audio analyser so frequency data can be read.
function setupAnalyser() {
    if (analyser) {
        return;
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
        analyser = null;
    }
}

// Updates the constellation animation using audio levels to change movement and brightness.
function drawConstellation() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let audioLevel = 0;

    if (analyser) {
        analyser.getByteFrequencyData(frequencyData);
        audioLevel = frequencyData.reduce((total, value) => total + value, 0)
            / frequencyData.length / 255;
    }

    canvasContext.clearRect(0, 0, width, height);
    // Moves each particle and wraps it around the viewport edges.
    particles.forEach((particle) => {
        particle.x += particle.velocityX * (1 + audioLevel * 2);
        particle.y += particle.velocityY * (1 + audioLevel * 2);

        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;
    });

    // Draws lines between nearby particles and renders each particle as a glowing dot.
    particles.forEach((particle, index) => {
        particles.slice(index + 1).forEach((otherParticle) => {
            const distanceX = particle.x - otherParticle.x;
            const distanceY = particle.y - otherParticle.y;
            const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
            const connectionDistance = 150 + audioLevel * 35;

            if (distance < connectionDistance) {
                const opacity = (1 - distance / connectionDistance) * (0.18 + audioLevel * 0.45);
                canvasContext.strokeStyle = `rgba(85, 217, 255, ${opacity})`;
                canvasContext.lineWidth = 1;
                canvasContext.beginPath();
                canvasContext.moveTo(particle.x, particle.y);
                canvasContext.lineTo(otherParticle.x, otherParticle.y);
                canvasContext.stroke();
            }
        });

        const radius = particle.size + audioLevel * 3;
        canvasContext.fillStyle = `rgba(114, 230, 255, ${0.35 + audioLevel * 0.55})`;
        canvasContext.beginPath();
        canvasContext.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        canvasContext.fill();
    });

    animationFrame = requestAnimationFrame(drawConstellation);
}

resizeConstellation();
createParticles();
drawConstellation();
window.addEventListener('resize', () => {
    // Rebuilds the canvas and particle positions after the viewport changes size.
    resizeConstellation();
    createParticles();
});

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