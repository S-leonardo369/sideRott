/**
 * VideoPlayer — Dual-video architecture with local clip buffer → YouTube stream handoff.
 *
 * Strategy (per spec §3.2):
 * 1. On play(), the local 4-second MP4 clip loads and plays INSTANTLY (zero latency).
 * 2. Simultaneously, the main process resolves a direct YouTube CDN stream URL via yt-dlp.
 * 3. The stream URL is loaded into a hidden second <video> element.
 * 4. When the stream fires 'canplay', we crossfade from the clip to the stream (400ms).
 * 5. If the stream fails or takes too long, the clip keeps looping (graceful degradation).
 */
class VideoPlayer {
  constructor() {
    this.clipEl = document.getElementById('video-player');      // Local 4s clip
    this.streamEl = document.getElementById('video-stream');    // YouTube stream
    this.fallbackCanvas = document.getElementById('video-fallback');
    this.container = document.getElementById('video-container');
    this.ctx = this.fallbackCanvas.getContext('2d');

    this.currentVideo = null;
    this.isPlaying = false;
    this.useFallback = false;
    this.streamActive = false;     // true once we've handed off to the stream
    this.streamLoading = false;    // true while stream is being resolved/buffered
    this.animationFrame = null;
    this.paths = null;

    this._resizeFallback();
    window.addEventListener('resize', () => this._resizeFallback());
  }

  async init() {
    this.paths = await window.brainrot.getPaths();
  }

  /**
   * Play a video: local clip instantly, stream loads in background.
   */
  async play(videoConfig) {
    if (!videoConfig) return;
    this.currentVideo = videoConfig;
    this.streamActive = false;
    this.streamLoading = false;

    this._stopFallbackAnimation();
    this._resetStream();

    // Build the local file path
    const clipPath = this.paths
      ? `file:///${this.paths.clips.replace(/\\/g, '/')}/${videoConfig.local_clip}`
      : null;

    if (clipPath) {
      try {
        await this._playClip(clipPath);
        // Clip is playing — now start loading the stream in the background
        this._loadStream(videoConfig);
        return;
      } catch (e) {
        console.warn(`Local clip failed for ${videoConfig.id}:`, e.message);
      }
    }

    // Fallback: animated gradient (clip missing), still try stream
    this._startFallbackAnimation(videoConfig);
    this._loadStream(videoConfig);
  }

