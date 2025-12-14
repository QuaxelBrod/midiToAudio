#!/bin/bash
set -e

echo "🐳 MIDI to Audio Converter - Docker Setup"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose first."
    exit 1
fi

echo "✅ Docker and docker-compose found"
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p config data/{output,soundfonts,logs}
echo "✅ Directories created"
echo ""

# Copy .env.example if .env doesn't exist in config
if [ ! -f config/.env ]; then
    if [ -f .env.example ]; then
        echo "📋 Copying .env.example to config/.env..."
        cp .env.example config/.env
        echo "✅ Config file created"
        echo ""
        echo "⚠️  IMPORTANT: Edit config/.env with your settings:"
        echo "   - MONGODB_URI"
        echo "   - SOUNDFONT_PATH"
        echo "   - CONCURRENCY"
        echo ""
    else
        echo "⚠️  .env.example not found. Please create config/.env manually."
    fi
else
    echo "✅ Config file already exists"
fi

# Check for soundfont
echo "🎵 Checking for soundfont..."
SOUNDFONT_COUNT=$(find data/soundfonts -name "*.sf2" -o -name "*.sf3" 2>/dev/null | wc -l)
if [ "$SOUNDFONT_COUNT" -eq 0 ]; then
    echo "⚠️  No soundfont found in data/soundfonts/"
    echo "   Please copy your .sf2 or .sf3 file to data/soundfonts/"
    echo ""
else
    echo "✅ Found $SOUNDFONT_COUNT soundfont(s)"
    echo ""
fi

# Build Docker image
echo "🔨 Building Docker image..."
docker-compose build
echo "✅ Docker image built"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit config/.env with your MongoDB connection and settings"
echo "2. Copy your soundfont to data/soundfonts/ (if not done)"
echo "3. Start the container: docker-compose up -d"
echo "4. Monitor logs: docker-compose logs -f"
echo ""
echo "For more information, see DOCKER.md"
