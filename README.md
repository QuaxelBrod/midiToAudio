# MIDI to Audio Converter

Konvertiert MIDI-Dateien aus einer MongoDB-Datenbank mit einem konfigurierbaren Soundfont zu normalisierten MP3-Dateien.

## Features

- ✅ **MIDI-Rendering**: Verwendet WebAssembly FluidSynth (js-synthesizer) - keine Systemabhängigkeiten
- ✅ **Soundfont-Unterstützung**: Konfigurierbare SF2/SF3-Soundfonts
- ✅ **LUFS-Normalisierung**: Präzise zwei-Pass-Normalisierung auf -14 LUFS
- ✅ **MP3-Export**: Hochwertige MP3-Kodierung mit ID3-Metadaten
- ✅ **Intelligente Pfadgenerierung**: `Artist/Album/Title.mp3` mit Fallback-Strategie
- ✅ **Duplikatsprüfung**: Verhindert doppelte Verarbeitung
- ✅ **Batch-Verarbeitung**: Parallele Verarbeitung mit konfigurierbarer Concurrency
- ✅ **Robuste Fehlerbehandlung**: Retry-Logik und automatisches Cleanup

## Systemvoraussetzungen

- **Node.js**: Version 18 oder höher
- **FFmpeg**: Muss auf dem System installiert sein
- **FluidSynth**: MIDI-Synthesizer für Audio-Rendering

### Dependencies Installation

**macOS (mit Homebrew):**
```bash
brew install ffmpeg fluid-synth
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg fluidsynth
```

**Windows:**
- FFmpeg: [ffmpeg.org](https://ffmpeg.org/download.html)
- FluidSynth: [github.com/FluidSynth](https://github.com/FluidSynth/fluidsynth/releases)

## Installation

1. **Repository klonen oder Projektverzeichnis erstellen**

2. **Dependencies installieren:**
```bash
npm install
```

3. **Umgebungsvariablen konfigurieren:**
```bash
cp .env.example .env
```

Bearbeiten Sie `.env` und passen Sie die Werte an:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=midi_database
MONGODB_COLLECTION=midi_collection

# Soundfont (SF2/SF3)
SOUNDFONT_PATH=/path/to/your/soundfont.sf2

# Output
OUTPUT_DIRECTORY=./output
TARGET_LUFS=-14

# Processing
CONCURRENCY=4
ENABLE_DUPLICATE_CHECK=true
```

4. **Soundfont herunterladen:**

Empfohlene kostenlose Soundfonts:
- [FluidR3_GM](http://www.musescore.org/download/fluid-soundfont.tar.gz)
- [GeneralUser GS](https://schristiancollins.com/generaluser.php)

## Verwendung

### Basis-Verwendung

Alle MIDI-Dateien verarbeiten:
```bash
npm start
```

### CLI-Optionen

```bash
node src/index.js [options]

Options:
  -l, --limit <number>        Maximale Anzahl zu verarbeitender Dateien
  -c, --concurrency <number>  Anzahl paralleler Prozesse (default: 4)
  -f, --filter <json>         MongoDB-Filter als JSON
  --dry-run                   Simulation ohne Datei-Schreibvorgänge
  --stats-only                Nur Statistiken anzeigen
  -h, --help                  Hilfe anzeigen
```

### Beispiele

**Erste 10 Dateien verarbeiten:**
```bash
node src/index.js --limit 10
```

**Mit höherer Concurrency:**
```bash
node src/index.js --concurrency 8
```

**Mit MongoDB-Filter:**
```bash
node src/index.js --filter '{"musicLLM.artist": "Bach"}'
```

**Dry-Run (Konfiguration testen):**
```bash
node src/index.js --dry-run
```

**Statistiken anzeigen:**
```bash
node src/index.js --stats-only
```

## Verzeichnisstruktur

Generierte MP3-Dateien werden in folgender Struktur gespeichert:

```
output/
├── Artist Name/
│   ├── Album Name/
│   │   ├── Track Title.mp3
│   │   └── Another Track.mp3
│   └── Another Album/
│       └── Track.mp3
└── Another Artist/
    └── ...
```

## MongoDB-Schema

Die Anwendung erwartet MongoDB-Dokumente mit folgendem Schema:

```javascript
{
  midifile: {
    hash: "unique-hash",          // Erforderlich: Eindeutiger Hash
    data: Buffer,                  // Erforderlich: MIDI-Datei als Buffer
    fileName: "example.mid"
  },
  
  // Metadaten (optional, mit Fallback-Strategie):
  musicLLM: {
    artist: "Artist Name",
    title: "Song Title",
    album: "Album Name"
  },
  
  musicbrainz: {
    top: {
      artist: "Artist Name",
      title: "Song Title",
      firstReleaseDate: "2020-01-01",
      tags: [{ name: "Genre" }]
    }
  },
  
  redacted: {
    artist: "Artist Name",
    title: "Song Title",
    album: "Album Name"
  },
  
  // Automatisch hinzugefügt:
  midiToAudioProcessing: {
    status: "completed",           // "processing", "completed", "failed"
    lastUpdated: Date,
    outputPath: "/path/to/output.mp3",
    originalLUFS: -18.5,
    targetLUFS: -14,
    processingDuration: 5432,
    metadata: { ... }
  }
}
```

## Konfiguration

Alle Einstellungen können über die `.env`-Datei konfiguriert werden:

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB-Verbindungs-URI |
| `MONGODB_DATABASE` | `midi_database` | Datenbankname |
| `MONGODB_COLLECTION` | `midi_collection` | Collection-Name |
| `SOUNDFONT_PATH` | `./soundfont.sf2` | Pfad zur Soundfont-Datei |
| `OUTPUT_DIRECTORY` | `./output` | Ausgabeverzeichnis |
| `TARGET_LUFS` | `-14` | Ziel-LUFS für Normalisierung |
| `SAMPLE_RATE` | `44100` | Audio-Sample-Rate |
| `MP3_BITRATE` | `320` | MP3-Bitrate (64-320 kbps) |
| `CONCURRENCY` | `4` | Anzahl paralleler Prozesse |
| `ENABLE_DUPLICATE_CHECK` | `true` | Duplikatsprüfung aktivieren |
| `LOG_LEVEL` | `info` | Log-Level (debug, info, warn, error) |

## Logging

Logs werden sowohl in die Console als auch in eine Datei geschrieben:
- **Console**: Farbige Pretty-Print-Ausgabe
- **Datei**: `logs/app.log` (JSON-Format)

Log-Level ändern:
```env
LOG_LEVEL=debug
```

## Troubleshooting

### Fehler: "Soundfont file not found"
- Stellen Sie sicher, dass `SOUNDFONT_PATH` in `.env` auf eine existierende SF2/SF3-Datei zeigt

### Fehler: "FFmpeg not found"
- Installieren Sie FFmpeg (siehe Systemvoraussetzungen)
- Überprüfen Sie mit: `ffmpeg -version`

### Fehler: "Failed to connect to MongoDB"
- Überprüfen Sie `MONGODB_URI` in `.env`
- Stellen Sie sicher, dass MongoDB läuft

### Langsame Verarbeitung
- Erhöhen Sie `CONCURRENCY` in `.env`
- Beachten Sie CPU- und Speicher-Limits

### "Insufficient disk space"
- Überprüfen Sie verfügbaren Speicherplatz im `OUTPUT_DIRECTORY`
- MIDI→WAV→MP3 benötigt temporären Speicher (~10-50 MB pro Datei)

## Lizenz

MIT
