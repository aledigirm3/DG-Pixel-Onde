import { appState } from './state.js';
import * as ui from './ui.js';

function formatTime(seconds) {
    seconds = Math.max(0, seconds);
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
function drawWaveform(data) {
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
    const { width, height } = ui.spectrumCanvas;
    ui.spCtx.clearRect(0, 0, width, height);
    const groupSize = 4;
    const barCount = data.length / groupSize;
    const barWidth = width / barCount;
    for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < groupSize; j++) {
            sum += data[i * groupSize + j];
        }
        const average = sum / groupSize;
        const barHeight = (average / 255) * height;
        const hue = (i / barCount) * 360;
        ui.spCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ui.spCtx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    }
}

function drawSpectrogram(data) {
    const { width, height } = ui.spectrogramCanvas;
    const ctx = ui.spectrogramCtx;

    // Sposta l'immagine esistente di 1 pixel a sinistra
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    // Disegna la nuova linea di frequenze sul bordo destro
    for (let i = 0; i < data.length; i++) {
        // Il valore dell'ampiezza (0-255) determina il colore
        const value = data[i];
        
        // Mappa il valore su una scala di colori (es. da blu a rosso)
        // Blu (silenzio) -> Verde -> Giallo -> Rosso (suono forte)
        // Hue: 240 (blu) -> 0 (rosso)
        const hue = 240 - (value / 255) * 240;

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        // Determina la posizione Y. L'asse Y è invertito nel canvas (0 è in alto)
        // Frequenze basse (inizio dell'array) in basso, frequenze alte in alto
        const y = height - (i / data.length) * height;
        
        // Disegna un piccolo rettangolo per rappresentare questa frequenza
        // L'altezza può essere di 1px o poco più per riempire eventuali buchi
        const barHeight = height / data.length;
        ctx.fillRect(width - 1, y, 1, barHeight + 1);
    }
}

function getMelBandIndices(fftSize, sampleRate, numBands) {
    const melMin = hzToMel(0);
    const melMax = hzToMel(sampleRate / 2);
    const melPoints = [];
    for (let i = 0; i <= numBands + 2; i++) {
        melPoints.push(melMin + (melMax - melMin) * (i / (numBands + 2)));
    }
    const hzPoints = melPoints.map(melToHz);
    const binIndices = hzPoints.map(hz => Math.floor((hz / (sampleRate / 2)) * fftSize));

    const bands = [];
    for (let i = 1; i <= numBands; i++) {
        const start = binIndices[i - 1];
        const peak = binIndices[i];
        const end = binIndices[i + 1];
        const indices = [];
        for (let j = start; j < end; j++) {
            if (j >= 0 && j < fftSize) {
                indices.push(j);
            }
        }
        bands.push(indices);
    }
    return bands;
}

function hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
    return 700 * (10 ** (mel / 2595) - 1);
}

function drawMelSpectrogram(data) {
    const { width, height } = ui.spectrogramCanvas;
    const ctx = ui.spectrogramCtx;

    const numBands = 40; // bande Mel
    const fftSize = data.length;
    const melIndices = getMelBandIndices(fftSize, appState.audio.context.sampleRate, numBands);

    // Sposta immagine 1px a sinistra
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < numBands; i++) {
        const indices = melIndices[i];
        let sum = 0;
        for (const idx of indices) {
            sum += data[idx];
        }
        const average = sum / indices.length;

        // Log transform per renderlo più naturale
        const logValue = Math.log10(1 + average) / Math.log10(256); // Normalizzato [0,1]
        const hue = 240 - logValue * 240;

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        const y = height - (i / numBands) * height;
        const barHeight = height / numBands;
        ctx.fillRect(width - 1, y, 1, barHeight + 1);
    }
}

function updateSeekBarAndTime() {
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
    if (appState.audio.animationFrameId) {
        cancelAnimationFrame(appState.audio.animationFrameId);
        appState.audio.animationFrameId = null;
    }
    ui.wfCtx.clearRect(0, 0, ui.waveformCanvas.width, ui.waveformCanvas.height);
    ui.spCtx.clearRect(0, 0, ui.spectrumCanvas.width, ui.spectrumCanvas.height);
    ui.spectrogramCtx.clearRect(0, 0, ui.spectrogramCanvas.width, ui.spectrogramCanvas.height);
}


