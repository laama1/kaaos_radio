const BALLOON_COUNT = 12;
const balloonsContainer = document.getElementById('balloons');
const balloons = [];

// Builds a single balloon's DOM element and its randomized motion state.
function createBalloon() {
    const image = document.createElement('img');
    image.className = 'balloon';
    image.src = 'images/luftballoon_edit.svg';
    image.alt = '';
    image.style.width = `${40 + Math.random() * 90}px`;
    balloonsContainer.appendChild(image);

    const balloon = {
        element: image,
        x: 0,
        y: 0,
        angle: 0,
        time: Math.random() * 1000,
        speed: 0.15 + Math.random() * 0.35,
        swayAmount: 20 + Math.random() * 60,
        swaySpeed: 0.3 + Math.random() * 0.7
    };
    resetBalloon(balloon);
    return balloon;
}

// Picks a fresh random starting position along the bottom of the viewport for a balloon.
function resetBalloon(balloon) {
    balloon.x = Math.random() * window.innerWidth;
    balloon.y = window.innerHeight + 150 + Math.random() * window.innerHeight;
    balloon.time = Math.random() * 1000;
}

// Creates all 99 luftballoons and adds them to the page.
function createBalloons() {
    for (let index = 0; index < BALLOON_COUNT; index += 1) {
        balloons.push(createBalloon());
    }
}

// Animates every balloon drifting upward and swaying side to side like it's floating in the wind.
function animateBalloons() {
    balloons.forEach((balloon) => {
        balloon.time += 0.01;

        // Slowly rises while swaying horizontally using a sine wave.
        balloon.y -= balloon.speed;
        balloon.x += Math.sin(balloon.time * balloon.swaySpeed) * (balloon.swayAmount * 0.02);
        balloon.angle = Math.sin(balloon.time * balloon.swaySpeed * 0.8) * 6;

        balloon.element.style.transform =
            `translate(${balloon.x}px, ${balloon.y}px) rotate(${balloon.angle}deg)`;

        // Resets the balloon back below the viewport once it has floated off the top of the screen.
        if (balloon.y < -300) {
            resetBalloon(balloon);
        }
    });

    requestAnimationFrame(animateBalloons);
}

createBalloons();
animateBalloons();