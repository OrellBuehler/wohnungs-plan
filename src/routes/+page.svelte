<script lang="ts">
  import { Stage, Layer, Rect } from 'svelte-konva';
</script>

<main class="min-h-screen bg-slate-100 p-8">
  <h1 class="text-3xl font-bold text-slate-800 mb-4">Wohnungs-Plan</h1>
  <div class="bg-canvas-bg rounded-lg overflow-hidden" style="width: 600px; height: 400px;">
    <Stage width={600} height={400}>
      <Layer>
        <Rect x={50} y={50} width={100} height={80} fill="#D4A574" draggable />
      </Layer>
    </Stage>
  </div>
</main>
