/**
 * Controls — Manages the hover-reveal system for close & menu buttons.
 */
class Controls {
  constructor() {
    this.closeBtn = document.getElementById('close-btn');
    this.menuBtn = document.getElementById('menu-btn');
    this.body = document.body;

    this._hoverTimeout = null;
    this._isMenuOpen = false;

    this._bindEvents();
  }

  _bindEvents() {
    // Hover reveal system: show controls when mouse enters window
    document.addEventListener('mouseenter', () => this._onMouseEnter());
    document.addEventListener('mouseleave', () => this._onMouseLeave());

    // Also track mouse movement to handle the 150ms delay
    document.addEventListener('mousemove', () => {
      if (!this.body.classList.contains('controls-visible') && !this._hoverTimeout) {
        this._onMouseEnter();
      }
    });

    // Close button
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.brainrot.closeOverlay();
    });

    // Menu button
    this.menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._onMenuToggle) {
        this._onMenuToggle();
      }
    });
  }

  _onMouseEnter() {
    if (this._hoverTimeout) return;
    this._hoverTimeout = setTimeout(() => {
      this.body.classList.add('controls-visible');
    }, 150);
  }

  _onMouseLeave() {
    if (this._hoverTimeout) {
      clearTimeout(this._hoverTimeout);
      this._hoverTimeout = null;
    }
    // Don't hide controls if menu is open
    if (!this._isMenuOpen) {
      this.body.classList.remove('controls-visible');
    }
  }

  setMenuOpen(isOpen) {
    this._isMenuOpen = isOpen;
    const gridIcon = document.getElementById('menu-icon-grid');
    const closeIcon = document.getElementById('menu-icon-close');

    if (isOpen) {
      gridIcon.classList.remove('active');
      closeIcon.classList.add('active');
    } else {
      closeIcon.classList.remove('active');
      gridIcon.classList.add('active');
    }
  }

  onMenuToggle(callback) {
    this._onMenuToggle = callback;
  }
}
