import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { Landmark, GestureMatch, HandSide, AppSettings } from '../types';
import { classifyPredefinedGesture, classifyCustomGesture } from '../utils/classifier';

interface CameraViewProps {
  onGestureDetected: (gesture: GestureMatch | null, handSide: HandSide, landmarks: Landmark[]) => void;
  settings: AppSettings;
  customTemplates: any[];
  onFpsUpdate: (fps: number) => void;
  onCameraActiveChange?: (active: boolean) => void;
  restartTrigger?: number;
}

export default function CameraView({
  onGestureDetected,
  settings,
  customTemplates,
  onFpsUpdate,
  onCameraActiveChange,
  restartTrigger = 0
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [cameraRequested, setCameraRequested] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [activeHand, setActiveHand] = useState<HandSide | null>(null);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

  // Synchronize active camera status to general App outer frame context
  useEffect(() => {
    onCameraActiveChange?.(cameraActive);
  }, [cameraActive, onCameraActiveChange]);

  // Restart camera on demand via trigger sequence
  useEffect(() => {
    if (restartTrigger > 0) {
      setCameraRequested(true);
      restartCamera();
    }
  }, [restartTrigger]);

  // References for keeping track of running streams safely
  const activeCameraInstance = useRef<any>(null);
  const activeHandsInstance = useRef<any>(null);
  const lastFrameTime = useRef<number>(0);
  const lastFpsSentTime = useRef<number>(0);
  const handWasDetected = useRef<boolean>(false);
  const cachedWidth = useRef<number>(0);
  const cachedHeight = useRef<number>(0);

  // References for prediction smoothing (last 10-15 frames buffer, candidate tracking, and confirmation metrics)
  const predictionHistory = useRef<{ name: string | null; confidence: number }[]>([]);
  const currentCandidate = useRef<string | null>(null);
  const candidateStartTime = useRef<number>(0);
  const confirmedGesture = useRef<GestureMatch | null>(null);

  // Use a mutable ref for props to completely prevent high-frequency MediaPipe callback rerender/stale closure loops
  const latestProps = useRef({
    onGestureDetected,
    settings,
    customTemplates,
    onFpsUpdate
  });

  // Always keep ref in sync with latest props on each render
  useEffect(() => {
    latestProps.current = {
      onGestureDetected,
      settings,
      customTemplates,
      onFpsUpdate
    };
  });

  // Initialize MediaPipe and Camera exactly once on mount if user requested it
  useEffect(() => {
    if (!cameraRequested) return;

    // Poll for global MediaPipe dependencies
    let attempts = 0;
    const checkDepsInterval = setInterval(() => {
      attempts++;
      if ((window as any).Hands && (window as any).Camera) {
        clearInterval(checkDepsInterval);
        initMediaPipe();
      } else if (attempts > 30) {
        clearInterval(checkDepsInterval);
        setErrorMsg('Failed to load neural tracking engine. Check network connection.');
        setLoading(false);
      }
    }, 500);

    return () => {
      clearInterval(checkDepsInterval);
      stopCameraAndHandlers();
    };
  }, [cameraRequested]);

  // Proactively check if webcam permission was already granted previously to start immediately
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as any })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            setCameraRequested(true);
          }
        })
        .catch(() => {
          // Ignore queries blocked by restrictive sandbox policies
        });
    }
  }, []);

  // Dynamically update MediaPipe tracking options without restarting the camera
  useEffect(() => {
    if (activeHandsInstance.current) {
      activeHandsInstance.current.setOptions({
        minDetectionConfidence: settings.detectionConfidenceLimit,
        minTrackingConfidence: settings.detectionConfidenceLimit
      });
    }
  }, [settings.detectionConfidenceLimit]);

  const initMediaPipe = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setIsPermissionDenied(false);

      // Pre-flight check navigator.permissions state before initializing
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as any });
          if (permissionStatus.state === 'denied') {
            throw new Error('PERMISSION_DENIED');
          }
        } catch (statusErr) {
          console.warn('Native camera query is unsupported / restricted in this context:', statusErr);
        }
      }

      const MpHands = (window as any).Hands;
      if (!MpHands) {
        throw new Error('MediaPipe Hands is not available.');
      }

      // Explicitly request webcam access to establish permission rules beforehand
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop track immediately to release stream for MediaPipe Hands instance to claim
          testStream.getTracks().forEach(track => track.stop());
        } catch (gUerr: any) {
          console.error('navigator.mediaDevices.getUserMedia permission test failed:', gUerr);
          const isDenied = gUerr.name === 'NotAllowedError' || gUerr.name === 'PermissionDeniedError' || gUerr.message?.includes('Permission');
          if (isDenied) {
            throw new Error('PERMISSION_DENIED');
          } else {
            throw new Error('CAMERA_OCCUPIED_OR_MISSING');
          }
        }
      } else {
        if (!window.isSecureContext) {
          throw new Error('INSECURE_CONTEXT');
        } else {
          throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
        }
      }

      // 1. Create Hands Instance
      const hands = new MpHands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: settings.detectionConfidenceLimit,
        minTrackingConfidence: settings.detectionConfidenceLimit
      });

      hands.onResults(handleResults);
      activeHandsInstance.current = hands;

      // 2. Start webcam using MediaPipe Camera utility directly on the visible videoRef element
      if (videoRef.current) {
        const MpCamera = (window as any).Camera;
        if (!MpCamera) {
          throw new Error('MediaPipe Camera utility is not available.');
        }

        const camera = new MpCamera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && activeHandsInstance.current) {
              await activeHandsInstance.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        await camera.start();
        activeCameraInstance.current = camera;
        setCameraActive(true);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      let isPermission = false;
      let displayMsg = 'Could not access the camera. Check if it is occupied by other apps.';
      
      if (err.message === 'PERMISSION_DENIED') {
        isPermission = true;
        displayMsg = 'Webcam permission denied. Please allow camera browser permissions.';
      } else if (err.message === 'INSECURE_CONTEXT') {
        displayMsg = 'Webcam requests require secure context (HTTPS or localhost). Please establish SSL connections.';
      } else if (err.message === 'MEDIA_DEVICES_NOT_SUPPORTED') {
        displayMsg = 'Webcam capturing API is unsupported on this browser version. Try modern environments.';
      } else if (err.message === 'CAMERA_OCCUPIED_OR_MISSING') {
        displayMsg = 'Camera hardware is occupied by another app or is physically disconnected. Check zoom/teams calls.';
      } else {
        const isPerm = err.message?.includes('Permission') || 
                       err.message?.includes('permission') || 
                       err.name === 'NotAllowedError' ||
                       err.permissionDenied === true;
        isPermission = isPerm;
        if (isPerm) {
          displayMsg = 'Webcam permission denied. Please allow camera browser permissions.';
        }
      }

      setErrorMsg(displayMsg);
      setIsPermissionDenied(isPermission);
      setLoading(false);
      setCameraActive(false);
    }
  };

  const stopCameraAndHandlers = () => {
    if (activeCameraInstance.current) {
      try {
        activeCameraInstance.current.stop();
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      activeCameraInstance.current = null;
    }
    if (activeHandsInstance.current) {
      try {
        activeHandsInstance.current.close();
      } catch (e) {
        console.warn('Error closing hands recognizer:', e);
      }
      activeHandsInstance.current = null;
    }
    setCameraActive(false);
  };

  const restartCamera = () => {
    stopCameraAndHandlers();
    setTimeout(() => {
      initMediaPipe();
    }, 400);
  };

  const handleRetryInitialization = () => {
    setErrorMsg(null);
    setIsPermissionDenied(false);
    setLoading(true);
    setCameraRequested(true);
    
    stopCameraAndHandlers();
    setTimeout(() => {
      initMediaPipe();
    }, 500);
  };

  const resetSmoothing = () => {
    predictionHistory.current = [];
    currentCandidate.current = null;
    candidateStartTime.current = 0;
    confirmedGesture.current = null;
  };

  // Callback to receive and render model results
  const handleResults = (results: any) => {
    // 1. Calculate FPS
    const now = performance.now();
    if (lastFrameTime.current > 0) {
      const fps = Math.round(1000 / (now - lastFrameTime.current));
      setCurrentFps(fps);
      // Throttling parent FPS layout updates (maximum once per 1.5 seconds) to prevent infinite update cascades
      if (now - lastFpsSentTime.current > 1500) {
        latestProps.current.onFpsUpdate(fps);
        lastFpsSentTime.current = now;
      }
    }
    lastFrameTime.current = now;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Direct match dimensions with zero layout-reflow overhead
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw > 0 && vh > 0 && (cachedWidth.current !== vw || cachedHeight.current !== vh)) {
      cachedWidth.current = vw;
      cachedHeight.current = vh;
      canvas.width = vw;
      canvas.height = vh;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Hand tracking detection data
    const landmarksList = results.multiHandLandmarks;
    const handednessList = results.multiHandedness;

    if (landmarksList && landmarksList.length > 0) {
      // Record that hand was visible so we can safely trigger exactly 1 empty callback on tracking loss
      handWasDetected.current = true;

      // Loop detected hands
      for (let i = 0; i < landmarksList.length; i++) {
        const landmarks: Landmark[] = landmarksList[i];
        const handedness = handednessList[i];
        const isLeftHand = handedness.label === 'Left';
        const hSide: HandSide = isLeftHand ? 'Left' : 'Right';

        if (activeHand !== hSide) {
          setActiveHand(hSide);
        }

        // Perform Classification (Predefined first, then Custom)
        let matched: GestureMatch | null = null;
        
        // 1. Try custom models first
        if (latestProps.current.customTemplates.length > 0) {
          matched = classifyCustomGesture(landmarks, latestProps.current.customTemplates);
        }

        // 2. Fallback to predefined heuristics
        if (!matched || matched.confidence < 0.6) {
          const predefined = classifyPredefinedGesture(landmarks, isLeftHand);
          if (predefined) {
            matched = predefined;
          }
        }

        // --- PREDICTION SMOOTHING & CONSISTENCY CONFIRMATION SYSTEM ---
        // Requirement 1: Ignore low-confidence predictions below 80% (0.80)
        let filteredName: string | null = null;
        let filteredConfidence = 0;
        if (matched && matched.confidence >= 0.80) {
          filteredName = matched.name;
          filteredConfidence = matched.confidence;
        }

        // Requirement 2: Rolling buffer smoothing of the last 15 frames
        predictionHistory.current.push({ name: filteredName, confidence: filteredConfidence });
        if (predictionHistory.current.length > 15) {
          predictionHistory.current.shift();
        }

        // Compute the mode (most frequent label) in the smoothing window
        const freqMap: Record<string, number> = {};
        for (const frame of predictionHistory.current) {
          const key = frame.name === null ? 'null' : frame.name;
          freqMap[key] = (freqMap[key] || 0) + 1;
        }

        let dominantLabel = 'null';
        let maxCount = 0;
        for (const label in freqMap) {
          if (freqMap[label] > maxCount) {
            maxCount = freqMap[label];
            dominantLabel = label;
          }
        }

        const dominantName = dominantLabel === 'null' ? null : dominantLabel;

        // Requirement 3: Only confirm a gesture if it remains consistent for at least 1 second (1000ms)
        const nowMs = Date.now();
        if (dominantName !== currentCandidate.current) {
          currentCandidate.current = dominantName;
          candidateStartTime.current = nowMs;
          confirmedGesture.current = null; // Instantly show "Detecting..." while transitioning between different gestures
        } else {
          const elapsed = nowMs - candidateStartTime.current;
          if (elapsed >= 1000) {
            if (dominantName === null) {
              confirmedGesture.current = null;
            } else {
              // Smooth/Average the prediction confidence for the confirmed gesture based on historic frames
              const candidateSamples = predictionHistory.current.filter(f => f.name === dominantName);
              const totalConf = candidateSamples.reduce((sum, f) => sum + f.confidence, 0);
              const smoothedConf = totalConf / (candidateSamples.length || 1);

              confirmedGesture.current = {
                name: dominantName,
                confidence: parseFloat(smoothedConf.toFixed(2)),
                isCustom: matched?.name === dominantName ? matched.isCustom : undefined
              };
            }
          }
        }

        // Requirement 4: Report result downstream based on official confirmed state using current latest callback Ref
        if (confirmedGesture.current) {
          latestProps.current.onGestureDetected(confirmedGesture.current, hSide, landmarks);
        } else {
          // Hand is active but posture is not yet stabilized: Report "Detecting..." 
          const currentLiveConfidence = filteredConfidence > 0 ? filteredConfidence : 0.50;
          latestProps.current.onGestureDetected({ name: 'Detecting...', confidence: currentLiveConfidence }, hSide, landmarks);
        }

        // Draw connections and landmarks
        if (latestProps.current.settings.landmarkLinesEnabled) {
          drawHandMesh(ctx, landmarks, latestProps.current.settings.drawingColor);
        }
      }
    } else {
      // Hand is completely out of frame: Instantly reset buffering states to minimize lag
      resetSmoothing();
      if (activeHand !== null) {
        setActiveHand(null);
      }
      // ONLY trigger onGestureDetected reset once when the hand first exits tracking scope rather than continuous firing
      if (handWasDetected.current) {
        latestProps.current.onGestureDetected(null, 'Right', []);
        handWasDetected.current = false;
      }
    }
  };

  // Helper function to draw full MediaPipe landmark structure on canvas
  const drawHandMesh = (ctx: CanvasRenderingContext2D, landmarks: Landmark[], brushColor: string) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Draw Skeleton Lines
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm border
    ];

    ctx.lineWidth = Math.max(2, settings.drawingBrushSize / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';

    for (const [start, end] of connections) {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Draw Joint Nodes
    landmarks.forEach((joint, id) => {
      // Highlight fingertips with distinct visual halos
      const isTip = [4, 8, 12, 16, 20].includes(id);
      
      if (isTip) {
        // Draw double-layered glow effect (extremely fast replacement for expensive canvas shadowBlur)
        ctx.beginPath();
        ctx.arc(joint.x * width, joint.y * height, 8, 0, 2 * Math.PI);
        ctx.fillStyle = brushColor + '4D'; // Add 30% alpha hex (4D) for glow halo
        ctx.fill();

        ctx.beginPath();
        ctx.arc(joint.x * width, joint.y * height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = brushColor;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(joint.x * width, joint.y * height, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    });
  };

  return (
    <div 
      id="cam-panel" 
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center min-h-[360px] md:min-h-[440px]"
    >
      {/* 
        Single, visible video stream element.
        This resolves all lagging, flickering, feed refresh, and snapshot behaviors!
      */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
          autoPlay
        />
        
        {/* Absolute tracking overlay canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
        />
      </div>

      {/* HUD Info Badges */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
        <div className="flex gap-2">
          {cameraActive && (
            <span className="backdrop-blur-md bg-white/80 border border-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Sensor Active
            </span>
          )}
          {activeHand && (
            <span className="backdrop-blur-md bg-white/80 border border-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <Layers className="h-3 w-3 text-violet-600" />
              {activeHand} Side
            </span>
          )}
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={restartCamera}
            className="backdrop-blur-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 p-2 rounded-xl transition duration-200 shadow-xs cursor-pointer"
            title="Restart neural core camera"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 1. Request Interaction Activation view to satisfy browser sandbox permissions protocol */}
      {!cameraRequested && !errorMsg && !loading && (
        <div className="absolute inset-0 bg-white/98 z-20 flex flex-col items-center justify-center p-8 text-center border border-slate-200 overflow-y-auto">
          <div className="bg-violet-50 text-violet-600 p-4 rounded-full border border-violet-100 mb-4 animate-pulse">
            <Camera className="h-10 w-10 text-violet-605 text-violet-600" />
          </div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-900 mb-2">
            Smart Hand Gesture Recognition Lens
          </h2>
          <p className="text-xs text-slate-500 font-semibold max-w-sm mb-6 leading-relaxed">
            This module leverages high-fidelity neural networks to capture 15 standard and custom skeletal coordinate loops. Tap below to authorize the camera session on your local hardware securely.
          </p>

          <div className="w-full max-w-md bg-slate-50 border border-slate-200/80 rounded-xl p-3 px-3.5 text-left mb-6">
            <span className="text-[10px] font-bold text-violet-600 tracking-wide uppercase block mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-violet-650 animate-spin animate-pulse" />
              On-Device Safety Guidelines
            </span>
            <ul className="text-[10px] text-slate-600 font-bold space-y-1 my-1">
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 bg-violet-600 rounded-full" />
                No physical video frames or images are uploaded to any backend database.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 bg-violet-600 rounded-full" />
                All landmark processing runs entirely inside on-device WebAsm workers.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1 w-1 bg-violet-600 rounded-full" />
                Secured over sandboxed iframe permissions contexts.
              </li>
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCameraRequested(true)}
              className="px-5 py-2.5 bg-violet-650 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-6xs transition hover:scale-[1.02] duration-200 cursor-pointer text-xs flex items-center gap-1.5"
            >
              <Camera className="h-4 w-4" />
              Authorize & Launch Cam
            </button>
            <a 
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-xl font-bold transition duration-200 cursor-pointer text-xs inline-flex items-center gap-1"
            >
              Standalone View
            </a>
          </div>
        </div>
      )}

      {/* Custom Model loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in border border-slate-200">
          <Sparkles className="h-12 w-12 text-violet-650 text-violet-600 animate-spin mb-4" />
          <h2 className="text-lg font-bold tracking-tight text-slate-800 mb-1">Activating Neural Workspace</h2>
          <p className="text-xs text-slate-400 max-w-sm font-semibold">
            Configuring model vectors and launching high-fidelity point tracker...
          </p>
        </div>
      )}

      {/* Permissions / Hardware Error view */}
      {errorMsg && (
        <div className="absolute inset-0 bg-white/98 z-20 flex flex-col items-center justify-center p-6 text-center border border-rose-150 overflow-y-auto">
          <div className="bg-rose-50 text-rose-500 p-3 rounded-full border border-rose-100 mb-2 animate-pulse">
            <CameraOff className="h-8 w-8" />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-800 mb-1">Webcam Access Blocked / Denied</h2>
          <p className="text-[11.5px] text-slate-500 font-semibold max-w-sm mb-4 leading-normal">{errorMsg}</p>
          
          <div className="w-full max-w-md bg-slate-50 border border-slate-200/80 rounded-xl p-3 px-3.5 text-left mb-4 shadow-6xs">
            <span className="text-[10px] font-bold text-violet-700 tracking-wide uppercase block mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3 animate-spin text-violet-600" />
              How to Grant Camera Access via Browser Settings:
            </span>
            <p className="text-[10.5px] text-slate-600 font-semibold mb-2 leading-relaxed">
              To activate hand tracking successfully, your browser requires valid media stream authorization. Follow these steps depending on your environment:
            </p>
            <ol className="text-[10px] text-slate-600 font-bold list-decimal pl-4.5 space-y-1.5">
              <li>
                <strong className="text-slate-900 font-extrabold">Check Browser URL Bar:</strong> Click the <strong className="text-slate-900 font-extrabold">Secure Lock Icon 🔒</strong> of camera settings at the top left next to your address bar, and set the camera dropdown toggle to <strong className="text-emerald-600 font-extrabold">Allow</strong>.
              </li>
              <li>
                <strong className="text-slate-900 font-extrabold">Launch Standalone Mode (Highly Recommended):</strong> Since iframes in preview frames can have restrictive sandboxes, click the <strong className="text-violet-600 font-extrabold">Launch Standalone</strong> button below to open the application in a direct primary tab.
              </li>
              <li>
                <strong className="text-slate-900 font-extrabold">Browser Site Settings:</strong> Open chrome://settings/content/camera (or equivalent in Safari/Firefox/Edge) and check if this origin is listed under the <strong className="text-slate-900 font-extrabold">Blocked</strong> section. Remove it, then click retry.
              </li>
              <li>
                <strong className="text-slate-900 font-extrabold">Unblock Physical Switch:</strong> Confirm that other applications (like Skype, Discord, Zoom, or Teams) are not using the webcam device.
              </li>
            </ol>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRetryInitialization}
              className="px-4 py-2 bg-violet-650 bg-violet-600 hover:bg-violet-705 text-white rounded-xl font-bold shadow-xs transition duration-200 cursor-pointer text-xs"
            >
              Retry Initialization
            </button>
            <a 
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-slate-100 text-slate-705 hover:bg-slate-150 border border-slate-200 rounded-xl font-bold shadow-xs transition duration-200 cursor-pointer text-xs inline-flex items-center gap-1"
            >
              Launch Standalone
            </a>
          </div>
        </div>
      )}

      {/* Dynamic FPS Counter */}
      {cameraActive && !loading && (
        <div className="absolute bottom-4 right-4 backdrop-blur-md bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 font-bold font-mono text-[10px] uppercase tracking-wide flex items-center gap-1 shadow-xs">
          <span className="text-violet-605 text-violet-600 font-extrabold">{currentFps}</span> FPS
        </div>
      )}
    </div>
  );
}
