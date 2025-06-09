// Orchestrator
import { initImageHandler } from './imageHandler.js';
import { initAudioHandler } from './audioHandler.js';

console.log("%c🚀 Developed by %cDiggi", "color: #7CFC00;", "color: #7CFC00; font-weight: bold;");

// Quando il documento è caricato, inizializza i due gestori principali.
document.addEventListener('DOMContentLoaded', () => {
    initImageHandler();
    initAudioHandler();
});