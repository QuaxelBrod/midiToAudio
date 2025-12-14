#!/bin/sh
echo "=== TCP Connectivity Debug Script ==="
echo ""

# Extract URI from .env
URI=$(grep MONGODB_URI /app/.env | cut -d '=' -f2)
echo "URI found: $URI"

# Extract host and port
# Removing protocol
TEMP=${URI#*//}
# Extract host:port part
HOSTPORT=${TEMP%%/*}

echo "Target: $HOSTPORT"

# Node.js script to test TCP connection
cat <<EOF > /app/test-tcp.js
const net = require('net');

const target = '$HOSTPORT';
const [host, portPart] = target.split(':');
const port = portPart || 27017;

console.log(\`Testing TCP connection to \${host}:\${port}...\`);

const socket = new net.Socket();
socket.setTimeout(5000);

socket.on('connect', () => {
    console.log('✅ TCP Connection SUCCESS!');
    socket.destroy();
    process.exit(0);
});

socket.on('timeout', () => {
    console.log('❌ TCP Connection TIMEOUT');
    socket.destroy();
    process.exit(1);
});

socket.on('error', (err) => {
    console.log('❌ TCP Connection ERROR:', err.message);
    process.exit(1);
});

socket.connect(port, host);
EOF

echo "Running test..."
node /app/test-tcp.js
EXIT_CODE=$?

rm /app/test-tcp.js
exit $EXIT_CODE
