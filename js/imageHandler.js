import { appState } from './state.js';
import * as ui from './ui.js';

function applyFilter(type) {
    // ... (copia qui la tua intera funzione applyFilter)
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

    ui.resetImageBtn.addEventListener('click', () => {
        resetImageState();
        renderImage();
    });
}