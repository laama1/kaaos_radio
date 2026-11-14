class IcecastPlayer {
    // Binds one container's controls to an independently configured Icecast stream.
    constructor(container, {
        streamUrl,
        statusUrl = null,
        mount = null,
        titleFormatter = null,
        beforePlay = null
    }) {
        if (typeof streamUrl !== 'string' || !streamUrl.trim()) {
            throw new Error('IcecastPlayer requires a streamUrl');
        }
        const sourceUrl = new URL(streamUrl, document.baseURI);
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!this.container) {
            throw new Error('IcecastPlayer requires a player container');
        }

        this.audio = this.getControl('audio');
        this.playPauseBtn = this.getControl('[data-player-toggle]');
        this.playIcon = this.getControl('[data-player-play]');
        this.pauseIcon = this.getControl('[data-player-pause]');
        this.volumeSlider = this.getControl('[data-player-volume]');
        this.volumeValue = this.getControl('[data-player-volume-value]');
        this.marqueeText = this.getControl('[data-player-title]');
        this.statusUrl = statusUrl ? new URL(statusUrl, document.baseURI).href : null;
        this.mount = mount ?? sourceUrl.pathname;
        this.titleFormatter = titleFormatter;
        this.trackHistory = [];
        this.currentTrackTitle = null;
        this.beforePlay = beforePlay;
        this.destroyed = false;
        this.starting = false;
        this.playbackVersion = 0;
        this.statusRequest = null;
        this.listeners = new AbortController();
        this.audio.preload = 'none';
        this.audio.src = sourceUrl.href;

        this.playPauseBtn.addEventListener('click', this.togglePlayback.bind(this), {
            signal: this.listeners.signal
        });
        this.volumeSlider.addEventListener('input', this.updateVolume.bind(this), {
            signal: this.listeners.signal
        });
        for (const event of ['play', 'pause', 'ended', 'error']) {
            this.audio.addEventListener(event, this.updatePlaybackState.bind(this), {
                signal: this.listeners.signal
            });
        }
        this.audio.addEventListener('error', this.reportAudioError.bind(this), {
            signal: this.listeners.signal
        });
        this.updateVolume();
        this.updatePlaybackState();
        if (this.statusUrl) {
            this.updateNowPlaying();
            this.metadataTimer = setInterval(this.updateNowPlaying.bind(this), 10000);
        }
    }

    // Rejects incomplete markup rather than binding controls from another player.
    getControl(selector) {
        const control = this.container.querySelector(selector);
        if (!control) {
            throw new Error(`IcecastPlayer is missing control: ${selector}`);
        }
        return control;
    }

    // Starts playback after an optional visualizer hook, reporting rejected play requests.
    async togglePlayback() {
        if (this.destroyed || this.starting) {
            return;
        }
        if (!this.audio.paused) {
            this.stop();
            return;
        }

        this.starting = true;
        const playbackVersion = ++this.playbackVersion;
        try {
            this.audio.load();
            if (this.beforePlay) {
                await this.beforePlay(this.audio);
            }
            if (!this.destroyed && playbackVersion === this.playbackVersion) {
                await this.audio.play();
            }
        } catch (error) {
            if (playbackVersion === this.playbackVersion) {
                console.error('Unable to play the Icecast stream:', error);
            }
        } finally {
            if (!this.destroyed && playbackVersion === this.playbackVersion) {
                this.starting = false;
                this.updatePlaybackState();
            }
        }
    }

    // Discards buffered live audio without downloading more until playback is requested.
    stop() {
        this.playbackVersion += 1;
        this.starting = false;
        this.audio.pause();
        this.audio.load();
        this.updatePlaybackState();
    }

    // Reflects actual media state, including playback failures and external pauses.
    updatePlaybackState() {
        const playing = !this.audio.paused && !this.audio.ended && !this.audio.error;
        this.playIcon.style.display = playing ? 'none' : 'block';
        this.pauseIcon.style.display = playing ? 'block' : 'none';
        this.playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        this.playPauseBtn.setAttribute('aria-pressed', String(playing));
    }

    // Reports asynchronous network or media decoding failures.
    reportAudioError() {
        console.error('Icecast audio playback failed:', this.audio.error);
    }

    // Applies this player's volume without affecting other instances.
    updateVolume() {
        const volume = Number(this.volumeSlider.value);
        this.audio.volume = volume / 100;
        this.volumeValue.textContent = `${volume}%`;
        this.volumeSlider.style.setProperty('--volume-level', `${volume}%`);
    }

    // Selects an exact Icecast mount from either the single-source or array status format.
    async updateNowPlaying() {
        if (this.destroyed || this.statusRequest || !this.statusUrl) {
            return;
        }
        const request = new AbortController();
        this.statusRequest = request;
        try {
            const response = await fetch(this.statusUrl, {
                cache: 'no-store',
                signal: request.signal
            });
            if (!response.ok) {
                throw new Error(`Icecast status request failed with HTTP ${response.status}`);
            }
            const status = await response.json();
            const rawSources = status.icestats?.source;
            const sources = Array.isArray(rawSources) ? rawSources : [rawSources];
            // Compares paths so similarly named mounts cannot overwrite this player's title.
            const stream = sources.find((source) => source?.listenurl
                && new URL(source.listenurl, this.statusUrl).pathname === this.mount);
            if (!stream?.title) {
                throw new Error(`Icecast mount ${this.mount} or its title was not found`);
            }
            if (!this.destroyed) {
                const title = this.titleFormatter
                    ? this.titleFormatter(stream.title)
                    : stream.title;
                if (stream.title !== this.currentTrackTitle) {
                    this.trackHistory.push(title);
                    this.currentTrackTitle = stream.title;
                }
                this.marqueeText.textContent = title;
            }
        } catch (error) {
            if (!request.signal.aborted) {
                console.error('Unable to update the now-playing title:', error);
            }
        } finally {
            this.statusRequest = null;
        }
    }

    // Stops playback, polling, pending metadata requests, and this instance's event listeners.
    destroy() {
        this.destroyed = true;
        clearInterval(this.metadataTimer);
        this.statusRequest?.abort();
        this.listeners.abort();
        this.stop();
    }
}
