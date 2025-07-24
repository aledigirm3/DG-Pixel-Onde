# DG Pixel & Onde

`DG Pixel & Onde` è un'applicazione web interattiva per la manipolazione di immagini e l'analisi di file audio. Sviluppata come progetto per il corso di Laboratorio Multimediale dell'Università Roma Tre, questa applicazione dimostra l'uso delle API web moderne come **Canvas API** e **Web Audio API** per l'elaborazione di media digitali direttamente nel browser.

---

## 🎨 Funzionalità

L'interfaccia è divisa in due sezioni principali: una per le immagini e una per l'audio.

### Manipolazione Immagine

- **Caricamento Immagine**: Carica un'immagine dal tuo dispositivo.
- **Filtri**: Applica filtri in tempo reale:
  - **Grigi**: Converte l'immagine in scala di grigi.
  - **Inverti**: Inverte i colori dell'immagine.
  - **Seppia**: Applica un classico filtro seppia.
  - **Mediano**: Applica un filtro mediano per la riduzione del rumore sale e pepe.
- **Trasformata di Fourier (FFT)**: Calcola e visualizza lo spettro della magnitudine della Trasformata di Fourier 2D dell'immagine.
- **Rotazione**: Ruota l'immagine da 0 a 360 gradi.
- **Reset**: Annulla tutte le modifiche e ripristina l'immagine originale.

### Analisi Audio

- **Caricamento Audio**: Carica un file audio dal tuo dispositivo.
- **Controlli di Riproduzione**: Controlli standard come **Play/Pausa**, **Stop** e una **barra di avanzamento** per navigare nella traccia.
- **Modifiche**:
  - Regola il **volume**.
  - Cambia la **velocità** di riproduzione.
- **Visualizzazioni in Tempo Reale**:
  - **Waveform**: Mostra la forma d'onda del segnale audio.
  - **Spectrum**: Visualizza lo spettro delle frequenze istantanee.
  - **Spectrogram**: Rappresenta l'evoluzione dello spettro di frequenza nel tempo. È possibile scegliere tra una scala **lineare** e una scala **Mel**, più vicina alla percezione umana.

---

## 🚀 Come Utilizzarlo

Per eseguire questo progetto in locale, è necessario un piccolo server HTTP per gestire correttamente i moduli JavaScript (ES Modules).

### Prerequisiti

Assicurati di avere [Node.js](https://nodejs.org/) e npm installati sul tuo sistema.

### Installazione e Avvio

1.  **Clona il progetto**
    ```sh
    git clone https://github.com/aledigirm3/DG-Pixel-Onde.git
    ```

2.  **Apri il terminale**
    Naviga fino alla cartella principale del progetto.
    ```sh
    cd DG-Pixel-Onde
    ```

3.  **Installa il server HTTP**
    Esegui questo comando per installare `http-server` a livello globale (una tantum). Questo ti permetterà di avviare un server da qualsiasi cartella.
    ```sh
    npm install -g http-server
    ```

4.  **Avvia il server**
    Una volta dentro la cartella del progetto, esegui il comando:
    ```sh
    http-server
    ```

5.  **Apri l'applicazione**
    Il terminale ti mostrerà uno o più indirizzi locali. Apri il tuo browser e vai a uno di questi URL (solitamente `http://127.0.0.1:8080`). Ora puoi usare l'applicazione!

---

## 📂 Struttura del Progetto

Il codice è organizzato in moduli per separare le responsabilità:

- `index.html`: La pagina principale che contiene la struttura dell'interfaccia utente.
- `css/styles.css`: Il foglio di stile per l'applicazione.
- `js/app.js`: Il punto di ingresso principale dell'applicazione che inizializza i gestori di immagine e audio.
- `js/state.js`: Definisce un oggetto globale per mantenere lo stato dell'applicazione (es. filtri applicati, stato di riproduzione audio).
- `js/ui.js`: Contiene tutti i riferimenti agli elementi del DOM per mantenere il codice pulito.
- `js/imageHandler.js`: Gestisce tutta la logica relativa al caricamento, alla visualizzazione e alla manipolazione delle immagini.
- `js/audioHandler.js`: Gestisce la logica per il caricamento, la riproduzione, l'analisi e la visualizzazione dell'audio tramite la Web Audio API.

---

## ✨ Crediti

- **Sviluppatore**: Alessandro Di Girolamo
- **Icona**: [Pyramid icons created by Freepik - Flaticon](https://www.flaticon.com/free-icon/pyramid_6181172)
- **Immagine di sfondo**: [Background image by Freepik](https://www.freepik.com/free-photo/3d-rendering-hexagonal-texture-background_66626551.htm)