function startVisualization() {
    if (appState.audio.animationFrameId) return;
    const analyser = appState.audio.analyser;
    if (!analyser) return;
    
    const dataLength = analyser.frequencyBinCount; // fftSize / 2
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
        
        if (appState.audio.useMel) {
            drawMelSpectrogram(frequencyData);
        } else {
            drawSpectrogram(frequencyData);
        }

        appState.audio.animationFrameId = requestAnimationFrame(draw);
    }
    appState.audio.animationFrameId = requestAnimationFrame(draw);
}

function pauseAudio() {
    const {
        context,
        source,
        startTime,
        startOffset,
        playbackRate
    } = appState.audio;

    // Se non sta suonando o non c'è source, esci
    if (!appState.audio.isPlaying || !source) return;

    // Calcola quanto tempo è passato da quando ha iniziato a suonare
    const elapsed = (context.currentTime - startTime) * playbackRate;

    // Aggiorna startOffset per poter riprendere da qui
    appState.audio.startOffset = startOffset + elapsed;

    // Ferma la sorgente audio
    source.onended = null;
    source.stop(0);
    appState.audio.source = null;
    appState.audio.isPlaying = false;

    // Aggiorna UI
    ui.playPauseBtn.textContent = "Play";

    // Ferma l'animazione se attiva
    if (appState.audio.animationFrameId) {
        cancelAnimationFrame(appState.audio.animationFrameId);
        appState.audio.animationFrameId = null;
    }
}

function stopAudio(resetOffset = false) {
    const { source } = appState.audio;

    if (source) {
        source.onended = null;
        source.stop(0);
        appState.audio.source = null;
    }

    appState.audio.isPlaying = false;
    ui.playPauseBtn.textContent = "Play";

    if (resetOffset) {
        appState.audio.startOffset = 0;
    }

    stopVisualization();
    updateSeekBarAndTime();
}

function playAudio() {
    const {
        context,
        buffer,
        gainNode,
        startOffset,
        playbackRate
    } = appState.audio;

    if (!context || !buffer) return;

    // Se l'audio context è sospeso (autoplay policy), prova a riprendere
    if (context.state === 'suspended') {
        context.resume();
    }

    // Crea una nuova sorgente audio
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    // Collega la sorgente al nodo di gain (volume)
    source.connect(gainNode);

    // Quando l'audio finisce, chiama stopAudio
    source.onended = () => {
        if (appState.audio.isPlaying) {
            stopAudio(true);
        }
    };

    appState.audio.source = source;
    appState.audio.startTime = context.currentTime;

    // Avvia la riproduzione da startOffset (modulo durata per sicurezza)
    source.start(0, startOffset % buffer.duration);

    appState.audio.isPlaying = true;

    // Aggiorna UI
    ui.playPauseBtn.textContent = "Pause";

    // Avvia la visualizzazione
    startVisualization();
}

function setupAudioNodes() {
    const { context } = appState.audio;
    if (!context) return;

    appState.audio.gainNode = context.createGain();
    appState.audio.analyser = context.createAnalyser();

    appState.audio.analyser.fftSize = 2048;

    // Collegamenti: gainNode -> analyser -> destinazione audio
    appState.audio.gainNode.connect(appState.audio.analyser);
    appState.audio.analyser.connect(context.destination);

    // Imposta volume iniziale dal controllo UI
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
        buffer: null,
        gainNode: null,
        analyser: null,
        isPlaying: false,
        isLoaded: false,
        startOffset: 0,
        startTime: 0,
        playbackRate: 1,
    });

    stopVisualization();

    // Disabilita UI fino a nuovo caricamento audio
    ui.playPauseBtn.disabled = true;
    ui.stopBtn.disabled = true;
    ui.audioSeekBar.disabled = true;
    ui.speedSlider.disabled = true;
    ui.resetSpeedBtn.disabled = true;

    ui.playPauseBtn.textContent = "Play";
    ui.audioTimeDisplay.textContent = "00:00 / 00:00";
    ui.audioSeekBar.value = 0;
    ui.speedSlider.value = 1;
    ui.speedValue.textContent = "1.00";
}



