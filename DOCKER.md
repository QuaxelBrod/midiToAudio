# Docker Deployment Configuration

## Verzeichnisstruktur auf dem Server

Erstellen Sie folgende Struktur auf Ihrem Server:

```
/path/to/deployment/
├── docker-compose.yml
├── Dockerfile
├── config/
│   └── .env              # Ihre Konfiguration
├── data/
│   ├── output/           # Generierte MP3s
│   ├── soundfonts/       # SF2/SF3 Dateien
│   └── logs/            # Application Logs
└── src/                  # Anwendungscode (aus Repository)
```

## Setup-Schritte

### 1. Verzeichnisse erstellen

```bash
mkdir -p config data/{output,soundfonts,logs}
```

### 2. Konfiguration vorbereiten

Kopieren Sie `.env.example` nach `config/.env` und passen Sie an:

```bash
cp .env.example config/.env
nano config/.env
```

**Wichtige Anpassungen für Docker:**
```env
# MongoDB - verwenden Sie den Host-Namen oder IP des MongoDB-Servers
MONGODB_URI=mongodb://mongodb-host:27017

# Soundfont - Pfad INNERHALB des Containers
SOUNDFONT_PATH=/app/soundfonts/alex_gm.sf2

# Output - Pfad INNERHALB des Containers
OUTPUT_DIRECTORY=/app/output
TEMP_DIRECTORY=/app/temp

# Processing - Server-Ressourcen
CONCURRENCY=8
```

### 3. Soundfont platzieren

```bash
cp /pfad/zu/alex_gm.sf2 data/soundfonts/
```

### 4. Docker Image bauen und starten

```bash
# Build
docker-compose build

# Start im Hintergrund
docker-compose up -d

# Logs ansehen
docker-compose logs -f
```

## Verwendung

### Einmalige Verarbeitung

```bash
docker-compose run --rm midi-converter node src/index.js --limit 100 --concurrency 8
```

### Kontinuierliche Verarbeitung

Der Container läuft standardmäßig mit der Konfiguration aus `.env`:

```bash
# Fortschritt überwachen
docker-compose logs -f midi-converter

# Container stoppen
docker-compose stop

# Container neu starten
docker-compose restart
```

### Mit Custom-Argumenten starten

Passen Sie `docker-compose.yml` an:

```yaml
services:
  midi-converter:
    # ...
    command: ["node", "src/index.js", "--limit", "1000", "--concurrency", "8"]
```

## Resource Management

### CPU und Memory Limits anpassen

In `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '16'      # Max CPU-Kerne
      memory: 8G      # Max RAM
    reservations:
      cpus: '8'       # Reservierte Kerne
      memory: 4G      # Reserviertes RAM
```

### Für Server mit vielen Kernen

```env
# In config/.env
CONCURRENCY=16  # Oder höher, je nach CPU
```

## Monitoring

### Container Status

```bash
docker-compose ps
docker stats midi-to-audio-converter
```

### Logs

```bash
# Live logs
docker-compose logs -f

# Letzte 100 Zeilen
docker-compose logs --tail=100

# Nur Errors
docker-compose logs | grep ERROR
```

### Output überprüfen

```bash
ls -lh data/output/
du -sh data/output/
```

## Backup & Cleanup

### Output sichern

```bash
tar -czf midi-output-$(date +%Y%m%d).tar.gz data/output/
```

### Temporäre Dateien aufräumen

```bash
# Temp-Volume leeren
docker-compose down -v
docker-compose up -d
```

### Logs rotieren

Logs werden automatisch rotiert (max 3 Dateien à 10 MB).

## Troubleshooting

### Container startet nicht

```bash
# Detaillierte Logs
docker-compose logs midi-converter

# Container-Details
docker inspect midi-to-audio-converter
```

### Permission-Probleme

```bash
# Ownership anpassen
sudo chown -R 1001:1001 data/output data/logs
```

### MongoDB-Verbindung

```bash
# Von Container aus testen
docker-compose exec midi-converter ping mongodb-host
docker-compose exec midi-converter node src/inspect.js
```

### Out of Memory

Erhöhen Sie Memory-Limit in `docker-compose.yml` oder reduzieren Sie `CONCURRENCY`.

## Produktions-Tipps

1. **Regelmäßige Backups**: Automatisieren Sie Output-Backups
2. **Monitoring**: Nutzen Sie Prometheus/Grafana für Metriken
3. **Disk Space**: Überwachen Sie `/app/output` Größe
4. **Updates**: Regelmäßig `docker-compose pull && docker-compose up -d`

## Performance-Optimierung

### Tmpfs für bessere I/O

In `docker-compose.yml`:

```yaml
volumes:
  - type: tmpfs
    target: /app/temp
    tmpfs:
      size: 2G
```

### Bind Mount vs Volume

Für Output können Sie auch Bind-Mount verwenden:

```yaml
volumes:
  - /mnt/storage/midi-output:/app/output
```

## Skalierung

Für mehrere Container parallel:

```yaml
services:
  midi-converter:
    # ...
    deploy:
      replicas: 3  # Docker Swarm
```

Oder manuell mehrere Instanzen mit unterschiedlichen Filtern:

```bash
docker-compose run -d --name converter-1 midi-converter node src/index.js --filter '{"musicLLM.artist": {"$regex": "^[A-M]"}}'
docker-compose run -d --name converter-2 midi-converter node src/index.js --filter '{"musicLLM.artist": {"$regex": "^[N-Z]"}}'
```
