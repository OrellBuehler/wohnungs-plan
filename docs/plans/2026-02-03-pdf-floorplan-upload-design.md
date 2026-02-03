# PDF Floorplan Upload Design

**Date:** 2026-02-03
**Status:** Approved

## Problem Statement

Users have architectural floorplans in PDF format and shouldn't need to manually convert them to images before uploading. This creates friction in the user experience.

## Solution

Extend the existing floorplan upload endpoint to accept PDF files and automatically convert them to PNG images on the server. The conversion is transparent to the user - PDF goes in, floorplan image comes out.

## User Experience

1. User uploads a PDF file through the existing upload interface
2. Server automatically converts the first page to PNG
3. User sees a regular floorplan image (no indication it was a PDF)
4. All existing features work normally (scale setting, editing, etc.)

## Technical Approach

### Architecture

- **Server-side conversion** using UnPDF library
- **Transparent integration** - extends existing upload endpoint
- **No storage changes** - saves PNG, discards original PDF
- **Same auth model** - requires account + edit access

### Dependencies

```bash
bun add unpdf pdfjs-dist @napi-rs/canvas
```

- `unpdf` - PDF processing optimized for serverless
- `pdfjs-dist` - Mozilla's PDF.js for parsing
- `@napi-rs/canvas` - Node.js canvas for rendering

### Conversion Specifications

- **Multi-page handling:** First page only, ignore remaining pages
- **Output format:** PNG (via UnPDF rendering)
- **Resolution:** 1x scale (matches original PDF dimensions)
- **File size limit:** Same as images (existing `maxImageSize` config)

### Implementation Flow

```
1. User uploads PDF via FormData to /api/projects/[id]/floorplan
2. Server validates:
   - File size (existing validation)
   - MIME type via magic bytes (PDF: %PDF / 0x25 0x50 0x44 0x46)
3. If PDF detected:
   a. Load PDF with UnPDF
   b. Render first page to PNG buffer (scale: 1.0)
   c. Replace buffer with PNG data
   d. Set mimeType to 'image/png'
   e. Generate filename: {uuid}.png
4. Save PNG to filesystem (existing saveFloorplanFile)
5. Store metadata in database (existing createFloorplan)
6. Return floorplan object to client
```

### Code Changes

**Modified files:**

1. `src/routes/api/projects/[id]/floorplan/+server.ts`
   - Add `'application/pdf'` to `ALLOWED_MIME_TYPES`
   - Add `detectPdfMime()` function
   - Add `convertPdfToImage()` function
   - Update POST handler to detect and convert PDFs

**No changes needed:**
- Database schema (already stores PNG metadata)
- File storage structure (stores PNG files)
- Image serving endpoints (serve PNG files)
- Frontend components (display PNG images)

### New Functions

```typescript
function detectPdfMime(buffer: Buffer): boolean {
  // Check for PDF magic bytes: %PDF
  if (buffer.length < 4) return false;
  return buffer[0] === 0x25 && // %
         buffer[1] === 0x50 && // P
         buffer[2] === 0x44 && // D
         buffer[3] === 0x46;   // F
}

async function convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
  // Initialize UnPDF with pdfjs-dist
  await definePDFJSModule(() => import('pdfjs-dist'));

  // Render first page to PNG
  const imageBuffer = await renderPageAsImage(
    new Uint8Array(pdfBuffer),
    1, // First page
    {
      canvasImport: () => import('@napi-rs/canvas'),
      scale: 1.0
    }
  );

  return Buffer.from(new Uint8Array(imageBuffer));
}
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Invalid/corrupt PDF | 400 "Invalid PDF file" |
| Empty PDF (0 pages) | 400 "PDF contains no pages" |
| PDF too large | 413 "File too large" (existing validation) |
| Conversion failure | 500 with logged error details |

## Testing

### Test Scenarios

1. **Happy path:**
   - Single-page PDF → converts successfully
   - Multi-page PDF → uses first page
   - Regular image → works as before

2. **Edge cases:**
   - Empty PDF → error
   - Corrupted PDF → error
   - Oversized PDF → error
   - Non-standard page sizes → handled by UnPDF

3. **Security:**
   - Magic byte detection prevents fake PDFs
   - Same auth/permissions as images
   - Buffer validation for safe memory handling

## Performance

- **Conversion time:** ~1-3 seconds for typical architectural plans
- **Processing:** Synchronous in request handler (keeps code simple)
- **Frontend:** Should show loading indicator during upload
- **Future optimization:** Could move to background job if needed

## Rollout

- ✅ No database migration required
- ✅ No breaking API changes
- ✅ Frontend immediately supports PDFs
- ✅ Backward compatible (images still work)

## Alternatives Considered

1. **Client-side conversion** - Rejected: slower for users, more complex frontend
2. **Store original PDF** - Rejected: unnecessary storage, added complexity
3. **External service** - Rejected: cost, dependency, privacy concerns

## Success Criteria

- Users can upload PDF floorplans without manual conversion
- Conversion is transparent and reliable
- No impact on existing image upload functionality
- Performance is acceptable (<5 seconds for typical PDFs)
