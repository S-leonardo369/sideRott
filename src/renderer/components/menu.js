/**
 * Menu — Video selection panel with liquid glass aesthetic.
 */
class VideoMenu {
  constructor() {
    this.overlay = document.getElementById('menu-overlay');
    this.container = document.getElementById('menu-container');
    this.grid = document.getElementById('menu-grid');

    this.isOpen = false;
    this.selectedVideoId = null;
    this.videoLibrary = [];
    this.paths = null;

    this._onVideoSelect = null;
  }

  async init(videoLibrary, selectedVideoId) {
    this.videoLibrary = videoLibrary;
    this.selectedVideoId = selectedVideoId;
    this.paths = await window.brainrot.getPaths();
    this._render();
  }

  _render() {
    this.grid.innerHTML = '';

    this.videoLibrary.forEach(video => {
      const card = document.createElement('div');
      card.className = 'thumbnail-card';
      if (video.id === this.selectedVideoId) {
        card.classList.add('selected');
      }
      card.dataset.videoId = video.id;

      // Try to load thumbnail image, fall back to gradient
      const thumbnailPath = this.paths
        ? `file:///${this.paths.thumbnails.replace(/\\/g, '/')}/${video.thumbnail}`
        : null;

      const img = document.createElement('img');
      img.className = 'thumbnail-img';
      img.alt = video.title;
      img.loading = 'lazy';

      if (thumbnailPath) {
        img.src = thumbnailPath;
        img.onerror = () => {
          // Try .svg fallback (placeholder thumbnails are SVG)
          const svgPath = thumbnailPath.replace(/\.jpg$/, '.svg');
          img.onerror = () => {
            // Final fallback: gradient
            img.style.display = 'none';
            const gradient = document.createElement('div');
            gradient.className = 'thumbnail-gradient';
            gradient.style.background = `linear-gradient(135deg, ${video.gradientStart} 0%, ${video.gradientEnd} 100%)`;
            card.insertBefore(gradient, card.firstChild);
          };
          img.src = svgPath;
        };
      } else {
        img.style.display = 'none';
        const gradient = document.createElement('div');
        gradient.className = 'thumbnail-gradient';
        gradient.style.background = `linear-gradient(135deg, ${video.gradientStart} 0%, ${video.gradientEnd} 100%)`;
        card.appendChild(gradient);
      }

      card.appendChild(img);

      // Title
      const title = document.createElement('div');
      title.className = 'thumbnail-title';
      title.textContent = video.title;
      card.appendChild(title);

      // Now playing badge (only for selected)
      if (video.id === this.selectedVideoId) {
        const badge = document.createElement('div');
        badge.className = 'now-playing-badge';
        badge.textContent = 'NOW';
        card.appendChild(badge);
      }

      // Click handler
      card.addEventListener('click', () => this._selectVideo(video));

      this.grid.appendChild(card);
    });
  }

  _selectVideo(video) {
    if (video.id === this.selectedVideoId) {
      // Already playing — just close menu
      this.close();
      return;
    }

    // Brief scale-up animation on the clicked card
    const card = this.grid.querySelector(`[data-video-id="${video.id}"]`);
    if (card) {
      card.style.transform = 'scale(1.08)';
      setTimeout(() => {
        card.style.transform = '';
      }, 100);
    }

    this.selectedVideoId = video.id;

    // Close menu after brief delay for visual feedback
    setTimeout(() => {
      this.close();
      if (this._onVideoSelect) {
        this._onVideoSelect(video);
      }
    }, 150);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._render(); // Re-render to update selected state
    this.overlay.classList.add('open');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.overlay.classList.remove('open');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
    return this.isOpen;
  }

  onVideoSelect(callback) {
    this._onVideoSelect = callback;
  }

  updateSelected(videoId) {
    this.selectedVideoId = videoId;
    if (this.isOpen) {
      this._render();
    }
  }
}
