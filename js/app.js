console.log("%c🚀 Developed by %cDiggi", "color: #7CFC00;", "color: #7CFC00; font-weight: bold;");
document.addEventListener('DOMContentLoaded', () => {
    // --- Riferimenti DOM (Immagine) ---
    const imageInput = document.getElementById('image-input');
    const imageCanvas = document.getElementById('image-canvas');
    const imageCtx = imageCanvas.getContext('2d');
    const filterButtons = document.querySelectorAll('#image-controls button[data-filter]');
    const rotateSlider = document.getElementById('rotate-slider');
    const rotateValue = document.getElementById('rotate-value');
    const resetImageBtn = document.getElementById('reset-image-btn');

    // --- Riferimenti DOM (Audio) ---
    const audioInput = document.getElementById('audio-input');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const audioSeekBar = document.getElementById('audio-seek-bar');
    const audioTimeDisplay = document.getElementById('audio-time-display');
    const waveformCanvas = document.getElementById('waveform-canvas');
    const wfCtx = waveformCanvas.getContext('2d');
    const spectrumCanvas = document.getElementById('spectrum-canvas');
    const spCtx = spectrumCanvas.getContext('2d');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const resetSpeedBtn = document.getElementById('reset-speed-btn');

    // --- Stato dell'applicazione ---
    const appState = {
        image: {
            original: null,
            filter: 'none',
            rotation: 0,
        },
        audio: {
            context: null,
            buffer: null,
            source: null,
            gainNode: null,
            analyser: null,
            isPlaying: false,
            isLoaded: false,
            startOffset: 0,
            startTime: 0,
            animationFrameId: null,
            playbackRate: 1.0,
        },
    };

    // =================================================================
    // --- MANIPOLAZIONE IMMAGINE ---
    // =================================================================
    imageInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                appState.image.original = img;
                resetImageState();
                renderImage();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    filterButtons.forEach(btn => btn.addEventListener('click', () => {
        appState.image.filter = btn.dataset.filter;
        renderImage();
    }));

    rotateSlider.addEventListener('input', e => {
        const angle = parseInt(e.target.value, 10);
        appState.image.rotation = angle;
        rotateValue.textContent = angle;
        renderImage();
    });

    resetImageBtn.addEventListener('click', () => {
        resetImageState();
        renderImage();
    });

    function resetImageState() {
        appState.image.filter = 'none';
        appState.image.rotation = 0;
        rotateSlider.value = 0;
        rotateValue.textContent = '0';
    }

    function renderImage() {
        const { original, filter, rotation } = appState.image;
        if (!original) return;
        imageCanvas.width = original.width;
        imageCanvas.height = original.height;
        const angleInRad = rotation * Math.PI / 180;
        imageCtx.save();
        imageCtx.translate(original.width / 2, original.height / 2);
        imageCtx.rotate(angleInRad);
        imageCtx.drawImage(original, -original.width / 2, -original.height / 2);
        imageCtx.restore();
        if (filter !== 'none') applyFilter(filter);
    }

    function applyFilter(type) {
        const imgData = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
        const data = imgData.data;
        const width = imageCanvas.width;
        const height = imageCanvas.height;

        if (type === 'median') {
            // Il filtro mediano non può modificare l'immagine "sul posto",
            // perché il calcolo di un pixel necessita dei valori originali dei suoi vicini.
            // Creiamo quindi una copia dei dati originali da cui leggere.
            const originalData = new Uint8ClampedArray(data);

            // Iteriamo su ogni pixel, saltando i bordi per semplicità
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    
                    const i = (y * width + x) * 4; // Indice del pixel corrente
                    
                    const reds = [];
                    const greens = [];
                    const blues = [];

                    // Raccogliamo i valori dei pixel nella finestra 3x3
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const neighborIndex = ((y + ky) * width + (x + kx)) * 4;
                            reds.push(originalData[neighborIndex]);
                            greens.push(originalData[neighborIndex + 1]);
                            blues.push(originalData[neighborIndex + 2]);
                        }
                    }
                    
                    // Ordiniamo i valori per ogni canale di colore
                    reds.sort((a, b) => a - b);
                    greens.sort((a, b) => a - b);
                    blues.sort((a, b) => a - b);
                    
                    // Il valore mediano è quello centrale (indice 4 in un array di 9 elementi)
                    data[i] = reds[4];
                    data[i+1] = greens[4];
                    data[i+2] = blues[4];
                    // L'alpha (trasparenza) rimane invariato
                }
            }

        } else {
            // Gli altri filtri possono operare pixel per pixel
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                switch (type) {
                    case 'grayscale':
                        const avg = 0.299 * r + 0.587 * g + 0.114 * b;
                        data[i] = data[i + 1] = data[i + 2] = avg;
                        break;
                    case 'invert':
                        data[i] = 255 - r;
                        data[i + 1] = 255 - g;
                        data[i + 2] = 255 - b;
                        break;
                    case 'sepia':
                        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
                        break;
                }
            }
        }

        imageCtx.putImageData(imgData, 0, 0);
    }

    // =================================================================
    // --- ANALISI AUDIO ---
    // =================================================================
    audioInput.addEventListener('change', async e => {
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

            playPauseBtn.disabled = false;
            stopBtn.disabled = false;
            audioSeekBar.disabled = false;
            speedSlider.disabled = false;
            resetSpeedBtn.disabled = false;

            playPauseBtn.textContent = 'Play';
            audioTimeDisplay.textContent = `00:00 / ${formatTime(appState.audio.buffer.duration)}`;
            audioSeekBar.max = appState.audio.buffer.duration * 100;
            audioSeekBar.value = 0;

        } catch (error) {
            console.error('Error decoding audio data:', error);
            alert('Impossibile caricare il file audio. Assicurati che sia un formato audio valido.');
            resetAudioState();
        }
    });

    function setupAudioNodes() {
        const { context } = appState.audio;
        if (!context) return;

        appState.audio.gainNode = context.createGain();
        appState.audio.analyser = context.createAnalyser();
        appState.audio.analyser.fftSize = 2048;

        appState.audio.gainNode.connect(appState.audio.analyser);
        appState.audio.analyser.connect(context.destination);
        appState.audio.gainNode.gain.value = volumeSlider.value;
    }

    playPauseBtn.addEventListener('click', () => {
        if (!appState.audio.isLoaded) return;
        if (appState.audio.isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    });

    stopBtn.addEventListener('click', () => {
        if (appState.audio.isLoaded) {
            stopAudio(false);
        }
    });

    volumeSlider.addEventListener('input', e => {
        if (appState.audio.gainNode) {
            appState.audio.gainNode.gain.value = parseFloat(e.target.value);
        }
    });

    speedSlider.addEventListener('input', e => {
        const newRate = parseFloat(e.target.value);
        const oldRate = appState.audio.playbackRate; // Leggi la vecchia velocità

        speedValue.textContent = newRate.toFixed(2);
        
        // Se la riproduzione è in corso, dobbiamo ricalcolare l'offset
        if (appState.audio.isPlaying && appState.audio.source) {
            const { context, startTime, startOffset } = appState.audio;
            
            // 1. Calcola il tempo trascorso con la VECCHIA velocità
            const elapsedTime = (context.currentTime - startTime) * oldRate;
            
            // 2. Aggiorna l'offset totale per "salvare" il progresso
            appState.audio.startOffset = startOffset + elapsedTime;
            
            // 3. Resetta il tempo di inizio al momento attuale
            appState.audio.startTime = context.currentTime;

            // 4. Applica la nuova velocità allo stato e alla sorgente audio
            appState.audio.playbackRate = newRate;
            appState.audio.source.playbackRate.value = newRate;
            
        } else {
            // Se l'audio è in pausa, aggiorna semplicemente il valore per la prossima riproduzione
            appState.audio.playbackRate = newRate;
        }
    });

    resetSpeedBtn.addEventListener('click', () => {
        const defaultRate = 1.0;
        appState.audio.playbackRate = defaultRate;
        speedSlider.value = defaultRate;
        speedValue.textContent = defaultRate.toFixed(2);

        if (appState.audio.source) {
            appState.audio.source.playbackRate.value = defaultRate;
        }
    });

    audioSeekBar.addEventListener('input', e => {
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
        audioTimeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(appState.audio.buffer.duration)}`;
    });

    function playAudio() {
        const { context, buffer, gainNode, startOffset, playbackRate } = appState.audio;

        if (!context || !buffer) {
            console.warn("Contesto audio o buffer non pronti.");
            return;
        }

        if (context.state === 'suspended') {
            context.resume();
        }

        appState.audio.source = context.createBufferSource();
        appState.audio.source.buffer = buffer;
        appState.audio.source.playbackRate.value = playbackRate;
        appState.audio.source.connect(gainNode);

        appState.audio.source.onended = () => {
            if (appState.audio.isPlaying) {
                stopAudio(true);
            }
        };

        appState.audio.startTime = context.currentTime;
        appState.audio.source.start(0, startOffset % buffer.duration);

        appState.audio.isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        startVisualization();
    }

    function pauseAudio() {
        const { context, source, startTime, startOffset, playbackRate } = appState.audio; // Usa playbackRate dallo stato
        if (!appState.audio.isPlaying || !source) return;

        // Calcola il tempo trascorso dall'ultimo "play" o cambio di velocità
        const elapsedTime = (context.currentTime - startTime) * playbackRate;
        appState.audio.startOffset = startOffset + elapsedTime;

        source.onended = null;
        source.stop(0);
        appState.audio.source = null;

        appState.audio.isPlaying = false;
        playPauseBtn.textContent = 'Play';

        if (appState.audio.animationFrameId) {
            cancelAnimationFrame(appState.audio.animationFrameId);
            appState.audio.animationFrameId = null;
        }
    }

    function stopAudio(finishedNaturally = false) {
        const { source } = appState.audio;
        if (source) {
            source.onended = null;
            source.stop(0);
            appState.audio.source = null;
        }

        appState.audio.isPlaying = false;
        playPauseBtn.textContent = 'Play';
        appState.audio.startOffset = 0;

        stopVisualization();
        updateSeekBarAndTime();
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
        appState.audio.buffer = null;
        appState.audio.gainNode = null;
        appState.audio.analyser = null;
        appState.audio.isPlaying = false;
        appState.audio.isLoaded = false;
        appState.audio.startOffset = 0;
        appState.audio.startTime = 0;
        appState.audio.playbackRate = 1.0;
        stopVisualization();

        playPauseBtn.disabled = true;
        stopBtn.disabled = true;
        audioSeekBar.disabled = true;
        speedSlider.disabled = true;
        resetSpeedBtn.disabled = true;

        playPauseBtn.textContent = 'Play';
        audioTimeDisplay.textContent = '00:00 / 00:00';
        audioSeekBar.value = 0;
        speedSlider.value = 1.0;
        speedValue.textContent = '1.00';

        wfCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        spCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
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
            appState.audio.animationFrameId = requestAnimationFrame(draw);
        }
        appState.audio.animationFrameId = requestAnimationFrame(draw);
    }

    function stopVisualization() {
        if (appState.audio.animationFrameId) {
            cancelAnimationFrame(appState.audio.animationFrameId);
            appState.audio.animationFrameId = null;
            wfCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            spCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
        }
    }

    function updateSeekBarAndTime() {
        const { context, buffer, isPlaying, startTime, startOffset, source } = appState.audio;
        if (!buffer) return;

        let currentTime = startOffset;
        if (isPlaying && context.state === 'running' && source) {
             const elapsedTime = (context.currentTime - startTime) * source.playbackRate.value;
             currentTime = startOffset + elapsedTime;
        }

        currentTime = Math.min(currentTime, buffer.duration);
        
        if (currentTime < 0) currentTime = 0;

        audioSeekBar.value = currentTime * 100;
        audioTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(buffer.duration)}`;
    }

    function formatTime(seconds) {
        seconds = Math.max(0, seconds);
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    function drawWaveform(data) {
        const { width, height } = waveformCanvas;
        wfCtx.clearRect(0, 0, width, height);
        wfCtx.lineWidth = 2;
        wfCtx.strokeStyle = 'var(--primary-color)';
        wfCtx.beginPath();
        const sliceWidth = width * 1.0 / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) {
                wfCtx.moveTo(x, y);
            } else {
                wfCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        wfCtx.lineTo(width, height / 2);
        wfCtx.stroke();
    }

    function drawSpectrum(data) {
        const { width, height } = spectrumCanvas;
        spCtx.clearRect(0, 0, width, height);
        const barWidth = (width / data.length) * 2.5;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const barHeight = data[i] / 255 * height;
            spCtx.fillStyle = `hsl(${i / data.length * 360}, 100%, 50%)`;
            spCtx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }

    // Setup iniziale
    waveformCanvas.width = 800; waveformCanvas.height = 150;
    spectrumCanvas.width = 800; spectrumCanvas.height = 150;
    resetAudioState();
});