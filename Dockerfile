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

# Accept build arguments for version tracking
ARG GIT_HASH=unknown
ARG BUILD_TIMESTAMP=unknown

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for Vite (will be embedded in build)
ENV VITE_GIT_HASH=${GIT_HASH}
ENV VITE_BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# Build the application
# SESSION_SECRET is needed at build time because SvelteKit evaluates server
# modules during SSR compilation. The actual secret is provided at runtime.
RUN SESSION_SECRET=build-placeholder bun --bun run build

# Write version info to file for container inspection
RUN echo "GIT_HASH=${GIT_HASH}" > /app/version.txt && \
    echo "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}" >> /app/version.txt

# Production deps - install only production dependencies
FROM oven/bun:1-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Production stage - minimal runtime
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R sveltekit:nodejs /app/uploads

# Copy built application and production node_modules (for native modules like sharp)
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./
COPY --from=prod-deps --chown=sveltekit:nodejs /app/node_modules ./node_modules

# Copy database migrations
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle ./drizzle

# Copy version info
COPY --from=builder --chown=sveltekit:nodejs /app/version.txt ./

# Switch to non-root user
USER sveltekit

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Point dynamic linker to bundled libvips from sharp's npm package
ENV LD_LIBRARY_PATH=/app/node_modules/@img/sharp-libvips-linuxmusl-x64/lib

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/me || exit 1

# Start the server
CMD ["bun", "./build/index.js"]
