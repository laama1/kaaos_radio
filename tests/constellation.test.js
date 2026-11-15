const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

// Loads rendering helpers without starting the animation or requiring a browser.
function collisionFixture(enabled = true) {
    const source = readFileSync(require.resolve('../scripts/constellation.js'), 'utf8')
        .replace('const PARTICLE_COLLISION_ENABLED = true;', `const PARTICLE_COLLISION_ENABLED = ${enabled};`);
    const context = vm.createContext({
        document: {
            // Supplies the canvas context captured by the script's declarations.
            getElementById() {
                return {
                    // Rendering is not needed for collision tests.
                    getContext() {
                        return {};
                    }
                };
            }
        }
    });
    vm.runInContext(source.slice(0, source.lastIndexOf('\nresizeConstellation();')), context);
    return context;
}

// Confirms starting another station keeps prior sources audible without duplicate connections.
test('audio analyser retains and reuses sources for simultaneous streams', async () => {
    const context = collisionFixture();
    const sources = [];
    const analyser = {
        frequencyBinCount: 64,
        // Records the single shared output connection.
        connect(destination) {
            this.destination = destination;
        }
    };
    context.window = {
        AudioContext: class {
            // Provides a fake destination for the shared analyser.
            constructor() {
                this.destination = {};
            }

            // Returns the shared frequency analyser.
            createAnalyser() {
                return analyser;
            }

            // Tracks connections without touching real audio hardware.
            createMediaElementSource(audio) {
                const source = {
                    audio,
                    connections: [],
                    // Records every connection to detect duplicate routing.
                    connect(target) {
                        this.connections.push(target);
                    },
                    // Fails if switching disconnects a stream.
                    disconnect() {
                        assert.fail('Existing audio source must remain connected');
                    }
                };
                sources.push(source);
                return source;
            }

            // Simulates a resumed audio context.
            async resume() {}
        }
    };
    const first = {};
    const second = {};
    await context.setupAnalyser(first);
    await context.setupAnalyser(second);
    await context.setupAnalyser(first);
    assert.equal(sources.length, 2);
    for (const source of sources) {
        assert.deepEqual(source.connections, [analyser]);
    }
});

// Verifies the default scale doubles both velocity components without changing direction.
test('PARTICLE_SPEED doubles initial particle velocities', () => {
    const context = collisionFixture();
    context.window = { innerWidth: 800, innerHeight: 600 };
    vm.runInContext('Math.random = () => 0.75; createParticles();', context);
    const velocities = vm.runInContext('particles.map(p => [p.velocityX, p.velocityY])', context);
    assert.ok(velocities.length > 0);
    for (const [x, y] of velocities) {
        assert.equal(x, (0.75 - 0.5) * 0.24 * 2);
        assert.equal(y, (0.75 - 0.5) * 0.24 * 2);
    }
});

// Checks strict center-distance thresholds, diagonal collisions, and coincident centers.
test('collisions under 20 pixels produce perpendicular outward velocities at original speeds', () => {
    const context = collisionFixture();
    for (const [x, y] of [[19.99, 0], [8, 10], [0, 0]]) {
        const pair = [
            { x: 0, y: 0, velocityX: 0.12, velocityY: 0.05 },
            { x, y, velocityX: -0.06, velocityY: -0.02 }
        ];
        const speeds = pair.map(function speed(particle) {
            // Captures the original magnitude for preservation checks.
            return Math.hypot(particle.velocityX, particle.velocityY);
        });
        context.resolveParticleCollisions(pair);
        const [first, second] = pair;
        assert.ok(Math.abs(Math.hypot(second.x - first.x, second.y - first.y) - 20) < 1e-10);
        assert.ok(Math.abs(first.velocityX * second.velocityX + first.velocityY * second.velocityY) < 1e-10);
        for (let index = 0; index < pair.length; index += 1) {
            assert.ok(Math.abs(Math.hypot(pair[index].velocityX, pair[index].velocityY) - speeds[index]) < 1e-10);
        }
        assert.ok((second.x - first.x) * (second.velocityX - first.velocityX)
            + (second.y - first.y) * (second.velocityY - first.velocityY) > 0);
        const velocities = pair.map(function velocity(particle) {
            // Records the collision response before the next animation step.
            return [particle.velocityX, particle.velocityY];
        });
        for (const particle of pair) {
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
        }
        context.resolveParticleCollisions(pair);
        assert.deepEqual(pair.map(function velocity(particle) {
            // Confirms departing particles do not turn again.
            return [particle.velocityX, particle.velocityY];
        }), velocities);
    }
});

// Ensures particles at or beyond the threshold keep their original motion.
test('centers 20 pixels or farther apart do not collide', () => {
    const context = collisionFixture();
    for (const distance of [20, 20.01, 100]) {
        const pair = [
            { x: 0, y: 0, velocityX: 0.1, velocityY: 0.03 },
            { x: distance, y: 0, velocityX: -0.1, velocityY: 0.02 }
        ];
        const before = structuredClone(pair);
        context.resolveParticleCollisions(pair);
        assert.deepEqual(pair, before);
    }
});

// Confirms the existing feature flag disables both separation and direction changes.
test('collision flag disables the response', () => {
    const context = collisionFixture(false);
    const pair = [
        { x: 0, y: 0, velocityX: 0.1, velocityY: 0 },
        { x: 5, y: 0, velocityX: -0.1, velocityY: 0 }
    ];
    const before = structuredClone(pair);
    context.resolveParticleCollisions(pair);
    assert.deepEqual(pair, before);
});
