import { useEffect, useRef } from "react";
// Import icon tambahan MdVideocamOff
import { MdCameraswitch, MdVideocamOff } from "react-icons/md"; 
import labels from "../utils/labels.json";

// Imports logika
import { useWebcam } from "../hooks/useWebcam";
import { useDetection } from "../hooks/useDetection";
import { matchDetectionsToTracks } from "../utils/math";
import { drawOverlay } from "../utils/draw";

export default function WebcamDetection() {
  // 1. Setup Webcam
  const { 
    videoRef, canvasRef, cameraOn, facing, switching, camFps, 
    startWebcam, stopWebcam, switchCamera 
  } = useWebcam();

  // 2. Setup State Tracking
  const tracksRef = useRef([]);
  const nextTrackId = useRef(1);

  // Callback saat ada data dari API
  const handleDetections = (detections) => {
    tracksRef.current = matchDetectionsToTracks(tracksRef.current, detections, nextTrackId);
  };

  // 3. Setup Detection Loop
  const { fps: serverFps } = useDetection(videoRef, cameraOn, handleDetections);

  // 4. Setup Animation Loop (Drawing) & Pembersih Canvas
  useEffect(() => {
    let rafId;

    const loop = () => {
      // Hanya menggambar jika kamera NYALA
      if (cameraOn && canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext("2d", { alpha: true });
        drawOverlay(ctx, canvasRef.current, videoRef.current, tracksRef, labels);
        rafId = requestAnimationFrame(loop);
      }
    };

    if (cameraOn) {
      loop();
    } else {
      // --- FIX PENTING: BERSIHKAN CANVAS SAAT MATI ---
      // Ini menghapus kotak hijau yang "nyangkut" saat tombol stop ditekan
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      // Reset data tracking agar bersih saat dinyalakan kembali
      tracksRef.current = [];
    }

    return () => {
      cancelAnimationFrame(rafId);
      // Bersihkan juga saat component unmount (pindah halaman)
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [cameraOn]);

  return (
    <div className="relative w-full">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!cameraOn ? (
          <button onClick={startWebcam} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            Nyalakan Kamera
          </button>
        ) : (
          <button onClick={stopWebcam} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors">
            Matikan Kamera
          </button>
        )}
        <span className="text-sm opacity-70">
          Mode: {facing === "user" ? "Depan" : "Belakang"} {switching && "(beralih…)"}
        </span>
      </div>

      {/* Video Container */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-gray-900 border border-white/10">
        
        {/* --- TAMPILAN SAAT KAMERA MATI (Placeholder Icon) --- */}
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 z-0 select-none">
            <MdVideocamOff className="text-7xl md:text-9xl mb-4" />
            <p className="text-sm md:text-lg font-medium">Kamera Nonaktif</p>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay muted playsInline
          // Tambahkan class 'opacity-0' saat kamera mati supaya ikon di belakangnya kelihatan
          className={`absolute inset-0 w-full h-full object-contain z-10 transition-opacity duration-300 ${!cameraOn ? 'opacity-0' : 'opacity-100'}`}
        />
        
        {/* Canvas Element (Overlay Deteksi) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
        />

        {/* Switch Button */}
        <button
          onClick={() => switchCamera(facing === "user" ? "environment" : "user")}
          disabled={!cameraOn || switching}
          className="absolute right-3 bottom-3 z-30 grid place-items-center w-12 h-12 rounded-full bg-black/60 text-white hover:bg-black/70 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
        >
          <MdCameraswitch className={`text-2xl ${switching ? "animate-spin" : ""}`} />
        </button>

        {/* Info Badge (Hanya muncul saat kamera nyala) */}
        {cameraOn && (
          <div className="absolute left-3 top-3 z-30 px-2 py-1 rounded bg-black/60 text-white text-xs backdrop-blur pointer-events-none">
            API FPS: {serverFps} | Cam FPS: {camFps.toFixed(0)}
          </div>
        )}
      </div>
    </div>
  );
}