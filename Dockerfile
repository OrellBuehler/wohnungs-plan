# syntax=docker/dockerfile:1

# Build stage - install dependencies
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Build stage - build the app
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN bun --bun run build

# Production stage - minimal runtime
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R sveltekit:nodejs /app/uploads

# Copy built application
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./

# Switch to non-root user
USER sveltekit

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/me || exit 1

# Start the server
CMD ["bun", "./build/index.js"]
