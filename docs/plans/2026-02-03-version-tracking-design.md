# Version Tracking Design

**Date:** 2026-02-03
**Status:** Approved

## Overview

Track deployed versions by embedding git commit hash and build timestamp in HTML and Docker container. This enables quick identification of which code version is running in any environment.

## Requirements

1. Display git hash + build timestamp in HTML (invisible to users)
2. Store version info inside Docker container for inspection
3. Inject version during CI/CD build process
4. Work with GitHub Actions or similar CI/CD pipelines

## Architecture

### Flow

```
CI/CD Pipeline
  ↓
Get git hash (git rev-parse --short HEAD)
Get build timestamp (ISO 8601 format)
  ↓
Docker build with --build-arg
  ↓
Dockerfile accepts args, sets as ENV vars
  ↓
SvelteKit build embeds VITE_* env vars
  ↓
Output:
  - HTML comment in <head>: <!-- version: abc1234 | built: 2026-02-03T10:30:00Z -->
  - /app/version.txt in container: GIT_HASH=abc1234\nBUILD_TIMESTAMP=2026-02-03T10:30:00Z
```

### Key Principles

- **Build-time injection**: Version info baked into build, not runtime
- **Multiple access points**: Browser (HTML comment) + container (version.txt)
- **CI/CD agnostic**: Uses standard Docker build args
- **Fallback values**: Shows "dev" in development, actual values in production

## Implementation

### 1. SvelteKit HTML Comment

**File:** `src/routes/+layout.svelte`

Add to `<svelte:head>` section:

```svelte
<svelte:head>
  <!-- version: {import.meta.env.VITE_GIT_HASH || 'dev'} | built: {import.meta.env.VITE_BUILD_TIMESTAMP || 'dev'} -->
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />
  ...
</svelte:head>
```

**How it works:**
- Vite embeds `import.meta.env.VITE_*` variables at build time
- Variables come from environment during `bun build`
- Comment is in final HTML, visible in View Source
- Development mode shows "dev" for both values

### 2. Dockerfile Updates

**File:** `Dockerfile`

**Changes in builder stage:**

```dockerfile
# Build stage - build the app
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Accept build arguments
ARG GIT_HASH=unknown
ARG BUILD_TIMESTAMP=unknown

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for Vite
ENV VITE_GIT_HASH=${GIT_HASH}
ENV VITE_BUILD_TIMESTAMP=${BUILD_TIMESTAMP}

# Build the application (Vite will embed VITE_* vars)
RUN bun --bun run build

# Write version info to file for container inspection
RUN echo "GIT_HASH=${GIT_HASH}" > /app/version.txt && \
    echo "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}" >> /app/version.txt
```

**Changes in runner stage:**

```dockerfile
# Copy version file
COPY --from=builder --chown=sveltekit:nodejs /app/version.txt ./
```

**How it works:**
1. Docker build receives `--build-arg GIT_HASH=...` and `--build-arg BUILD_TIMESTAMP=...`
2. ARG variables are set with defaults ("unknown" if not provided)
3. ENV variables prefixed with `VITE_` are set from ARG values
4. During `bun build`, Vite embeds these env vars in the bundle
5. Version info written to `/app/version.txt` for runtime inspection
6. File copied to final runner stage

### 3. CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          GIT_HASH=$(git rev-parse --short HEAD)
          BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

          docker build \
            --build-arg GIT_HASH=$GIT_HASH \
            --build-arg BUILD_TIMESTAMP=$BUILD_TIMESTAMP \
            -t floorplanner:$GIT_HASH \
            -t floorplanner:latest \
            .
```

**Manual Build (for testing):**

```bash
docker build \
  --build-arg GIT_HASH=$(git rev-parse --short HEAD) \
  --build-arg BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t floorplanner:latest \
  .
```

**Verification:**

Test the build:
```bash
# Build
docker build --build-arg GIT_HASH=abc1234 --build-arg BUILD_TIMESTAMP=2026-02-03T10:30:00Z -t test .

# Run
docker run -p 3000:3000 test

# Check version in container
docker exec <container-id> cat /app/version.txt

# Check version in browser
# Visit http://localhost:3000
# View page source → Look for <!-- version: abc1234 | built: 2026-02-03T10:30:00Z -->
```

## Access Methods

### 1. Browser (User/Developer)

**View Source:**
- Right-click page → View Page Source
- Look in `<head>` section for comment
- Format: `<!-- version: abc1234 | built: 2026-02-03T10:30:00Z -->`

**DevTools:**
- F12 → Elements tab
- Expand `<head>` section
- Comment visible at top

### 2. Container Inspection (Operations)

**From host:**
```bash
docker exec <container-name> cat /app/version.txt
```

**From inside container:**
```bash
docker exec -it <container-name> sh
cat /app/version.txt
```

**Output format:**
```
GIT_HASH=abc1234
BUILD_TIMESTAMP=2026-02-03T10:30:00Z
```

### 3. Docker Image Inspection

```bash
docker inspect <image-name>
# Look for labels if we add them later
```

## Edge Cases

### Development Mode

- No build args provided → defaults to "unknown"
- Vite env vars not set → HTML shows "dev"
- version.txt contains "unknown" values

### Missing Git Information

- If `git rev-parse` fails → use fallback (e.g., "nogit")
- If in CI without git checkout → use `$GITHUB_SHA` or equivalent

### Multi-stage Builds

- Build args passed to builder stage only
- ENV vars set in builder stage only (for build)
- version.txt copied to runner stage for runtime access

## Future Enhancements

Potential additions (not in initial implementation):

1. **Docker labels**: Add version as image labels
2. **Health endpoint**: `/api/version` endpoint returning JSON
3. **Branch name**: Include git branch in version info
4. **Semantic versioning**: Link to package.json version
5. **Build number**: Include CI build number

## Success Criteria

- [ ] HTML comment visible in page source with correct git hash
- [ ] HTML comment shows correct build timestamp
- [ ] version.txt exists in container at `/app/version.txt`
- [ ] version.txt contains correct GIT_HASH
- [ ] version.txt contains correct BUILD_TIMESTAMP
- [ ] Development builds show "dev" in HTML
- [ ] Production builds show actual values
- [ ] No runtime performance impact
- [ ] CI/CD pipeline successfully passes build args

## Testing

1. **Local development**: Run `bun dev` → HTML shows "dev"
2. **Local build**: Run manual Docker build → verify HTML and version.txt
3. **CI/CD build**: Trigger pipeline → verify deployed version
4. **Container inspection**: `docker exec` → read version.txt
5. **Browser verification**: View source → find version comment
