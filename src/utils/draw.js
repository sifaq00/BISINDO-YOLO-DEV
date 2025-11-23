// src/utils/draw.js
import { classColorFromId, LERP_SPEED_PER_SEC, TRACK_TTL_MS } from "./math";

const MAX_CANVAS_DPR = 1.5;
const FONT_SCALE = 4.0;

export function drawOverlay(ctx, canvas, video, tracksRef, labels) {
  if (!video || !canvas || !ctx) return;

  const rect = canvas.getBoundingClientRect();
  const wCss = rect.width;
  const hCss = rect.height;

  // Setup resolusi canvas
  const dpr = Math.min(MAX_CANVAS_DPR, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(wCss * dpr) || canvas.height !== Math.round(hCss * dpr)) {
    canvas.width = Math.round(wCss * dpr);
    canvas.height = Math.round(hCss * dpr);
  }
  
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, wCss, hCss);

  // Letterboxing calculation
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const scale = Math.min(wCss / vw, hCss / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const offX = (wCss - drawW) / 2;
  const offY = (hCss - drawH) / 2;

  // Style setup
  const minSide = Math.min(drawW, drawH);
  const lineW = Math.max(6, Math.round(minSide / 110));
  const fontPx = Math.max(20, Math.round(lineW * FONT_SCALE));
  const padX = Math.max(10, Math.round(lineW * 2.0));
  const padY = Math.max(6, Math.round(lineW * 1.2));

  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.font = `600 ${fontPx}px Inter, Arial, sans-serif`;

  // --- LERP Logic (Animation) ---
  const now = performance.now();
  // Ambil track yang masih aktif saja
  let tracks = tracksRef.current.filter(tr => (now - tr.lastSeen) <= TRACK_TTL_MS);
  
  // Hitung delta time (capped 100ms)
  const dt = 0.016; // Asumsi ~60fps untuk simplifikasi, atau hitung real dt
  const k = 1 - Math.exp(-LERP_SPEED_PER_SEC * dt);

  for (const tr of tracks) {
    // Interpolasi posisi display menuju target
    tr.display.x += (tr.target.x - tr.display.x) * k;
    tr.display.y += (tr.target.y - tr.display.y) * k;
    tr.display.w += (tr.target.w - tr.display.w) * k;
    tr.display.h += (tr.target.h - tr.display.h) * k;

    // Gambar Bbox
    const { x, y, w, h } = tr.display;
    const sx = offX + x * scale;
    const sy = offY + y * scale;
    const sw = w * scale;
    const sh = h * scale;

    const color = classColorFromId(tr.classId);
    
    ctx.lineWidth = lineW;
    ctx.strokeStyle = color;
    ctx.strokeRect(sx, sy, sw, sh);

    // Gambar Label
    const label = tr.className ?? labels[tr.classId] ?? `cls ${tr.classId}`;
    const text = `${label} (${tr.score.toFixed(2)})`;
    const tw = ctx.measureText(text).width;
    const th = fontPx + padY;

    let lx = sx - Math.floor(lineW / 2);
    let ly = sy - th - lineW;
    if (ly < offY + lineW) ly = sy + lineW;

    ctx.fillStyle = color;
    ctx.fillRect(lx, ly, tw + padX, th);
    ctx.fillStyle = "#000";
    ctx.fillText(text, lx + Math.round(padX / 2), ly + Math.round((th - fontPx) / 2));
  }
  
  // Update ref dengan track yang sudah diproses
  tracksRef.current = tracks;
}