const constellation = document.getElementById('constellation');
const canvasContext = constellation.getContext('2d');
const particles = [];
const MINIMUM_CONNECTION_DISTANCE = 250;
const MINIMUM_PARTICLE_COUNT = 20;
let analyser;
let frequencyData;
let audioContext;
const audioSources = new WeakMap();
let activeAudioSource;
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
    const particleCount = Math.min(MINIMUM_PARTICLE_COUNT, Math.max(28, Math.floor(window.innerWidth / 24)));

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
async function setupAnalyser(audio) {
    try {
        if (!analyser) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            analyser.connect(audioContext.destination);
            frequencyData = new Uint8Array(analyser.frequencyBinCount);
        }
        let source = audioSources.get(audio);
        if (!source) {
            source = audioContext.createMediaElementSource(audio);
            audioSources.set(audio, source);
        }
        if (activeAudioSource !== source) {
            activeAudioSource?.disconnect();
            source.connect(analyser);
            activeAudioSource = source;
        }
        await audioContext.resume();
    } catch (error) {
        console.error('Unable to initialize the constellation audio analyser:', error);
    }
}

// Draws a black recess with a shadowed upper edge and a subtle lower inner rim.
function drawParticleHole(particle, radius) {
    const shading = canvasContext.createRadialGradient(
        particle.x - radius * 0.25,
        particle.y - radius * 0.35,
        radius * 0.2,
        particle.x,
        particle.y,
        radius
    );
    shading.addColorStop(0, '#000000');
    shading.addColorStop(0.65, '#000000');
    //shading.addColorStop(0.85, '#030608');
    shading.addColorStop(0.85, '#37424b');
    shading.addColorStop(1, '#152129');

    canvasContext.fillStyle = '#000000';
    canvasContext.beginPath();
    canvasContext.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.save();
    canvasContext.clip();
    canvasContext.fillStyle = shading;
    canvasContext.fillRect(particle.x - radius, particle.y - radius, radius * 2, radius * 2);
    canvasContext.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    canvasContext.lineWidth = Math.max(0.3, radius * 0.15);
    canvasContext.shadowColor = '#000000';
    canvasContext.shadowBlur = radius * 0.35;
    canvasContext.shadowOffsetY = radius * 0.2;
    canvasContext.stroke();
    canvasContext.restore();
}

// Covers intersecting regions after shading so neither hole's inner rim crosses the overlap.
function drawHoleOverlaps(holes) {
    canvasContext.fillStyle = '#000000';
    for (let index = 0; index < holes.length; index += 1) {
        const hole = holes[index];
        for (let otherIndex = index + 1; otherIndex < holes.length; otherIndex += 1) {
            const other = holes[otherIndex];
            const distance = Math.hypot(hole.x - other.x, hole.y - other.y);
            if (distance >= hole.radius + other.radius) {
                continue;
            }

            canvasContext.save();
            canvasContext.beginPath();
            canvasContext.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2);
            canvasContext.clip();
            canvasContext.beginPath();
            canvasContext.arc(other.x, other.y, other.radius, 0, Math.PI * 2);
            canvasContext.fill();
            canvasContext.restore();
        }
    }
}

// Updates the constellation animation using audio levels to change movement and size.
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

    // Draws connections first so they cannot cross over the black particle holes.
    particles.forEach((particle, index) => {
        particles.slice(index + 1).forEach((otherParticle) => {
            const distanceX = particle.x - otherParticle.x;
            const distanceY = particle.y - otherParticle.y;
            const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
            const connectionDistance = MINIMUM_CONNECTION_DISTANCE + audioLevel * 35;

            if (distance < connectionDistance) {
                canvasContext.strokeStyle = '#000000';
                canvasContext.lineWidth = 1;
                canvasContext.beginPath();
                canvasContext.moveTo(particle.x, particle.y);
                canvasContext.lineTo(otherParticle.x, otherParticle.y);
                canvasContext.stroke();
            }
        });
    });

    // Uses the overall level and a frequency band to make each particle pulse independently.
    const holes = particles.map((particle, index) => {
        const frequencyLevel = analyser
            ? frequencyData[index % frequencyData.length] / 255
            : 0;
        const radius = particle.size * 2 * (1 + audioLevel * 4 + frequencyLevel * 8);
        return { x: particle.x, y: particle.y, radius };
    });
    for (const hole of holes) {
        drawParticleHole(hole, hole.radius);
    }
    drawHoleOverlaps(holes);

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
