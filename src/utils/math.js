// src/utils/math.js

// Konfigurasi Tracking
export const MATCH_IOU = 0.3;        // Ambang IoU untuk menganggap objek sama
export const TRACK_TTL_MS = 400;     // Waktu hidup track jika objek hilang
export const LERP_SPEED_PER_SEC = 8; // Kecepatan smoothing (8-12 enak)

export function classColorFromId(id) {
  const h = (Math.abs(id) * 137.508) % 360;
  return `hsl(${h}deg 90% 55%)`;
}

export function iou(a, b) {
  // a,b dalam {x,y,w,h}
  const ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx2 = b.x + b.w, by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

// Logika memperbarui track lama dengan deteksi baru
export function matchDetectionsToTracks(currentTracks, newDetections, nextIdRef) {
  const now = performance.now();
  const tracks = [...currentTracks];

  // Reset flag matched
  tracks.forEach(tr => tr._matched = false);

  // Format deteksi baru
  const detBoxes = newDetections.map(d => ({
    x: d.x1, y: d.y1, w: d.x2 - d.x1, h: d.y2 - d.y1,
    score: d.score ?? 0,
    classId: Math.round(d.classId ?? -1),
    className: d.className
  }));

  // Greedy matching
  for (const db of detBoxes) {
    let best = null;
    let bestIoU = 0;
    
    for (const tr of tracks) {
      if (tr._matched || tr.classId !== db.classId) continue;
      const val = iou(tr.target, db);
      if (val > bestIoU) { bestIoU = val; best = tr; }
    }

    if (best && bestIoU >= MATCH_IOU) {
      // Update track yang cocok
      best.target = { x: db.x, y: db.y, w: db.w, h: db.h };
      best.score = best.score * 0.7 + db.score * 0.3; // Weighted average score
      best.lastSeen = now;
      best._matched = true;
    } else {
      // Buat track baru
      tracks.push({
        id: nextIdRef.current++,
        classId: db.classId,
        className: db.className,
        score: db.score,
        lastSeen: now,
        display: { ...db }, // Mulai dari posisi deteksi
        target: { ...db },
        _matched: true
      });
    }
  }

  // Hapus track kadaluwarsa
  return tracks.filter(tr => (now - tr.lastSeen) <= TRACK_TTL_MS);
}