# Social Sharing for Floorplanner

## Overview

Enable rich social media previews when sharing Floorplanner links. Two scenarios:

| URL | Title | Image |
|-----|-------|-------|
| `floorplanner.orellbuehler.ch` | "Floorplanner" | Static branded image |
| `/projects/[id]` | "[Project Name] - Floorplanner" | Generated thumbnail |

## Architecture

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/components/SEO.svelte` | Reusable meta tags component |
| `src/routes/+layout.svelte` | Default SEO for app (modify existing) |
| `src/routes/projects/[id]/+page.server.ts` | Project-specific metadata |
| `src/routes/api/thumbnails/+server.ts` | Save generated thumbnails |
| `static/og-image.png` | Default sharing image (manual creation) |
| `static/thumbnails/` | Directory for generated project thumbnails |

### SEO Component

`src/lib/components/SEO.svelte`:

```svelte
<script lang="ts">
  interface Props {
    title: string;
    description: string;
    image?: string;
    url?: string;
  }
  let { title, description, image, url }: Props = $props();
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />
  <meta property="og:url" content={url} />
  <meta property="og:type" content="website" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
</svelte:head>
```

### Thumbnail Generation

**API Endpoint** (`src/routes/api/thumbnails/+server.ts`):

```typescript
import { json } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function POST({ request }) {
  const { projectId, imageData } = await request.json();

  // Ensure thumbnails directory exists
  const dir = 'static/thumbnails';
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // Decode base64 and save to static folder
  const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
  const filePath = `${dir}/${projectId}.png`;

  await writeFile(filePath, Buffer.from(base64Data, 'base64'));

  return json({ success: true });
}
```

**Client-side trigger** (integrate into existing canvas save logic):

```typescript
async function saveThumbnail(projectId: string) {
  const dataUrl = stage.toDataURL({ pixelRatio: 0.5 });
  await fetch('/api/thumbnails', {
    method: 'POST',
    body: JSON.stringify({ projectId, imageData: dataUrl })
  });
}
```

### Project Page Metadata

`src/routes/projects/[id]/+page.server.ts`:

```typescript
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function load({ params }) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, params.id)
  });

  if (!project) {
    return { seo: null };
  }

  const baseUrl = 'https://floorplanner.orellbuehler.ch';

  return {
    seo: {
      title: `${project.name} - Floorplanner`,
      description: 'View this floor plan on Floorplanner',
      image: `${baseUrl}/thumbnails/${project.id}.png`,
      url: `${baseUrl}/projects/${project.id}`
    }
  };
}
```

### Default App Metadata

Modify `src/routes/+layout.svelte` to include default SEO:

```svelte
<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';
  let { data, children } = $props();
</script>

{#if !data.seo}
  <SEO
    title="Floorplanner"
    description="Create and share floor plans for your apartment"
    image="https://floorplanner.orellbuehler.ch/og-image.png"
    url="https://floorplanner.orellbuehler.ch"
  />
{/if}

{@render children()}
```

## Manual Steps

1. Create `static/og-image.png` (1200×630px) with Floorplanner branding
2. Create `static/thumbnails/` directory (or let API create it)

## Future Considerations

- Landing page SEO (separate task)
- Sitemap generation
- Structured data (JSON-LD)