// Funzione di inizializzazione per la sezione audio
export function initAudioHandler() {
    // Input file audio
    ui.audioInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Se c'è un AudioContext aperto lo chiude
        if (appState.audio.context && appState.audio.context.state !== "closed") {
            await appState.audio.context.close();
        }

        // Resetta lo stato audio
        resetAudioState();

        // Reset offset di riproduzione
        appState.audio.startOffset = 0;

        // Crea un nuovo AudioContext
        appState.audio.context = new (window.AudioContext || window.webkitAudioContext)();

        try {
            // Legge il file audio come ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Decodifica i dati audio
            appState.audio.buffer = await appState.audio.context.decodeAudioData(arrayBuffer);

            // Imposta i nodi audio (gain, analyser, ecc.)
            setupAudioNodes();

            // Segnala che il file è caricato
            appState.audio.isLoaded = true;

            // Abilita i controlli di riproduzione
            ui.playPauseBtn.disabled = false;
            ui.stopBtn.disabled = false;
            ui.audioSeekBar.disabled = false;
            ui.speedSlider.disabled = false;
            ui.resetSpeedBtn.disabled = false;

            // Aggiorna la UI con stato iniziale
            ui.playPauseBtn.textContent = "Play";
            ui.audioTimeDisplay.textContent = `00:00 / ${formatTime(appState.audio.buffer.duration)}`;

            // Imposta il massimo del seek bar in base alla durata dell'audio
            ui.audioSeekBar.max = 100 * appState.audio.buffer.duration;
            ui.audioSeekBar.value = 0;

        } catch (error) {
            console.error("Error decoding audio data:", error);
            alert("Impossibile caricare il file audio.");
            resetAudioState();
        }
    });

    // Gestisce il click sul pulsante Play/Pause
    ui.playPauseBtn.addEventListener("click", () => {
        if (!appState.audio.isLoaded) return;

        if (appState.audio.isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    });

    // Gestisce il click sul pulsante Stop
    ui.stopBtn.addEventListener("click", () => {
        if (!appState.audio.isLoaded) return;
        stopAudio(false);
    });

    // Controlla il volume (gain) tramite lo slider
    ui.volumeSlider.addEventListener("input", (event) => {
        if (appState.audio.gainNode) {
            appState.audio.gainNode.gain.value = parseFloat(event.target.value);
        }
    });

    // Controlla la velocità di riproduzione tramite slider
    ui.speedSlider.addEventListener("input", (event) => {
        const newRate = parseFloat(event.target.value);
        const audio = appState.audio;

        ui.speedValue.textContent = newRate.toFixed(2);

        if (audio.isPlaying && audio.source) {
            // Calcola l'offset corrente per continuare da qui con nuova velocità
            const { context, startTime, startOffset, playbackRate } = audio;
            const elapsed = (context.currentTime - startTime) * playbackRate;

            audio.startOffset = startOffset + elapsed;
            audio.startTime = context.currentTime;
            audio.playbackRate = newRate;
            audio.source.playbackRate.value = newRate;
        } else {
            audio.playbackRate = newRate;
        }
    });

    // Pulsante per resettare la velocità a 1
    ui.resetSpeedBtn.addEventListener("click", () => {
        const defaultRate = 1;
        ui.speedSlider.value = defaultRate;
        ui.speedSlider.dispatchEvent(new Event("input")); // trigger input per aggiornare tutto
    });

    // Gestisce il seek bar per saltare in punti specifici dell'audio
    ui.audioSeekBar.addEventListener("input", (event) => {
        const audio = appState.audio;
        if (!audio.buffer) return;

        // Calcola il nuovo offset in secondi
        const newOffset = parseFloat(event.target.value) / 100;

        audio.startOffset = newOffset;

        // Se sta suonando, interrompi e riparti dal nuovo offset
        if (audio.isPlaying) {
            if (audio.source) {
                audio.source.stop();
                audio.source.disconnect();
                audio.source = null;
            }
            playAudio();
        }

        // Aggiorna la visualizzazione del tempo
        ui.audioTimeDisplay.textContent = `${formatTime(newOffset)} / ${formatTime(audio.buffer.duration)}`;
    });

    ui.toggleMelBtn.addEventListener("click", () => {
        appState.audio.useMel = !appState.audio.useMel;
        ui.toggleMelBtn.textContent = `Mel: ${appState.audio.useMel ? 'ON' : 'OFF'}`;
    });


    ui.waveformCanvas.width = 800; ui.waveformCanvas.height = 150;
    ui.spectrumCanvas.width = 800; ui.spectrumCanvas.height = 150;
    

    ui.spectrogramCanvas.width = 800; ui.spectrogramCanvas.height = 150;
    // Quando si avvia, puliamo il canvas dello spettrogramma da eventuali residui
    ui.spectrogramCtx.clearRect(0, 0, ui.spectrogramCanvas.width, ui.spectrogramCanvas.height);

    resetAudioState();
}