import { useEffect, useRef, useState } from "react";
import { Camera, X, Zap, ZapOff, Video, RefreshCw, StopCircle } from "lucide-react"; 

import labels from "../utils/labels.json";
import { useWebcam } from "../hooks/useWebcam";
import { useDetection } from "../hooks/useDetection";
import { useHandPose } from "../hooks/useHandPose"; // Import Hook MediaPipe
import { matchDetectionsToTracks } from "../utils/math";
import { drawOverlay } from "../utils/draw"; 

export default function WebcamDetection() {
  const { 
    videoRef, canvasRef, cameraOn, facing, switching, camFps, 
    flashOn, supportsFlash, toggleFlash,
    startWebcam, stopWebcam, switchCamera 
  } = useWebcam();

  // 1. Panggil MediaPipe (Lokal)
  const { handPresence } = useHandPose(videoRef, cameraOn);

  const tracksRef = useRef([]);
  const nextTrackId = useRef(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDetections = (detections) => {
    tracksRef.current = matchDetectionsToTracks(tracksRef.current, detections, nextTrackId);
  };

  // 2. Pass 'handPresence' ke Detector Server
  const { fps: serverFps } = useDetection(videoRef, cameraOn, handleDetections, handPresence);

  const isMirrored = facing === "user";

  // 3. Loop Gambar (Hanya BBox YOLO, tidak ada skeleton)
  useEffect(() => {
    let rafId;
    const loop = () => {
      if (cameraOn && canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        // Render kotak deteksi
        drawOverlay(ctx, canvasRef.current, videoRef.current, tracksRef, labels, isMirrored, isMobile);
      }
      rafId = requestAnimationFrame(loop);
    };

    if (cameraOn) loop();
    else if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    return () => cancelAnimationFrame(rafId);
  }, [cameraOn, isMirrored, isMobile]); 

  const containerClass = isMobile && cameraOn
    ? "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center" 
    : "relative w-full max-w-4xl mx-auto bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-800 aspect-[3/4] md:aspect-video transition-all duration-300";

  const objectFitClass = isMobile ? "object-contain" : "object-cover";

  return (
    <div className="w-full p-4 flex justify-center">
      <div className={containerClass}>

        {/* HEADER MOBILE */}
        {isMobile && cameraOn && (
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-[60] bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg tracking-wider">BISINDO</span>
              <div className="flex gap-2 text-xs text-gray-300 font-mono mt-1">
                <span className="bg-white/10 px-2 py-0.5 rounded flex items-center gap-1">
                  <Video size={10} className="text-green-400" /> CAM: {camFps}
                </span>
                <span className="bg-white/10 px-2 py-0.5 rounded flex items-center gap-1">
                  <Zap size={10} className="text-yellow-400" /> API: {serverFps} FPS
                </span>
              </div>
            </div>
            <button 
              onClick={stopWebcam}
              className="p-2 bg-black/40 text-white rounded-full hover:bg-white/20 transition backdrop-blur-md"
            >
              <X size={24} />
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          style={{ transform: isMirrored ? "scaleX(-1)" : "none" }} 
          className={`absolute inset-0 w-full h-full ${objectFitClass} z-10 transition-opacity duration-300 bg-black ${!cameraOn ? 'opacity-0' : 'opacity-100'}`}
        />
        
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${objectFitClass} pointer-events-none z-20`}
        />

        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-30 px-4 text-center">
            <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-indigo-500/50">
              <Camera size={40} className="text-indigo-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Mulai Deteksi</h3>
            <p className="text-gray-400 text-sm max-w-xs mb-8 leading-relaxed">
              Arahkan kamera ke tangan Anda. Pastikan pencahayaan cukup terang agar AI dapat membaca isyarat.
            </p>
            <button
              onClick={startWebcam}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full font-semibold shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2 group"
            >
              <Video size={20} className="group-hover:animate-pulse" />
              Nyalakan Kamera
            </button>
          </div>
        )}

        {cameraOn && (
          <>
            {!isMobile && (
              <div className="absolute top-4 left-4 z-30 flex gap-2">
                <div className="bg-black/60 backdrop-blur-md text-green-400 px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 flex items-center gap-2">
                   <Video size={12} /> CAM: {camFps}
                </div>
                <div className="bg-black/60 backdrop-blur-md text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 flex items-center gap-2">
                   <Zap size={12} /> YOLO: {serverFps}
                </div>
              </div>
            )}

            {/* CONTROLS BAR */}
            <div className={`absolute z-30 w-full flex flex-col items-center justify-end pb-8 ${isMobile ? 'bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent' : 'bottom-4'}`}>
              
              {/* Pesan "Menunggu tangan" hanya jika tidak ada track & tidak ada tangan */}
              {tracksRef.current.length === 0 && !handPresence && (
                <div className="mb-4 text-white/60 text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm animate-pulse">
                  Menunggu tangan...
                </div>
              )}

              <div className="flex items-center gap-6">
                <button
                  onClick={() => switchCamera(facing === "user" ? "environment" : "user")}
                  disabled={switching}
                  className={`p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all ${switching ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <RefreshCw size={isMobile ? 24 : 20} className={switching ? "animate-spin" : ""} />
                </button>

                {isMobile ? (
                  <button onClick={stopWebcam} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/50 transition-transform active:scale-95">
                    <div className="w-6 h-6 bg-white rounded-sm" />
                  </button>
                ) : (
                  <button onClick={stopWebcam} className="px-6 py-3 bg-red-500/90 hover:bg-red-600 text-white rounded-full text-sm font-medium backdrop-blur-sm transition-all shadow-lg flex items-center gap-2 active:scale-95">
                    <StopCircle size={18} />
                    Matikan Kamera
                  </button>
                )}

                {isMobile && supportsFlash ? (
                  <button
                    onClick={toggleFlash}
                    className={`p-3 rounded-full ${flashOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'} hover:bg-white/20 backdrop-blur-md transition-all`}
                  >
                    {flashOn ? <Zap size={24} fill="currentColor" /> : <ZapOff size={24} />}
                  </button>
                ) : (
                  <div className="w-12 h-12" /> 
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}