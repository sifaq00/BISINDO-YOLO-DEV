// src/hooks/useDetection.js
import { useRef, useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const DETECT_URL = `${API_BASE}/detect`;

export function useDetection(videoRef, cameraOn, onDetections) {
  const [fps, setFps] = useState(0);
  const sendingRef = useRef(false);
  const detectTimerRef = useRef(null);
  const fpsCount = useRef(0);
  const fpsLastT = useRef(performance.now());

  // Helper snapshot
  const captureImage = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const cvs = document.createElement("canvas");
    cvs.width = v.videoWidth;
    cvs.height = v.videoHeight;
    cvs.getContext("2d").drawImage(v, 0, 0);
    return cvs.toDataURL("image/jpeg", 0.75);
  };

  // Fungsi Kirim ke API
  const sendDetect = async () => {
    if (sendingRef.current || !cameraOn) return;
    
    const dataUrl = captureImage();
    if (!dataUrl) return;

    sendingRef.current = true;
    try {
      const res = await fetch(DETECT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      
      if (res.ok) {
        const detections = await res.json();
        if (onDetections) onDetections(detections); // Callback ke parent

        // Hitung FPS Server
        fpsCount.current++;
        const now = performance.now();
        if (now - fpsLastT.current >= 1000) {
           setFps(fpsCount.current);
           fpsCount.current = 0;
           fpsLastT.current = now;
        }
      }
    } catch (e) {
      console.error("Detect Error:", e);
    } finally {
      sendingRef.current = false;
    }
  };

  // Loop Interval
  useEffect(() => {
    if (cameraOn) {
      const loop = () => {
        sendDetect().finally(() => {
            detectTimerRef.current = setTimeout(loop, 80); // Interval 80ms
        });
      };
      loop();
    } else {
      clearTimeout(detectTimerRef.current);
    }
    return () => clearTimeout(detectTimerRef.current);
  }, [cameraOn]);

  return { fps };
}