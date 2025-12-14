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

# Default command
CMD ["node", "src/index.js"]
