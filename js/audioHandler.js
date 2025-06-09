import { appState } from './state.js';
import * as ui from './ui.js';

// Copia qui tutte le tue funzioni audio:
// formatTime, drawWaveform, drawSpectrum, updateSeekBarAndTime,
// startVisualization, stopVisualization, playAudio, pauseAudio,
// stopAudio, setupAudioNodes, resetAudioState

function formatTime(seconds) {
    // ... (il tuo codice formatTime)
    seconds = Math.max(0, seconds);
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function drawWaveform(data) {
    // ... (il tuo codice drawWaveform usando ui.waveformCanvas e ui.wfCtx)
    const { width, height } = ui.waveformCanvas;
    ui.wfCtx.clearRect(0, 0, width, height);
    ui.wfCtx.lineWidth = 2;
    ui.wfCtx.strokeStyle = 'var(--primary-color)';
    ui.wfCtx.beginPath();
    const sliceWidth = width * 1.0 / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = v * height / 2;
        if (i === 0) { ui.wfCtx.moveTo(x, y); } else { ui.wfCtx.lineTo(x, y); }
        x += sliceWidth;
    }
    ui.wfCtx.lineTo(width, height / 2);
    ui.wfCtx.stroke();
}

function drawSpectrum(data) {
    // ... (il tuo codice drawSpectrum usando ui.spectrumCanvas e ui.spCtx)
    const { width, height } = ui.spectrumCanvas;
    ui.spCtx.clearRect(0, 0, width, height);
    const barWidth = (width / data.length) * 2.5;
    let x = 0;
    for (let i = 0; i < data.length; i++) {
        const barHeight = data[i] / 255 * height;
        ui.spCtx.fillStyle = `hsl(${i / data.length * 360}, 100%, 50%)`;
        ui.spCtx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}

function updateSeekBarAndTime() {
    // ... (il tuo codice updateSeekBarAndTime)
    const { context, buffer, isPlaying, startTime, startOffset, playbackRate } = appState.audio;
    if (!buffer) return;

    let currentTime = startOffset;
    if (isPlaying && context.state === 'running') {
        const elapsedTime = (context.currentTime - startTime) * playbackRate;
        currentTime = startOffset + elapsedTime;
    }

    currentTime = Math.min(currentTime, buffer.duration);
    if (currentTime < 0) currentTime = 0;

    ui.audioSeekBar.value = currentTime * 100;
    ui.audioTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(buffer.duration)}`;
}

function stopVisualization() {
    // ... (il tuo codice stopVisualization)
    if (appState.audio.animationFrameId) {
        cancelAnimationFrame(appState.audio.animationFrameId);
        appState.audio.animationFrameId = null;
        ui.wfCtx.clearRect(0, 0, ui.waveformCanvas.width, ui.waveformCanvas.height);
        ui.spCtx.clearRect(0, 0, ui.spectrumCanvas.width, ui.spectrumCanvas.height);
    }
}

function startVisualization() {
    // ... (il tuo codice startVisualization)
    if (appState.audio.animationFrameId) return;
    const analyser = appState.audio.analyser;
    if (!analyser) return;
    const dataLength = analyser.frequencyBinCount;
    const waveformData = new Uint8Array(analyser.fftSize);
    const frequencyData = new Uint8Array(dataLength);

    function draw() {
        updateSeekBarAndTime();
        if (!appState.audio.isPlaying && appState.audio.context.state !== 'running') {
            stopVisualization();
            return;
        }
        analyser.getByteTimeDomainData(waveformData);
        drawWaveform(waveformData);
        analyser.getByteFrequencyData(frequencyData);
        drawSpectrum(frequencyData);
        appState.audio.animationFrameId = requestAnimationFrame(draw);
    }
    appState.audio.animationFrameId = requestAnimationFrame(draw);
}

function pauseAudio() {
    // ... (la tua funzione pauseAudio corretta)
    const { context, source, startTime, startOffset, playbackRate } = appState.audio;
    if (!appState.audio.isPlaying || !source) return;
    const elapsedTime = (context.currentTime - startTime) * playbackRate;
    appState.audio.startOffset = startOffset + elapsedTime;
    source.onended = null;
    source.stop(0);
    appState.audio.source = null;
    appState.audio.isPlaying = false;
    ui.playPauseBtn.textContent = 'Play';
    if (appState.audio.animationFrameId) {
        cancelAnimationFrame(appState.audio.animationFrameId);
        appState.audio.animationFrameId = null;
    }
}

function stopAudio(finishedNaturally = false) {
    // ... (il tuo codice stopAudio)
    const { source } = appState.audio;
    if (source) {
        source.onended = null;
        source.stop(0);
        appState.audio.source = null;
    }
    appState.audio.isPlaying = false;
    ui.playPauseBtn.textContent = 'Play';
    appState.audio.startOffset = 0;
    stopVisualization();
    updateSeekBarAndTime();
}

function playAudio() {
    // ... (il tuo codice playAudio)
    const { context, buffer, gainNode, startOffset, playbackRate } = appState.audio;
    if (!context || !buffer) return;
    if (context.state === 'suspended') { context.resume(); }

    appState.audio.source = context.createBufferSource();
    appState.audio.source.buffer = buffer;
    appState.audio.source.playbackRate.value = playbackRate;
    appState.audio.source.connect(gainNode);
    appState.audio.source.onended = () => {
        if (appState.audio.isPlaying) { stopAudio(true); }
    };
    appState.audio.startTime = context.currentTime;
    appState.audio.source.start(0, startOffset % buffer.duration);
    appState.audio.isPlaying = true;
    ui.playPauseBtn.textContent = 'Pause';
    startVisualization();
}

function setupAudioNodes() {
    // ... (il tuo codice setupAudioNodes)
    const { context } = appState.audio;
    if (!context) return;
    appState.audio.gainNode = context.createGain();
    appState.audio.analyser = context.createAnalyser();
    appState.audio.analyser.fftSize = 2048;
    appState.audio.gainNode.connect(appState.audio.analyser);
    appState.audio.analyser.connect(context.destination);
    appState.audio.gainNode.gain.value = ui.volumeSlider.value;
}

function resetAudioState() {
    
    if (appState.audio.source) {
        appState.audio.source.stop();
        appState.audio.source.disconnect();
        appState.audio.source = null;
    }
    if (appState.audio.context && appState.audio.context.state !== 'closed') {
        appState.audio.context.close().catch(e => console.error(e));
        appState.audio.context = null;
    }
    Object.assign(appState.audio, {
        buffer: null, gainNode: null, analyser: null, isPlaying: false,
        isLoaded: false, startOffset: 0, startTime: 0, playbackRate: 1.0
    });
    stopVisualization();

    ui.playPauseBtn.disabled = true;
    ui.stopBtn.disabled = true;
    ui.audioSeekBar.disabled = true;
    ui.speedSlider.disabled = true;
    ui.resetSpeedBtn.disabled = true;

    ui.playPauseBtn.textContent = 'Play';
    ui.audioTimeDisplay.textContent = '00:00 / 00:00';
    ui.audioSeekBar.value = 0;
    ui.speedSlider.value = 1.0;
    ui.speedValue.textContent = '1.00';
}

// Funzione di inizializzazione per la sezione audio
export function initAudioHandler() {
    ui.audioInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        if (appState.audio.context && appState.audio.context.state !== 'closed') {
            await appState.audio.context.close();
        }
        resetAudioState();
        appState.audio.startOffset = 0;
        appState.audio.context = new (window.AudioContext || window.webkitAudioContext)();
        try {
            const arrayBuffer = await file.arrayBuffer();
            appState.audio.buffer = await appState.audio.context.decodeAudioData(arrayBuffer);
            setupAudioNodes();
            appState.audio.isLoaded = true;

            ui.playPauseBtn.disabled = false;
            ui.stopBtn.disabled = false;
            ui.audioSeekBar.disabled = false;
            ui.speedSlider.disabled = false;
            ui.resetSpeedBtn.disabled = false;
            ui.playPauseBtn.textContent = 'Play';
            ui.audioTimeDisplay.textContent = `00:00 / ${formatTime(appState.audio.buffer.duration)}`;
            ui.audioSeekBar.max = appState.audio.buffer.duration * 100;
            ui.audioSeekBar.value = 0;
        } catch (error) {
            console.error('Error decoding audio data:', error);
            alert('Impossibile caricare il file audio.');
            resetAudioState();
        }
    });

    ui.playPauseBtn.addEventListener('click', () => {
        if (!appState.audio.isLoaded) return;
        if (appState.audio.isPlaying) { pauseAudio(); } else { playAudio(); }
    });

    ui.stopBtn.addEventListener('click', () => {
        if (appState.audio.isLoaded) { stopAudio(false); }
    });

    ui.volumeSlider.addEventListener('input', e => {
        if (appState.audio.gainNode) {
            appState.audio.gainNode.gain.value = parseFloat(e.target.value);
        }
    });

    ui.speedSlider.addEventListener('input', e => {
        // ... (la tua logica corretta per lo speed slider)
        const newRate = parseFloat(e.target.value);
        const oldRate = appState.audio.playbackRate;
        ui.speedValue.textContent = newRate.toFixed(2);
        if (appState.audio.isPlaying && appState.audio.source) {
            const { context, startTime, startOffset } = appState.audio;
            const elapsedTime = (context.currentTime - startTime) * oldRate;
            appState.audio.startOffset = startOffset + elapsedTime;
            appState.audio.startTime = context.currentTime;
            appState.audio.playbackRate = newRate;
            appState.audio.source.playbackRate.value = newRate;
        } else {
            appState.audio.playbackRate = newRate;
        }
    });
    
    ui.resetSpeedBtn.addEventListener('click', () => {
        // ... (il tuo codice resetSpeedBtn)
        const defaultRate = 1.0;
        ui.speedSlider.value = defaultRate;
        ui.speedSlider.dispatchEvent(new Event('input')); // Simula l'evento per applicare la logica
    });

    ui.audioSeekBar.addEventListener('input', e => {
        // ... (il tuo codice audioSeekBar)
        if (!appState.audio.buffer) return;
        const newTime = parseFloat(e.target.value) / 100;
        appState.audio.startOffset = newTime;
        if (appState.audio.isPlaying) {
            if (appState.audio.source) {
                appState.audio.source.stop();
                appState.audio.source.disconnect();
                appState.audio.source = null;
            }
            playAudio();
        }
        ui.audioTimeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(appState.audio.buffer.duration)}`;
    });

    ui.waveformCanvas.width = 800; ui.waveformCanvas.height = 150;
    ui.spectrumCanvas.width = 800; ui.spectrumCanvas.height = 150;
    resetAudioState();
}