  /**
   * Load and play the local 4-second clip.
   */
  _playClip(src) {
    return new Promise((resolve, reject) => {
      this.useFallback = false;
      this.container.classList.remove('use-fallback');
      this.clipEl.style.display = 'block';

      const cleanup = () => {
        this.clipEl.removeEventListener('canplaythrough', onReady);
        this.clipEl.removeEventListener('canplay', onReady);
        this.clipEl.removeEventListener('error', onError);
        clearTimeout(timeout);
      };

      const onReady = () => {
        cleanup();
        this.clipEl.play()
          .then(() => {
            this.isPlaying = true;
            resolve();
          })
          .catch((e) => {
            console.warn('Clip play promise rejected:', e.message);
            this.isPlaying = true;
            resolve();
          });
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Clip load error: ${this.clipEl.error?.message || 'unknown'}`));
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Clip load timeout'));
      }, 5000);

      this.clipEl.addEventListener('canplaythrough', onReady);
      this.clipEl.addEventListener('canplay', onReady);
      this.clipEl.addEventListener('error', onError);

      this.clipEl.muted = true;
      this.clipEl.loop = true;
      this.clipEl.playsInline = true;
      this.clipEl.src = src;
      this.clipEl.load();
    });
  }

  /**
   * Resolve and load the YouTube stream in the background.
   * When ready, crossfade from clip to stream.
   */
  async _loadStream(videoConfig) {
    if (!videoConfig.source_url) return;

    this.streamLoading = true;
    console.log(`[VideoPlayer] Resolving stream for ${videoConfig.id}...`);

    try {
      const result = await window.brainrot.resolveStream(videoConfig.source_url);

      if (result.error) {
        console.warn(`[VideoPlayer] Stream resolve error: ${result.error}`);
        this.streamLoading = false;
        return; // Keep looping the clip
      }

      // Guard: user may have switched videos while we were resolving
      if (this.currentVideo?.id !== videoConfig.id) {
        console.log('[VideoPlayer] Video changed during stream resolution, discarding');
        this.streamLoading = false;
        return;
      }

      console.log(`[VideoPlayer] Got stream URL (${result.format}, cached=${result.cached})`);

      await this._bufferStream(result.url, videoConfig);

    } catch (e) {
      console.warn(`[VideoPlayer] Stream load failed:`, e.message);
      this.streamLoading = false;
      // Clip keeps looping — graceful degradation
    }
  }

  /**
   * Load the direct CDN URL into the stream element and wait for it to buffer.
   */
  _bufferStream(url, videoConfig) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.streamEl.removeEventListener('canplay', onReady);
        this.streamEl.removeEventListener('error', onError);
        clearTimeout(timeout);
      };

      const onReady = () => {
        cleanup();

        // Final guard: make sure we're still on the same video
        if (this.currentVideo?.id !== videoConfig.id) {
          this.streamLoading = false;
          resolve();
          return;
        }

        console.log(`[VideoPlayer] Stream buffered, handing off from clip`);
        this._handoffToStream();
        resolve();
      };

      const onError = () => {
        cleanup();
        this.streamLoading = false;
        console.warn(`[VideoPlayer] Stream element error: ${this.streamEl.error?.message}`);
        reject(new Error('Stream element load error'));
      };

      // 30 second timeout for stream buffering
      const timeout = setTimeout(() => {
        cleanup();
        this.streamLoading = false;
        console.warn('[VideoPlayer] Stream buffer timeout (30s)');
        reject(new Error('Stream buffer timeout'));
      }, 30000);

      this.streamEl.addEventListener('canplay', onReady);
      this.streamEl.addEventListener('error', onError);

      this.streamEl.muted = true;
      this.streamEl.loop = true;
      this.streamEl.playsInline = true;

      // Set the start time if specified
      if (videoConfig.start_time > 0) {
        this.streamEl.addEventListener('loadedmetadata', () => {
          this.streamEl.currentTime = videoConfig.start_time;
        }, { once: true });
      }

      this.streamEl.src = url;
      this.streamEl.load();
    });
  }

  /**
   * Crossfade from the local clip to the live stream.
   */
  _handoffToStream() {
    // Listen for stream ending — CDN URLs often can't use native loop,
    // so we manually restart playback from the beginning.
    this.streamEl.addEventListener('ended', () => {
      console.log('[VideoPlayer] Stream ended, restarting loop');
      this.streamEl.currentTime = 0;
      this.streamEl.play().catch(() => {});
    });

    // Start stream playback
    this.streamEl.play().then(() => {
      // Crossfade: show stream on top of clip
      this.streamEl.classList.add('active');

      // After the CSS transition completes, pause the clip to free resources
      setTimeout(() => {
        this.clipEl.pause();
        this.streamActive = true;
        this.streamLoading = false;
        console.log('[VideoPlayer] Handoff complete — streaming live');
      }, 500); // slightly longer than the 400ms CSS transition
    }).catch((e) => {
      console.warn('[VideoPlayer] Stream play failed:', e.message);
      this.streamLoading = false;
    });
  }

  /**
   * Reset the stream element to a clean state.
   */
  _resetStream() {
    this.streamEl.classList.remove('active');
    this.streamEl.pause();
    // Remove all event listeners by cloning (prevents stale 'ended' handlers)
    const newStream = this.streamEl.cloneNode(false);
    this.streamEl.parentNode.replaceChild(newStream, this.streamEl);
    this.streamEl = newStream;
    this.streamEl.removeAttribute('src');
    this.streamActive = false;
    this.streamLoading = false;
  }

  pause() {
    if (this.useFallback) {
      this._stopFallbackAnimation();
    } else if (this.streamActive) {
      this.streamEl.pause();
    } else {
      this.clipEl.pause();
    }
    this.isPlaying = false;
  }

  resume() {
    if (!this.currentVideo) return;
    if (this.useFallback) {
      this._startFallbackAnimation(this.currentVideo);
    } else if (this.streamActive) {
      this.streamEl.play().catch(() => {});
    } else {
      this.clipEl.play().catch(() => {});
    }
    this.isPlaying = true;
  }

  /**
   * Crossfade to a new video (200ms opacity transition).
   */
  async switchTo(videoConfig) {
    this.container.style.transition = 'opacity 200ms ease';
    this.container.style.opacity = '0';

    await new Promise(r => setTimeout(r, 200));

    this._resetStream();
    await this.play(videoConfig);

    this.container.style.opacity = '1';
  }

  // ── Gradient Fallback ──

  _startFallbackAnimation(videoConfig) {
    this.useFallback = true;
    this.container.classList.add('use-fallback');
    this.clipEl.pause();
    this.clipEl.removeAttribute('src');
    this.clipEl.style.display = 'none';

    const startColor = videoConfig.gradientStart || '#1a1a2e';
    const endColor = videoConfig.gradientEnd || '#e94560';
    let time = 0;

    const animate = () => {
      time += 0.008;
      const w = this.fallbackCanvas.width;
      const h = this.fallbackCanvas.height;

      const gradient = this.ctx.createLinearGradient(
        w * 0.5 + Math.sin(time) * w * 0.3, 0,
        w * 0.5 + Math.cos(time * 0.7) * w * 0.3, h
      );
      gradient.addColorStop(0, startColor);
      gradient.addColorStop(0.5, endColor);
      gradient.addColorStop(1, startColor);
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5; i++) {
        const x = w * (0.2 + 0.6 * Math.sin(time * (0.3 + i * 0.1) + i * 1.5));
        const y = h * (0.2 + 0.6 * Math.cos(time * (0.2 + i * 0.15) + i * 2));
        const radius = 40 + 30 * Math.sin(time * 0.5 + i);
        const orbGrad = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        orbGrad.addColorStop(0, `${endColor}66`);
        orbGrad.addColorStop(1, `${startColor}00`);
        this.ctx.fillStyle = orbGrad;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.isPlaying = true;
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  _stopFallbackAnimation() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.useFallback = false;
  }

  _resizeFallback() {
    this.fallbackCanvas.width = window.innerWidth * devicePixelRatio;
    this.fallbackCanvas.height = window.innerHeight * devicePixelRatio;
  }

  getCurrentVideo() {
    return this.currentVideo;
  }
}
