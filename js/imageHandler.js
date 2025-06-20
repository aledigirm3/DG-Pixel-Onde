import { appState } from './state.js';
import * as ui from './ui.js';

import ndarray from 'https://cdn.skypack.dev/ndarray';
import fft from 'https://cdn.skypack.dev/ndarray-fft';

function fftShift(real, imag) {
    const [h, w] = real.shape;
    const midX = Math.floor(w / 2);
    const midY = Math.floor(h / 2);

    function swap(i1, j1, i2, j2) {
        let tmp = real.get(i1, j1);
        real.set(i1, j1, real.get(i2, j2));
        real.set(i2, j2, tmp);

        tmp = imag.get(i1, j1);
        imag.set(i1, j1, imag.get(i2, j2));
        imag.set(i2, j2, tmp);
    }

    for (let y = 0; y < midY; y++) {
        for (let x = 0; x < midX; x++) {
            swap(y, x, y + midY, x + midX);
            swap(y, x + midX, y + midY, x);
        }
    }
}

function applyFFTWithLib() {
    const width = ui.imageCanvas.width;
    const height = ui.imageCanvas.height;
    const imageData = ui.imageCtx.getImageData(0, 0, width, height);

    // Converti in scala di grigi
    const gray = new Float32Array(width * height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        gray[i / 4] = avg;
    }

    // Prepara ndarray per reale e immaginaria
    const real = ndarray(gray, [height, width]);
    const imag = ndarray(new Float32Array(width * height), [height, width]);

    // Applica FFT 2D in-place
    fft(1, real, imag);

    fftShift(real, imag);

    // Calcola magnitudine logaritmica
    const spectrum = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const re = real.get(y, x);
            const im = imag.get(y, x);
            const mag = Math.log(1 + Math.sqrt(re * re + im * im));
            const i = (y * width + x) * 4;
            const intensity = Math.min(255, mag * 32); // Scala log
            spectrum[i] = spectrum[i+1] = spectrum[i+2] = intensity;
            spectrum[i+3] = 255;
        }
    }

    const fftImage = new ImageData(spectrum, width, height);
    ui.imageCtx.putImageData(fftImage, 0, 0);
}

function applyFilter(type) {
    
    const imgData = ui.imageCtx.getImageData(0, 0, ui.imageCanvas.width, ui.imageCanvas.height);
    const data = imgData.data;
    const width = ui.imageCanvas.width;
    const height = ui.imageCanvas.height;

    if (type === 'median') {
        const originalData = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const reds = [], greens = [], blues = [];
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const neighborIndex = ((y + ky) * width + (x + kx)) * 4;
                        reds.push(originalData[neighborIndex]);
                        greens.push(originalData[neighborIndex + 1]);
                        blues.push(originalData[neighborIndex + 2]);
                    }
                }
                reds.sort((a, b) => a - b);
                greens.sort((a, b) => a - b);
                blues.sort((a, b) => a - b);
                data[i] = reds[4];
                data[i+1] = greens[4];
                data[i+2] = blues[4];
            }
        }
    } else {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            switch (type) {
                case 'grayscale':
                    const avg = 0.299 * r + 0.587 * g + 0.114 * b;
                    data[i] = data[i + 1] = data[i + 2] = avg;
                    break;
                case 'invert':
                    data[i] = 255 - r; data[i + 1] = 255 - g; data[i + 2] = 255 - b;
                    break;
                case 'sepia':
                    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
                    break;
            }
        }
    }
    ui.imageCtx.putImageData(imgData, 0, 0);
}

function renderImage() {
    const { original, filter, rotation } = appState.image;
    if (!original) return;
    ui.imageCanvas.width = original.width;
    ui.imageCanvas.height = original.height;
    const angleInRad = rotation * Math.PI / 180;
    ui.imageCtx.save();
    ui.imageCtx.translate(original.width / 2, original.height / 2);
    ui.imageCtx.rotate(angleInRad);
    ui.imageCtx.drawImage(original, -original.width / 2, -original.height / 2);
    ui.imageCtx.restore();
    if (filter !== 'none') applyFilter(filter);
}

function resetImageState() {
    appState.image.filter = 'none';
    appState.image.rotation = 0;
    ui.rotateSlider.value = 0;
    ui.rotateValue.textContent = '0';
}

// La funzione di inizializzazione che collega tutti gli eventi relativi all'immagine.
export function initImageHandler() {
    ui.imageInput.addEventListener('change', e => {
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

    ui.filterButtons.forEach(btn => btn.addEventListener('click', () => {
        appState.image.filter = btn.dataset.filter;
        renderImage();
    }));

    ui.rotateSlider.addEventListener('input', e => {
        const angle = parseInt(e.target.value, 10);
        appState.image.rotation = angle;
        ui.rotateValue.textContent = angle;
        renderImage();
    });

    ui.fftButton.addEventListener('click', () => {
        applyFFTWithLib();
    });

    ui.resetImageBtn.addEventListener('click', () => {
        resetImageState();
        renderImage();
    });
}