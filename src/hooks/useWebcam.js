// src/hooks/useWebcam.js
import { useRef, useState, useEffect, useCallback } from "react";

export function useWebcam() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const streamRef = useRef(null);
  const isStartingRef = useRef(false); // Lock mechanism

  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState("user");
  const [switching, setSwitching] = useState(false);
  
  // State FPS kamera
  const [camFps, setCamFps] = useState(0);
  const camLastT = useRef(0);
  const frameIdRef = useRef(null);

  // --- 1. FUNGSI BERSIH-BERSIH ---
  const stopWebcam = useCallback(() => {
    // Hentikan loop FPS
    if (frameIdRef.current) {
      if (!videoRef.current?.requestVideoFrameCallback) {
        cancelAnimationFrame(frameIdRef.current);
      }
      frameIdRef.current = null;
    }
    setCamFps(0);
    camLastT.current = 0;

    // Matikan Video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    // Matikan Stream Hardware (PENTING)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    setCameraOn(false);
    isStartingRef.current = false; 
  }, []);

  // --- 2. FUNGSI START (CORE) ---
  // Menerima parameter 'throwError' agar kita bisa menangkap error di fungsi switch
  const startWithConstraints = async (constraints, throwError = false) => {
    if (isStartingRef.current) return;
    
    isStartingRef.current = true; 
    stopWebcam(); 
    
    // Kunci ulang setelah stopWebcam melepasnya
    isStartingRef.current = true; 

    try {
      // Safety delay untuk Windows
      await new Promise(r => setTimeout(r, 500));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          ...constraints, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          frameRate: { ideal: 30 } 
        },
        audio: false,
      });

      // Cek apakah user membatalkan saat loading
      if (!isStartingRef.current) { 
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => resolve();
        });

        try {
            await videoRef.current.play();
        } catch (err) {
            console.warn("Play interrupted:", err);
        }

        if (!isStartingRef.current) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        setCameraOn(true);
        
        // Start Loop FPS
        const step = (now) => {
          if (!streamRef.current || !videoRef.current || videoRef.current.paused) return;
          
          if (camLastT.current) {
            const dt = now - camLastT.current;
            const fps = dt > 0 ? 1000 / dt : 0;
            setCamFps(prev => prev ? prev * 0.8 + fps * 0.2 : fps);
          }
          camLastT.current = now;
          if (videoRef.current.requestVideoFrameCallback) {
            frameIdRef.current = videoRef.current.requestVideoFrameCallback(step);
          } else {
            frameIdRef.current = requestAnimationFrame(() => step(performance.now()));
          }
        };
        
        if (videoRef.current.requestVideoFrameCallback) {
            frameIdRef.current = videoRef.current.requestVideoFrameCallback(step);
        } else {
            frameIdRef.current = requestAnimationFrame(() => step(performance.now()));
        }
      }

    } catch (e) {
      console.error("Gagal akses kamera:", e);
      
      // Jika dipanggil dari switchCamera, lempar error ke atas agar bisa di-handle
      if (throwError) {
        isStartingRef.current = false;
        throw e; 
      }

      // Error Handling Umum
      if (e.name === "OverconstrainedError") {
        alert("Resolusi atau kamera yang diminta tidak tersedia di perangkat ini.");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
         alert("Kamera macet. Coba restart browser/laptop.");
      } else if (e.name === "NotAllowedError") {
         alert("Izin kamera ditolak.");
      } else {
         alert(`Gagal menyalakan kamera: ${e.name}`);
      }
      stopWebcam();
    } finally {
      isStartingRef.current = false; 
    }
  };

  // --- 3. FUNGSI SWITCH YANG AMAN ---
  const switchCamera = async (targetFacing) => {
    if (switching || isStartingRef.current) return;
    setSwitching(true);

    try {
      // [BARU] Cek jumlah kamera dulu
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      if (videoDevices.length < 2) {
        alert("Hanya satu kamera yang terdeteksi. Tidak bisa ganti kamera.");
        setSwitching(false);
        return; // Jangan lanjutkan, jangan matikan kamera yang sekarang
      }

      // Jika ada > 1 kamera, coba switch
      try {
        // Coba exact dulu, lempar error jika gagal (true)
        await startWithConstraints({ facingMode: { exact: targetFacing } }, true);
      } catch (err) {
        // Jika gagal (Overconstrained), coba mode loose
        console.warn("Switch exact failed, retrying loose...", err);
        try {
            await startWithConstraints({ facingMode: targetFacing }, true);
        } catch (finalErr) {
            // Jika gagal total, kembalikan ke kamera awal (RECOVERY)
            console.error("Switch failed completely, reverting...", finalErr);
            const oldFacing = targetFacing === 'user' ? 'environment' : 'user';
            setFacing(oldFacing); // Reset state UI
            await startWithConstraints({ facingMode: oldFacing }); // Nyalakan lagi yang lama
            alert("Gagal ganti kamera. Kembali ke kamera awal.");
        }
      }
      setFacing(targetFacing);

    } catch (e) {
      console.error("Error checking devices:", e);
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    return () => {
        stopWebcam();
    };
  }, [stopWebcam]);

  return {
    videoRef,
    canvasRef,
    cameraOn,
    facing,
    switching,
    camFps,
    startWebcam: () => switchCamera(facing),
    stopWebcam,
    switchCamera
  };
}