// Esporta lo stato dell'applicazione in modo che possa essere importato da altri moduli.
export const appState = {
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
        useMel: false,
    },
};