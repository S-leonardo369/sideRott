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

const DEFAULT_CONFIG = {
  hotkey: 'CommandOrControl+Shift+B',
  fallbackHotkey: 'CommandOrControl+Alt+B',
  launchOnStartup: true,
  videoQuality: '1080p',
  overlayPosition: 'right',
  overlayWidth: 25,
  selectedVideoId: 'minecraft-parkour-01',
  reducedMotion: false
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VIDEO_LIBRARY, DEFAULT_CONFIG };
}
