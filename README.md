# sideRott

**BrainRot — Your Focus Companion**

A lightweight, always-on Windows desktop application that instantly delivers a perfectly sized “brainrot” video panel on the right side of your screen — helping you stay engaged during boring or repetitive tasks.

![BrainRot Demo](https://via.placeholder.com/800x450?text=BrainRot+Demo+GIF)  
*(Add a short GIF or screenshot here once available)*

## About

Modern attention spans are short. Whether you're studying, coding, doing spreadsheets, or handling emails, many people (especially those with ADHD tendencies) find it easier to focus when there's low-stakes visual stimulation in the background.

**sideRott** (BrainRot) solves this by giving you instant, controlled access to high-energy brainrot videos — Minecraft parkour, Subway Surfers, satisfying loops, GTA chaos, and more — without ever leaving your workflow or falling into a YouTube rabbit hole.

Just press a global hotkey and a clean, borderless 25% side panel slides in with a video already playing. Work in the remaining 75% of your screen. When you're done, press the hotkey again or hover to close — the panel disappears seamlessly.

## Features

- **Instant Activation** — Global hotkey opens the panel in under 300ms with zero buffering
- **Perfect Side Panel** — Exactly 25% of screen width, full height, borderless and always-on-top (respects fullscreen apps)
- **Invisible & Minimalist UI** — No chrome, no title bar, no distractions. Controls only appear when you hover
- **Premium Liquid Glass Menu** — Elegant frosted-glass menu with 8 curated 3D thumbnail cards for quick video switching
- **Zero-Buffer Playback** — Starts instantly with local 4-second clips, then seamlessly continues from full videos
- **Lightweight & Efficient** — Runs silently in the background with minimal RAM/CPU usage
- **Smart Screen Awareness** — Works alongside your existing windows without forcing awkward resizes
- **Customizable** — Easy to add your own brainrot videos and clips

## How It Works

1. The app launches silently with Windows and stays in the background.
2. Press the global hotkey (`Ctrl + Shift + B` by default) to summon the panel.
3. A high-energy video starts playing immediately in the right-side panel.
4. Hover anywhere on the panel to reveal the Close and Menu buttons.
5. Click the menu to open the beautiful liquid-glass selector and switch videos instantly.
6. Press the hotkey again or click Close to hide the panel and return to full focus.

The first 4 seconds are powered by local clips for instant playback. It then seamlessly transitions to the full video stream.

## Installation

### Prerequisites
- Windows 10 or 11
- Node.js (for building from source)

### From Source

```bash
# 1. Clone the repository
git clone https://github.com/S-leonardo369/sideRott.git
cd sideRott

# 2. Install dependencies
npm install

# 3. Run in development mode
npm start

# 4. Build the production installer (creates .exe)
npm run build
