// --- Riferimenti DOM (Immagine) ---
export const imageInput = document.getElementById('image-input');
export const imageCanvas = document.getElementById('image-canvas');
export const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
export const filterButtons = document.querySelectorAll('#image-controls button[data-filter]');
export const fftButton = document.getElementById('fft-btn')
export const rotateSlider = document.getElementById('rotate-slider');
export const rotateValue = document.getElementById('rotate-value');
export const resetImageBtn = document.getElementById('reset-image-btn');

// --- Riferimenti DOM (Audio) ---
export const audioInput = document.getElementById('audio-input');
export const playPauseBtn = document.getElementById('play-pause-btn');
export const stopBtn = document.getElementById('stop-btn');
export const volumeSlider = document.getElementById('volume-slider');
export const audioSeekBar = document.getElementById('audio-seek-bar');
export const audioTimeDisplay = document.getElementById('audio-time-display');
export const waveformCanvas = document.getElementById('waveform-canvas');
export const wfCtx = waveformCanvas.getContext('2d');
export const spectrumCanvas = document.getElementById('spectrum-canvas');
export const spCtx = spectrumCanvas.getContext('2d');
export const spectrogramCanvas = document.getElementById('spectrogram-canvas');
export const spectrogramCtx = spectrogramCanvas.getContext('2d');
export const speedSlider = document.getElementById('speed-slider');
export const speedValue = document.getElementById('speed-value');
export const resetSpeedBtn = document.getElementById('reset-speed-btn');

export const toggleMelBtn = document.getElementById('toggle-mel-btn');