# Build stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache bash python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY node/package*.json ./node/
COPY node/packages/*/package*.json ./node/packages/*/

# Install dependencies
RUN npm ci --legacy-peer-deps
RUN cd node && npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application (without formatting for faster builds)
RUN ./build.sh --no-format

# Production stage
FROM node:22-alpine

# Install runtime dependencies
RUN apk add --no-cache bash

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node/package*.json ./node/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node/node_modules ./node/node_modules
COPY --from=builder /app/node/packages ./node/packages
COPY --from=builder /app/database ./database
COPY --from=builder /app/agents ./agents
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/*.sh ./
COPY --from=builder /app/knexfile.js ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose ports
EXPOSE 5002 8080 50051

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5002/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start the application
CMD ["./start.sh"]