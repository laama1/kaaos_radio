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
        baseX: 0,
        x: 0,
        y: 0,
        verticalDirection: -1,
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
    balloon.baseX = Math.random() * window.innerWidth;
    balloon.x = balloon.baseX;
    balloon.y = window.innerHeight + 150 + Math.random() * window.innerHeight;
    balloon.verticalDirection = -1;
    balloon.time = Math.random() * 1000;
}

// Creates all BALLOON_COUNT luftballoons and adds them to the page.
function createBalloons() {
    for (let index = 0; index < BALLOON_COUNT; index += 1) {
        balloons.push(createBalloon());
    }
}

// Animates every balloon vertically while swaying side to side like it's floating in the wind.
function animateBalloons() {
    balloons.forEach((balloon) => {
        balloon.time += 0.01;

        // Moves in the balloon's current vertical direction while swaying horizontally.
        balloon.y += balloon.speed * balloon.verticalDirection;
        const sway = Math.sin(balloon.time * balloon.swaySpeed) * balloon.swayAmount;
        balloon.x = Math.min(Math.max(balloon.baseX + sway, 0), window.innerWidth);
        balloon.angle = Math.sin(balloon.time * balloon.swaySpeed * 0.8) * 6;

        balloon.element.style.transform =
            `translate(${balloon.x}px, ${balloon.y}px) rotate(${balloon.angle}deg)`;

        if (balloon.y <= 0) {
            balloon.y = 0;
            balloon.verticalDirection = 1;
        } else if (balloon.y > window.innerHeight + 300) {
            resetBalloon(balloon);
        }
    });

    requestAnimationFrame(animateBalloons);
}

createBalloons();
animateBalloons();

// Keeps balloons' base positions within the new viewport bounds after a resize or orientation change.
window.addEventListener('resize', () => {
    balloons.forEach((balloon) => {
        balloon.baseX = Math.min(balloon.baseX, window.innerWidth);
    });
});