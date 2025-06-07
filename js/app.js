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
            source: null, // AudioBufferSourceNode
            gainNode: null,
            analyser: null,
            isPlaying: false,
            isLoaded: false,
            // isFinished: false, // Non più necessario se gestiamo bene startOffset
            startOffset: 0, // Dove ripartire (in secondi)
            startTime: 0, // Tempo del context quando è partita la riproduzione (per calcolare startOffset alla pausa)
            animationFrameId: null,
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
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
                g = data[i + 1],
                b = data[i + 2];
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
        imageCtx.putImageData(imgData, 0, 0);
    }

    // =================================================================
    // --- ANALISI AUDIO ---
    // =================================================================

    audioInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        // Chiude il contesto audio precedente se esiste
        if (appState.audio.context && appState.audio.context.state !== 'closed') {
            await appState.audio.context.close();
        }
        stopAudio(false); // Ferma qualsiasi riproduzione e resetta lo stato senza azzerare l'offset
        appState.audio.startOffset = 0; // Azzera l'offset solo al caricamento di un nuovo file

        appState.audio.context = new (window.AudioContext || window.webkitAudioContext)();
        try {
            const arrayBuffer = await file.arrayBuffer();
            appState.audio.buffer = await appState.audio.context.decodeAudioData(arrayBuffer);

            setupAudioNodes();
            appState.audio.isLoaded = true;

            playPauseBtn.disabled = false;
            stopBtn.disabled = false;
            audioSeekBar.disabled = false;
            playPauseBtn.textContent = 'Play';
            audioTimeDisplay.textContent = `00:00 / ${formatTime(appState.audio.buffer.duration)}`;
            audioSeekBar.max = appState.audio.buffer.duration * 100; // Imposta il max in base alla durata in centesimi di secondo
            audioSeekBar.value = 0;

        } catch (error) {
            console.error('Error decoding audio data:', error);
            alert('Impossibile caricare il file audio. Assicurati che sia un formato audio valido.');
            resetAudioState();
        }
    });

    function setupAudioNodes() {
        const { context } = appState.audio;
        if (!context) return; // Assicurati che il contesto esista

        appState.audio.gainNode = context.createGain();
        appState.audio.analyser = context.createAnalyser();
        appState.audio.analyser.fftSize = 2048;

        // Connessioni: source -> gainNode -> analyser -> destination
        // Il source verrà creato e connesso in playAudio()
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
            stopAudio(false); // Passa false per indicare che non è una fine naturale
        }
    });

    volumeSlider.addEventListener('input', e => {
        if (appState.audio.gainNode) {
            appState.audio.gainNode.gain.value = parseFloat(e.target.value);
        }
    });

    audioSeekBar.addEventListener('input', e => {
        if (!appState.audio.buffer) return;
        // Il valore della seek bar è ora in secondi (ma * 100 per precisione)
        const newTime = parseFloat(e.target.value) / 100; 
        appState.audio.startOffset = newTime;

        // Se si sta riproducendo, riavvia da questa nuova posizione
        if (appState.audio.isPlaying) {
            if (appState.audio.source) {
                appState.audio.source.stop();
                appState.audio.source.disconnect(); // Disconnetti il vecchio source
                appState.audio.source = null; // Rimuovi il riferimento al vecchio source
            }
            playAudio();
        }
        // Aggiorna il display del tempo anche da fermo
        audioTimeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(appState.audio.buffer.duration)}`;
    });

    function playAudio() {
        const { context, buffer, gainNode, startOffset } = appState.audio;

        if (!context || !buffer) {
            console.warn("Contesto audio o buffer non pronti.");
            return;
        }

        // Se il contesto è sospeso (es. dopo una pausa), riprendilo
        if (context.state === 'suspended') {
            context.resume();
        }
        
        // Crea un nuovo AudioBufferSourceNode OGNI VOLTA che riproduci
        appState.audio.source = context.createBufferSource();
        appState.audio.source.buffer = buffer;
        appState.audio.source.connect(gainNode); // Connetti il source al gainNode

        appState.audio.source.onended = () => {
            // Se l'audio è finito naturalmente (non fermato dall'utente)
            if (appState.audio.isPlaying) { 
                stopAudio(true); // 'true' per indicare che è finita naturalmente
            }
        };

        // Calcola il tempo di inizio per la riproduzione continua
        appState.audio.startTime = context.currentTime;
        appState.audio.source.start(0, startOffset % buffer.duration); // Assicurati che l'offset non superi la durata

        appState.audio.isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        startVisualization();
    }

    function pauseAudio() {
        const { context, source } = appState.audio;
        if (!source || context.state === 'suspended') return;

        context.suspend(); // Sospende la riproduzione
        // Calcola il nuovo startOffset basato su quanto tempo è trascorso
        appState.audio.startOffset += context.currentTime - appState.audio.startTime;
        appState.audio.isPlaying = false;
        playPauseBtn.textContent = 'Play';
        stopVisualization();
    }

    function stopAudio(finished = false) {
        const { source, context } = appState.audio;

        if (source) {
            source.stop(0); // Ferma immediatamente il nodo source
            source.disconnect(); // Disconnetti il source
            appState.audio.source = null; // Rimuovi il riferimento
        }

        if (context && context.state === 'running') {
            context.suspend(); // Sospendi il contesto se è in esecuzione
        }

        appState.audio.isPlaying = false;
        // Se la traccia è finita naturalmente, resetta l'offset a 0.
        // Altrimenti, mantiene l'offset corrente (per un successivo play/seek).
        appState.audio.startOffset = finished ? 0 : appState.audio.startOffset;

        // Se finished è true, allora la riproduzione è arrivata alla fine.
        // In questo caso, il cursore deve andare a fine traccia e poi resettarsi a 0.
        if (finished) {
            audioSeekBar.value = 0; // Torna all'inizio sulla UI
            appState.audio.startOffset = 0; // Reset effettivo dell'offset per ripartire dall'inizio
        }
        
        playPauseBtn.textContent = 'Play';
        stopVisualization();
        updateSeekBarAndTime(); // Aggiorna la barra e il tempo per riflettere lo stato di stop
    }

    function resetAudioState() {
        if (appState.audio.source) {
            appState.audio.source.stop();
            appState.audio.source.disconnect();
            appState.audio.source = null;
        }
        if (appState.audio.context && appState.audio.context.state !== 'closed') {
            appState.audio.context.close();
            appState.audio.context = null;
        }
        appState.audio.buffer = null;
        appState.audio.gainNode = null;
        appState.audio.analyser = null;
        appState.audio.isPlaying = false;
        appState.audio.isLoaded = false;
        appState.audio.startOffset = 0;
        appState.audio.startTime = 0;
        stopVisualization();

        playPauseBtn.disabled = true;
        stopBtn.disabled = true;
        audioSeekBar.disabled = true;
        playPauseBtn.textContent = 'Play';
        audioTimeDisplay.textContent = `00:00 / 00:00`;
        audioSeekBar.value = 0;
        // Cancella i canvas
        wfCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        spCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
    }


    function startVisualization() {
        if (appState.audio.animationFrameId) return;
        
        const analyser = appState.audio.analyser;
        if (!analyser) return; // Assicurati che l'analyser esista

        const dataLength = analyser.frequencyBinCount;
        const waveformData = new Uint8Array(analyser.fftSize); // Usa fftSize per waveformData
        const frequencyData = new Uint8Array(dataLength);

        function draw() {
            updateSeekBarAndTime();
            // Assicurati che l'analyser e il contesto siano attivi prima di disegnare
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
        appState.audio.animationFrameId = requestAnimationFrame(draw); // Inizializza qui
    }
    
    function stopVisualization() {
        if (appState.audio.animationFrameId) {
            cancelAnimationFrame(appState.audio.animationFrameId);
            appState.audio.animationFrameId = null;
            // Pulisci i canvas quando la visualizzazione si ferma
            wfCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            spCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
        }
    }

    function updateSeekBarAndTime() {
        const { context, buffer, isPlaying, startTime, startOffset } = appState.audio;
        if (!buffer) return;
        
        let currentTime = startOffset;
        if (isPlaying && context.state === 'running') { // Solo se sta effettivamente riproducendo
            currentTime = startOffset + (context.currentTime - startTime);
        }
        
        // Clampa il tempo corrente alla durata totale
        currentTime = Math.min(currentTime, buffer.duration);

        // Aggiorna la barra, che ora ha max in secondi * 100
        audioSeekBar.value = currentTime * 100;
        audioTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(buffer.duration)}`;

        // Se l'audio è finito e non è già in stop, chiamiamo stopAudio
        if (isPlaying && currentTime >= buffer.duration - 0.01) { // Tolleranza per floating point
            stopAudio(true);
        }
    }
    
    function formatTime(seconds) {
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
        const barWidth = (width / data.length) * 2.5; // Regola la larghezza delle barre
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const barHeight = data[i] / 255 * height; // Normalizza l'altezza
            spCtx.fillStyle = `hsl(${i / data.length * 360}, 100%, 50%)`; // Colore basato sulla frequenza
            spCtx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1; // Spazio tra le barre
        }
    }
    
    // Setup iniziale dei canvas
    waveformCanvas.width = 800; waveformCanvas.height = 150;
    spectrumCanvas.width = 800; spectrumCanvas.height = 150;
    // Inizializza i bottoni come disabilitati finché non viene caricato un audio
    playPauseBtn.disabled = true;
    stopBtn.disabled = true;
    audioSeekBar.disabled = true;
});