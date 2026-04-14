/**
 * App — Main orchestrator for the BrainRot overlay renderer.
 * Wires together VideoPlayer, Controls, and VideoMenu.
 */

const VIDEO_LIBRARY = [
  {
    id: 'minecraft-parkour-01',
    title: 'Minecraft Parkour',
    thumbnail: 'minecraft-parkour-01.jpg',
    local_clip: 'minecraft-parkour-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=u7kdVe8q5zs',
    start_time: 0,
    clip_duration: 4,
    category: 'Gaming',
    color: '#4CAF50',
    gradientStart: '#1b5e20',
    gradientEnd: '#4CAF50'
  },
  {
    id: 'subway-surfers-01',
    title: 'Subway Surfers',
    thumbnail: 'subway-surfers-01.jpg',
    local_clip: 'subway-surfers-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=RNaEo6Zooww',
    start_time: 0,
    clip_duration: 4,
    category: 'Gaming',
    color: '#FF9800',
    gradientStart: '#e65100',
    gradientEnd: '#FF9800'
  },
  {
    id: 'satisfying-slime-01',
    title: 'Satisfying Slime',
    thumbnail: 'satisfying-slime-01.jpg',
    local_clip: 'satisfying-slime-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=lcPTDc9vHkE',
    start_time: 0,
    clip_duration: 4,
    category: 'Satisfying',
    color: '#E91E63',
    gradientStart: '#880e4f',
    gradientEnd: '#E91E63'
  },
  {
    id: 'gta-chaos-01',
    title: 'GTA Chaos',
    thumbnail: 'gta-chaos-01.jpg',
    local_clip: 'gta-chaos-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=weAUrmRLpnk',
    start_time: 0,
    clip_duration: 4,
    category: 'Gaming',
    color: '#F44336',
    gradientStart: '#b71c1c',
    gradientEnd: '#F44336'
  },
  {
    id: 'geometry-dash-01',
    title: 'Geometry Dash',
    thumbnail: 'geometry-dash-01.jpg',
    local_clip: 'geometry-dash-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=XkyPlrqWumg',
    start_time: 10,
    clip_duration: 4,
    category: 'Gaming',
    color: '#2196F3',
    gradientStart: '#0d47a1',
    gradientEnd: '#2196F3'
  },
  {
    id: 'cooking-asmr-01',
    title: 'Cooking',
    thumbnail: 'cooking-asmr-01.jpg',
    local_clip: 'cooking-asmr-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=594j3Mk4gRQ',
    start_time: 0,
    clip_duration: 4,
    category: 'Relaxing',
    color: '#FF5722',
    gradientStart: '#bf360c',
    gradientEnd: '#FF5722'
  },
  {
    id: 'nature-timelapse-01',
    title: 'Nature Timelapse',
    thumbnail: 'nature-timelapse-01.jpg',
    local_clip: 'nature-timelapse-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=DbpodPjq68s',
    start_time: 0,
    clip_duration: 4,
    category: 'Relaxing',
    color: '#009688',
    gradientStart: '#004d40',
    gradientEnd: '#009688'
  },
  {
    id: 'abstract-art-01',
    title: 'Abstract Art',
    thumbnail: 'abstract-art-01.jpg',
    local_clip: 'abstract-art-01.mp4',
    source_url: 'https://www.youtube.com/watch?v=wjQq0nSGS28',
    start_time: 0,
    clip_duration: 4,
    category: 'Abstract',
    color: '#9C27B0',
    gradientStart: '#4a148c',
    gradientEnd: '#9C27B0'
  }
];

(async function main() {
  // Initialize components
  const player = new VideoPlayer();
  const controls = new Controls();
  const menu = new VideoMenu();

  await player.init();

  // Load config
  let config = await window.brainrot.getConfig();
  const selectedId = config.selectedVideoId || VIDEO_LIBRARY[0].id;
  const selectedVideo = VIDEO_LIBRARY.find(v => v.id === selectedId) || VIDEO_LIBRARY[0];

  // Initialize menu with video library
  await menu.init(VIDEO_LIBRARY, selectedVideo.id);

  // Wire up menu toggle
  controls.onMenuToggle(() => {
    const isOpen = menu.toggle();
    controls.setMenuOpen(isOpen);
  });

  // Wire up video selection from menu
  menu.onVideoSelect(async (video) => {
    controls.setMenuOpen(false);
    await player.switchTo(video);
    menu.updateSelected(video.id);

    // Persist selection
    window.brainrot.setConfig({ selectedVideoId: video.id });
  });

  // ── Overlay lifecycle events from main process ──

  window.brainrot.onPreShow(() => {
    // Start playback slightly before the slide-in animation
    // so the first visible frame is never black
    player.resume();
  });

  window.brainrot.onShown(() => {
    // Overlay is fully visible
  });

  window.brainrot.onPreHide(() => {
    // Close menu if open
    if (menu.isOpen) {
      menu.close();
      controls.setMenuOpen(false);
    }
  });

  window.brainrot.onHidden(() => {
    // Pause playback to free resources
    player.pause();
  });

  window.brainrot.onConfigUpdated((newConfig) => {
    config = newConfig;
  });

  // ── Initial play ──
  // Load and start the local clip, then immediately pause.
  // The video is decoded and ready — on hotkey press, resume() is instant.
  await player.play(selectedVideo);
  player.pause();
})();
