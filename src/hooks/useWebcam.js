import { useRef, useState, useCallback, useEffect } from "react";

export function useWebcam() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState("user"); 
  const [switching, setSwitching] = useState(false);
  
  // State Flash
  const [flashOn, setFlashOn] = useState(false);
  const [supportsFlash, setSupportsFlash] = useState(false);
  const flashOnRef = useRef(false); // Ref agar tidak merestart kamera

  const [camFps, setCamFps] = useState(0);
  const frameIdRef = useRef(null);
  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(0);

  const stopWebcam = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    setCamFps(0);
    fpsFrameCount.current = 0;
    fpsLastTime.current = 0;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && flashOnRef.current) {
          track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      }
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraOn(false);
    setFlashOn(false);
    flashOnRef.current = false;
    setSupportsFlash(false);
  }, []);

  const startWebcam = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setSwitching(true);
    setFlashOn(false); 
    flashOnRef.current = false;

    try {
      // Request HD 16:9 (1280x720)
      const constraints = {
        audio: false,
        video: {
          facingMode: facing,
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      setSupportsFlash(!!capabilities.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            setCameraOn(true);
            fpsLastTime.current = performance.now();
            fpsFrameCount.current = 0;
            requestVideoFrameCallback(); 
          } catch (playErr) {
            console.error("Video error:", playErr);
          }
        };
      }
    } catch (err) {
      console.error("Camera Error:", err);
      alert(`Gagal akses kamera: ${err.message}`);
      setCameraOn(false);
    } finally {
      setSwitching(false);
    }
  }, [facing]);

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    const newStatus = !flashOnRef.current;
    
    try {
      await track.applyConstraints({ advanced: [{ torch: newStatus }] });
      setFlashOn(newStatus);
      flashOnRef.current = newStatus;
    } catch (err) {
      console.error("Flash Error:", err);
    }
  }, []);

  const switchCamera = useCallback(() => {
    setFacing((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  useEffect(() => {
    if (cameraOn) startWebcam();
  }, [facing]); 

  const requestVideoFrameCallback = () => {
    const now = performance.now();
    fpsFrameCount.current++;
    if (now - fpsLastTime.current >= 500) {
      setCamFps(Math.round((fpsFrameCount.current * 1000) / (now - fpsLastTime.current)));
      fpsFrameCount.current = 0;
      fpsLastTime.current = now;
    }
    frameIdRef.current = requestAnimationFrame(requestVideoFrameCallback);
  };

  useEffect(() => {
    return () => stopWebcam();
  }, [stopWebcam]);

  return { videoRef, canvasRef, cameraOn, facing, switching, camFps, flashOn, supportsFlash, toggleFlash, startWebcam, stopWebcam, switchCamera };
}