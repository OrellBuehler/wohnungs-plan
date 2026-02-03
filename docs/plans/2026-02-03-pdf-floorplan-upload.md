# PDF Floorplan Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to upload PDF floorplans that are automatically converted to PNG images on the server.

**Architecture:** Extend the existing floorplan upload endpoint to detect PDF files, convert the first page to PNG using UnPDF, and save the result using existing image handling code. The conversion is transparent - PDFs flow through the same validation, storage, and serving infrastructure as regular images.

**Tech Stack:** UnPDF (PDF processing), pdfjs-dist (PDF parsing), @napi-rs/canvas (Node.js rendering), SvelteKit (existing backend)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install PDF processing libraries**

Run:
```bash
bun add unpdf pdfjs-dist @napi-rs/canvas
```

Expected: Dependencies added to package.json and node_modules installed

**Step 2: Verify installation**

Run:
```bash
bun run check
```

Expected: No type errors, project compiles successfully

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "deps: add PDF processing libraries (unpdf, pdfjs-dist, @napi-rs/canvas)"
```

---

## Task 2: Add PDF Detection Function

**Files:**
- Modify: `src/routes/api/projects/[id]/floorplan/+server.ts:15-58`

**Step 1: Add PDF magic byte detection function**

Add this function after `detectImageMime` (around line 58):

```typescript
function detectPdfMime(buffer: Buffer): boolean {
	if (buffer.length < 4) return false;
	// PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
	return (
		buffer[0] === 0x25 && // %
		buffer[1] === 0x50 && // P
		buffer[2] === 0x44 && // D
		buffer[3] === 0x46    // F
	);
}
```

**Step 2: Type-check**

Run:
```bash
bun run check
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/routes/api/projects/[id]/floorplan/+server.ts
git commit -m "feat: add PDF magic byte detection"
```

---

## Task 3: Add PDF to Image Conversion Function

**Files:**
- Modify: `src/routes/api/projects/[id]/floorplan/+server.ts:59`

**Step 1: Import UnPDF dependencies**

Add imports at the top of the file (after line 5):

```typescript
import { definePDFJSModule, renderPageAsImage } from 'unpdf';
```

**Step 2: Add PDF conversion function**

Add this function after `detectPdfMime`:

```typescript
async function convertPdfToImage(pdfBuffer: Buffer): Promise<Buffer> {
	// Initialize UnPDF with pdfjs-dist (only runs once)
	await definePDFJSModule(() => import('pdfjs-dist'));

	// Render first page to PNG at 1x scale
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

**Step 3: Type-check**

Run:
```bash
bun run check
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/routes/api/projects/[id]/floorplan/+server.ts
git commit -m "feat: add PDF to PNG conversion function"
```

---

## Task 4: Update POST Handler to Support PDF Uploads

**Files:**
- Modify: `src/routes/api/projects/[id]/floorplan/+server.ts:60-98`

**Step 1: Detect PDF and convert before validation**

Replace the POST handler's file processing logic (lines 77-88) with:

```typescript
	if (file.size > config.uploads.maxImageSize) {
		throw error(413, `File too large. Maximum size: ${config.uploads.maxImageSize / 1024 / 1024}MB`);
	}

	let buffer = Buffer.from(await file.arrayBuffer());
	let mimeType: string;
	let originalFileSize = file.size;

	// Check if PDF, convert if needed
	if (detectPdfMime(buffer)) {
		try {
			buffer = await convertPdfToImage(buffer);
			mimeType = 'image/png';
		} catch (err) {
			console.error('PDF conversion failed:', err);
			throw error(400, 'Invalid or corrupt PDF file');
		}
	} else {
		// Existing image detection
		const detectedMime = detectImageMime(buffer);
		if (!detectedMime || !(detectedMime in EXT_BY_MIME)) {
			throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF');
		}
		mimeType = detectedMime;
	}

	const filename = `${crypto.randomUUID()}.${mimeType === 'image/png' ? 'png' : EXT_BY_MIME[mimeType as keyof typeof EXT_BY_MIME]}`;

	await saveFloorplanFile(params.id, filename, buffer);

	const floorplan = await createFloorplan(params.id, {
		filename,
		originalName: file.name,
		mimeType,
		sizeBytes: originalFileSize
	});
```

**Step 2: Type-check**

Run:
```bash
bun run check
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/routes/api/projects/[id]/floorplan/+server.ts
git commit -m "feat: integrate PDF conversion into floorplan POST handler"
```

---

## Task 5: Manual Testing

**Files:**
- None (testing only)

**Step 1: Start development server**

Run:
```bash
bun dev
```

Expected: Server starts on port 5173 (or configured port)

**Step 2: Test PDF upload**

1. Navigate to a project in the browser
2. Upload a single-page PDF floorplan
3. Verify the floorplan appears as an image
4. Check the uploads directory contains a .png file

Expected: PDF converts successfully and displays as floorplan

**Step 3: Test multi-page PDF**

1. Upload a multi-page PDF
2. Verify only the first page is used

Expected: First page extracted, rest ignored

**Step 4: Test invalid PDF**

1. Rename a .txt file to .pdf
2. Upload it
3. Verify error message: "Invalid or corrupt PDF file"

Expected: 400 error with appropriate message

**Step 5: Test image uploads still work**

1. Upload a regular PNG image
2. Upload a JPEG image
3. Verify both work normally

Expected: Image uploads unchanged, backward compatible

**Step 6: Stop server**

Press Ctrl+C

**Step 7: Document testing results**

Create a brief note in `docs/plans/2026-02-03-pdf-upload-testing-notes.md`:

```markdown
# PDF Upload Testing Results

## Date: [Current Date]

### Tests Passed:
- [ ] Single-page PDF upload
- [ ] Multi-page PDF upload (first page only)
- [ ] Invalid PDF rejection
- [ ] PNG upload (backward compatibility)
- [ ] JPEG upload (backward compatibility)

### Issues Found:
[List any issues discovered]

### Performance:
- PDF conversion time: [X seconds for typical architectural plan]
```

**Step 8: Commit testing notes**

```bash
git add docs/plans/2026-02-03-pdf-upload-testing-notes.md
git commit -m "docs: add PDF upload testing results"
```

---

## Task 6: Error Handling Review

**Files:**
- Modify: `src/routes/api/projects/[id]/floorplan/+server.ts`

**Step 1: Review error scenarios**

Verify these error cases are handled in the POST handler:
- ✅ File too large (line 77-79): Existing validation catches PDFs too
- ✅ Invalid PDF (Task 4): Try-catch with appropriate error
- ✅ Corrupt PDF (Task 4): Caught by conversion error
- ✅ Invalid image (line 83-85): Error message updated to include PDF

**Step 2: Update error message for invalid file types**

The error message was already updated in Task 4 to include PDF:
```typescript
throw error(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF');
```

**Step 3: Verify error handling works**

Run type-check:
```bash
bun run check
```

Expected: No type errors

**Step 4: Commit if any changes made**

If you made adjustments:
```bash
git add src/routes/api/projects/[id]/floorplan/+server.ts
git commit -m "fix: improve error handling for PDF uploads"
```

Otherwise, skip this step.

---

## Final Checklist

- [ ] Dependencies installed (unpdf, pdfjs-dist, @napi-rs/canvas)
- [ ] PDF detection function added
- [ ] PDF conversion function added
- [ ] POST handler updated to handle PDFs
- [ ] Manual testing completed
- [ ] Error handling verified
- [ ] All commits follow conventional commit format
- [ ] Type-check passes (`bun run check`)
- [ ] Development server runs without errors

---

## Success Criteria

✅ Users can upload PDF floorplans
✅ First page automatically converts to PNG
✅ Image uploads still work (backward compatible)
✅ Appropriate errors for invalid/corrupt PDFs
✅ No database or storage changes required
✅ Type-safe TypeScript implementation

## Next Steps (Post-Implementation)

1. Monitor production logs for PDF conversion errors
2. Consider adding loading indicator in frontend for PDF uploads
3. Gather user feedback on conversion quality
4. Consider adding support for page selection (future enhancement)
