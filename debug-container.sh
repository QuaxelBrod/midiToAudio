#!/bin/sh
echo "=== Container Debug Script ==="
echo ""

echo "1. Node.js Version:"
node --version
echo ""

echo "2. Working Directory:"
pwd
ls -la
echo ""

echo "3. Source files:"
ls -la src/
echo ""

echo "4. Node modules installed?"
ls -la node_modules/ | head -20
echo ""

echo "5. .env file content (safe parts):"
grep -v "MONGODB_URI\|PASSWORD" /app/.env || echo ".env not found or empty"
echo ""

echo "6. Test basic node:"
node -e "console.log('Node.js works!')"
echo ""

echo "7. Test dotenv import:"
node -e "require('dotenv'); console.log('dotenv works!')"
echo ""

echo "8. Test config import:"
node -e "try { require('./src/config.js'); console.log('config loaded'); } catch(e) { console.error('Config error:', e.message); }"
echo ""

echo "9. Test main import:"
node -e "try { require('./src/index.js'); console.log('index loaded'); } catch(e) { console.error('Index error:', e.message); }"
echo ""

echo "=== End Debug ==="
