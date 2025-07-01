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
function drawSpectrum(data) { // Questa è la versione a barre raggruppate
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

    // 1. Sposta l'immagine esistente di 1 pixel a sinistra
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);

    // 2. Disegna la nuova linea di frequenze sul bordo destro
    for (let i = 0; i < data.length; i++) {
        // Il valore dell'ampiezza (0-255) determina il colore
        const value = data[i];
        
        // Mappiamo il valore su una scala di colori (es. da blu a rosso)
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
        
        if (appState.audio.useMel) {
            drawMelSpectrogram(frequencyData);
        } else {
            drawSpectrogram(frequencyData);
        }

        appState.audio.animationFrameId = requestAnimationFrame(draw);
    }
    appState.audio.animationFrameId = requestAnimationFrame(draw);
}

function pauseAudio(){const{context:e,source:t,startTime:a,startOffset:o,playbackRate:i}=appState.audio;if(!appState.audio.isPlaying||!t)return;const n=(e.currentTime-a)*i;appState.audio.startOffset=o+n,t.onended=null,t.stop(0),appState.audio.source=null,appState.audio.isPlaying=!1,ui.playPauseBtn.textContent="Play",appState.audio.animationFrameId&&(cancelAnimationFrame(appState.audio.animationFrameId),appState.audio.animationFrameId=null)}function stopAudio(e=!1){const{source:t}=appState.audio;t&&(t.onended=null,t.stop(0),appState.audio.source=null),appState.audio.isPlaying=!1,ui.playPauseBtn.textContent="Play",appState.audio.startOffset=0,stopVisualization(),updateSeekBarAndTime()}function playAudio(){const{context:e,buffer:t,gainNode:a,startOffset:o,playbackRate:i}=appState.audio;e&&t&&("suspended"===e.state&&e.resume(),appState.audio.source=e.createBufferSource(),appState.audio.source.buffer=t,appState.audio.source.playbackRate.value=i,appState.audio.source.connect(a),appState.audio.source.onended=()=>{appState.audio.isPlaying&&stopAudio(!0)},appState.audio.startTime=e.currentTime,appState.audio.source.start(0,o%t.duration),appState.audio.isPlaying=!0,ui.playPauseBtn.textContent="Pause",startVisualization())}function setupAudioNodes(){const{context:e}=appState.audio;e&&(appState.audio.gainNode=e.createGain(),appState.audio.analyser=e.createAnalyser(),appState.audio.analyser.fftSize=2048,appState.audio.gainNode.connect(appState.audio.analyser),appState.audio.analyser.connect(e.destination),appState.audio.gainNode.gain.value=ui.volumeSlider.value)}function resetAudioState(){appState.audio.source&&(appState.audio.source.stop(),appState.audio.source.disconnect(),appState.audio.source=null),appState.audio.context&&"closed"!==appState.audio.context.state&&(appState.audio.context.close().catch(e=>console.error(e)),appState.audio.context=null),Object.assign(appState.audio,{buffer:null,gainNode:null,analyser:null,isPlaying:!1,isLoaded:!1,startOffset:0,startTime:0,playbackRate:1}),stopVisualization(),ui.playPauseBtn.disabled=!0,ui.stopBtn.disabled=!0,ui.audioSeekBar.disabled=!0,ui.speedSlider.disabled=!0,ui.resetSpeedBtn.disabled=!0,ui.playPauseBtn.textContent="Play",ui.audioTimeDisplay.textContent="00:00 / 00:00",ui.audioSeekBar.value=0,ui.speedSlider.value=1,ui.speedValue.textContent="1.00"}


// Funzione di inizializzazione per la sezione audio
export function initAudioHandler() {
    ui.audioInput.addEventListener('change',async e=>{const t=e.target.files[0];if(t){appState.audio.context&&"closed"!==appState.audio.context.state&&await appState.audio.context.close(),resetAudioState(),appState.audio.startOffset=0,appState.audio.context=new(window.AudioContext||window.webkitAudioContext);try{const e=await t.arrayBuffer();appState.audio.buffer=await appState.audio.context.decodeAudioData(e),setupAudioNodes(),appState.audio.isLoaded=!0,ui.playPauseBtn.disabled=!1,ui.stopBtn.disabled=!1,ui.audioSeekBar.disabled=!1,ui.speedSlider.disabled=!1,ui.resetSpeedBtn.disabled=!1,ui.playPauseBtn.textContent="Play",ui.audioTimeDisplay.textContent=`00:00 / ${formatTime(appState.audio.buffer.duration)}`,ui.audioSeekBar.max=100*appState.audio.buffer.duration,ui.audioSeekBar.value=0}catch(e){console.error("Error decoding audio data:",e),alert("Impossibile caricare il file audio."),resetAudioState()}}}),ui.playPauseBtn.addEventListener("click",()=>{appState.audio.isLoaded&&(appState.audio.isPlaying?pauseAudio():playAudio())}),ui.stopBtn.addEventListener("click",()=>{appState.audio.isLoaded&&stopAudio(!1)}),ui.volumeSlider.addEventListener("input",e=>{appState.audio.gainNode&&(appState.audio.gainNode.gain.value=parseFloat(e.target.value))}),ui.speedSlider.addEventListener("input",e=>{const t=parseFloat(e.target.value),a=appState.audio.playbackRate;if(ui.speedValue.textContent=t.toFixed(2),appState.audio.isPlaying&&appState.audio.source){const{context:o,startTime:i,startOffset:n}=appState.audio,s=(o.currentTime-i)*a;appState.audio.startOffset=n+s,appState.audio.startTime=o.currentTime,appState.audio.playbackRate=t,appState.audio.source.playbackRate.value=t}else appState.audio.playbackRate=t}),ui.resetSpeedBtn.addEventListener("click",()=>{const e=1;ui.speedSlider.value=e,ui.speedSlider.dispatchEvent(new Event("input"))}),ui.audioSeekBar.addEventListener("input",e=>{if(appState.audio.buffer){const t=parseFloat(e.target.value)/100;appState.audio.startOffset=t,appState.audio.isPlaying&&(appState.audio.source&&(appState.audio.source.stop(),appState.audio.source.disconnect(),appState.audio.source=null),playAudio()),ui.audioTimeDisplay.textContent=`${formatTime(t)} / ${formatTime(appState.audio.buffer.duration)}`}});
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