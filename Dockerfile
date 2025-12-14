# Multi-stage build for smaller final image
FROM node:20-alpine AS base

# Install FFmpeg and FluidSynth
RUN apk add --no-cache \
    ffmpeg \
    fluidsynth \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Create necessary directories
RUN mkdir -p /app/output /app/temp /app/logs /app/soundfonts

# Set environment variables
ENV NODE_ENV=production

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Default command
CMD ["node", "src/index.js"]
