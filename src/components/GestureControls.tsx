import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, Volume2, Presentation, Home, HelpCircle, BookOpen,
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Sparkles, Lightbulb, Power, Maximize2, ShieldCheck, Music
} from 'lucide-react';
import { Landmark, GestureMatch, AppSettings, SlideContent } from '../types';
import gestureGuideHero from '../assets/images/gesture_guide_hero_1780201943272.png';

interface GestureControlsProps {
  activeGesture: GestureMatch | null;
  landmarks: Landmark[];
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
}

const slidesData: SlideContent[] = [
  {
    title: "1. Real-time Pose Detection Engine",
    description: "Multi-layered convolutional tracking model running client side.",
    bullets: [
      "Tracks 21 hand landmarks directly inside browser sandbox",
      "Achieves low-latency (<15ms processing time)",
      "Zero frames sent to remote cloud architectures"
    ]
  },
  {
    title: "2. Vector Distance Classification",
    description: "Translating Euclidean metrics into robust on-device neural pose classes.",
    bullets: [
      "Translates hand coordinates with Wrist reference shifts",
      "Dynamic distance thresholding guards against camera scaling",
      "In-memory templates allow instant custom calibrations"
    ]
  },
  {
    title: "3. Smart Interaction Controls",
    description: "Bridge between physical gestures and virtual system commands.",
    bullets: [
      "Finger paint with high fidelity drawing coordinates",
      "Index-to-thumb pincers govern volume ratios",
      "Integrated swipe logs and macro smart room command handlers"
    ]
  }
];

export default function GestureControls({
  activeGesture,
  landmarks,
  settings,
  onUpdateSettings
}: GestureControlsProps) {
  const [activeTab, setActiveTab] = useState<'drawing' | 'volume' | 'presentation' | 'smarthome' | 'library'>('drawing');
  const [imgSecFailed, setImgSecFailed] = useState<boolean>(false);
  
  // Volume state
  const [currentVolume, setCurrentVolume] = useState<number>(50);
  
  // Drawing states
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingBuffer = useRef<Array<{ x: number; y: number; color: string; size: number; isGap: boolean }>>([]);
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);

  // Presenter states
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const slideCoolDown = useRef<number>(0);

  // Smart Home States
  const [smartHome, setSmartHome] = useState({
    smartLight: false,
    airConditioner: false,
    soundSpeaker: false,
    garageDoor: true // locked
  });

  // Track cursor point for Drawing & click interactions
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Initialize/Clear Drawing Canvas
  const clearDrawings = () => {
    drawingBuffer.current = [];
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Sync active mode in settings
  useEffect(() => {
    onUpdateSettings({ activeControlMode: activeTab });
  }, [activeTab]);

  // Main tick loop for handling real-time features based on landmarks
  useEffect(() => {
    if (!landmarks || landmarks.length < 21) {
      lastDrawPos.current = null;
      setCursor(null);
      return;
    }

    // Index Tip index is 8. Let's map it into coordinates
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];

    // Flip width since video is mirrored
    const targetX = (1 - indexTip.x) * 100;
    const targetY = indexTip.y * 100;
    setCursor({ x: targetX, y: targetY });

    // Mode-specific actions
    if (activeTab === 'drawing') {
      const isDrawingPose = activeGesture?.name === 'YOU' || activeGesture?.name === 'TALK TO THE HAND' || activeGesture?.name === 'HIGH FIVE';
      const canvas = drawingCanvasRef.current;
      if (canvas && isDrawingPose) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
          }

          const currentX = (1 - indexTip.x) * canvas.width;
          const currentY = indexTip.y * canvas.height;

          // Record coordinate in buffer
          const isGap = !lastDrawPos.current;
          drawingBuffer.current.push({
            x: currentX,
            y: currentY,
            color: settings.drawingColor,
            size: settings.drawingBrushSize,
            isGap
          });

          // Draw instantly
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = settings.drawingBrushSize;
          ctx.strokeStyle = settings.drawingColor;

          if (lastDrawPos.current) {
            ctx.beginPath();
            ctx.moveTo(lastDrawPos.current.x, lastDrawPos.current.y);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
          }

          lastDrawPos.current = { x: currentX, y: currentY };
        }
      } else {
        lastDrawPos.current = null;
      }
    } 
    
    else if (activeTab === 'volume') {
      // Calculate thumb tip (4) to index tip (8) distance to control volume slider
      const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2) +
        Math.pow(thumbTip.z - indexTip.z, 2)
      );

      // Map scale: distance of 0.05 to 0.28 maps to volume 0 to 100
      let calculatedVol = Math.round(((distance - 0.05) / 0.25) * 100);
      calculatedVol = Math.max(0, Math.min(100, calculatedVol));
      setCurrentVolume(calculatedVol);
      onUpdateSettings({ voiceVolume: calculatedVol / 100 });
    } 
    
    else if (activeTab === 'presentation') {
      // Use Pointing Finger for Slide Next, OK sign for Slide BACK
      if (Date.now() > slideCoolDown.current) {
        if (activeGesture?.name === 'YOU') {
          setSlideIndex(prev => Math.min(slidesData.length - 1, prev + 1));
          slideCoolDown.current = Date.now() + 1500; // 1.5s cooldown
        } else if (activeGesture?.name === 'OK') {
          setSlideIndex(prev => Math.max(0, prev - 1));
          slideCoolDown.current = Date.now() + 1500;
        }
      }
    } 
    
    else if (activeTab === 'smarthome') {
      // Home Automation Macros:
      // Thumbs Up -> Light ON
      // Closed Fist -> Light OFF
      // Victory Sign -> AC Toggle
      // Stop Gesture -> Alarm Arm/Disarm
      if (activeGesture?.name === 'GOOD JOB') {
        setSmartHome(prev => ({ ...prev, smartLight: true }));
      } else if (activeGesture?.name === 'POWER TO') {
        setSmartHome(prev => ({ ...prev, smartLight: false }));
      } else if (activeGesture?.name === 'PEACE' && Date.now() > slideCoolDown.current) {
        setSmartHome(prev => ({ ...prev, soundSpeaker: !prev.soundSpeaker }));
        slideCoolDown.current = Date.now() + 1500;
      } else if (activeGesture?.name === 'TALK TO THE HAND') {
        setSmartHome(prev => ({ ...prev, garageDoor: !prev.garageDoor }));
      }
    }

  }, [landmarks, activeTab, activeGesture, settings.drawingColor, settings.drawingBrushSize]);

  // Handle color change
  const paletteColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-full min-h-[440px]">
      
      {/* Category Selection Tabs */}
      <div className="flex border-b border-slate-100 pb-2 gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('drawing')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            activeTab === 'drawing' 
              ? 'bg-violet-50 text-violet-700 border border-violet-100/60 shadow-xs' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          Virtual Canvas
        </button>
        <button
          onClick={() => setActiveTab('volume')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            activeTab === 'volume' 
              ? 'bg-violet-50 text-violet-700 border border-violet-100/60 shadow-xs' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Volume2 className="h-3.5 w-3.5" />
          Volume Pitch
        </button>
        <button
          onClick={() => setActiveTab('presentation')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            activeTab === 'presentation' 
              ? 'bg-violet-50 text-violet-700 border border-violet-100/60 shadow-xs' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
          }`}
        >
          <Presentation className="h-3.5 w-3.5" />
          Slides Control
        </button>
        <button
          onClick={() => setActiveTab('smarthome')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            activeTab === 'smarthome' 
              ? 'bg-violet-50 text-violet-700 border border-violet-100/60 shadow-xs' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Home className="h-3.5 w-3.5" />
          Smart Home
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            activeTab === 'library' 
              ? 'bg-violet-50 text-violet-700 border border-violet-100/60 shadow-xs' 
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Gesture Catalog
        </button>
      </div>

      <div className="flex-1 mt-4 flex flex-col justify-between">
        
        {/* TAB 1: Virtual Drawing Board */}
        {activeTab === 'drawing' && (
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-700 font-bold flex items-center gap-1.5 animate-pulse">
                <Palette className="h-3.5 w-3.5 text-violet-600" />
                Gesture: Point Index to Draw
              </span>
              <button
                onClick={clearDrawings}
                className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline px-2 py-0.5 cursor-pointer"
              >
                Clear Slate
              </button>
            </div>

            {/* Simulated interactive whiteboard */}
            <div className="relative flex-1 bg-slate-50 border border-slate-200 rounded-xl min-h-[180px] overflow-hidden">
              <canvas
                ref={drawingCanvasRef}
                className="absolute inset-0 w-full h-full cursor-none"
              />
              
              {/* Overlay cursor ring following thumb tracking on canvas */}
              {cursor && (
                <div 
                  className="absolute h-4 w-4 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg transition-all duration-75 pointer-events-none"
                  style={{ 
                    left: `${cursor.x}%`, 
                    top: `${cursor.y}%`,
                    borderColor: settings.drawingColor,
                    backgroundColor: `${settings.drawingColor}30`
                  }}
                />
              )}

              {/* Guide prompt */}
              {!cursor && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1 text-center p-4">
                  <Palette className="h-8 w-8 text-slate-300 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">Whiteboard Offline</p>
                  <p className="text-[10px] max-w-xs text-slate-400 font-medium">
                    Mount your webcam and point with index finger inside the field to commence sketching.
                  </p>
                </div>
              )}
            </div>

            {/* Brush Customizer Controls */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold font-mono uppercase text-slate-500">Brush Color</span>
                <div className="flex gap-1.5">
                  {paletteColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => onUpdateSettings({ drawingColor: c })}
                      className="h-5 w-5 rounded-full border pointer-events-auto transition cursor-pointer"
                      style={{ 
                        backgroundColor: c, 
                        borderColor: settings.drawingColor === c ? '#475569' : 'transparent',
                        boxShadow: settings.drawingColor === c ? `0 0 8px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500">
                  <span>Thickness</span>
                  <span>{settings.drawingBrushSize}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={settings.drawingBrushSize}
                  onChange={(e) => onUpdateSettings({ drawingBrushSize: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic Volume controls */}
        {activeTab === 'volume' && (
          <div className="flex-1 flex flex-col h-full justify-between space-y-4">
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-[10px] text-slate-700 font-bold flex items-center gap-1.5 animate-pulse">
              <Volume2 className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
              Gesture: Pinch Thumb to Index Tip outward/inward
            </div>

            <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-xl border border-slate-200 p-6 min-h-[180px]">
              <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                
                {/* Visual Circle Gauge */}
                <div className="relative h-28 w-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      stroke="#e2e8f0"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r="46"
                      stroke="url(#radialGradient)"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="289"
                      strokeDashoffset={289 - (289 * currentVolume) / 100}
                      className="transition-all duration-150"
                    />
                    <defs>
                      <linearGradient id="radialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  {/* Gauge Center text */}
                  <div className="absolute text-center">
                    <span className="text-2xl font-bold text-slate-800 font-mono">{currentVolume}%</span>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono mt-0.5">Master Pitch</span>
                  </div>
                </div>

                {/* Progress bar scale */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-650 from-indigo-600 to-purple-650 to-purple-600 transition-all duration-150" 
                    style={{ width: `${currentVolume}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold italic text-center">
              *Align thumb and index in camera plane and squeeze space between them to manipulate.
            </p>
          </div>
        )}

        {/* TAB 3: Presentation Slides controls */}
        {activeTab === 'presentation' && (
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-[10px] text-slate-700 font-bold flex items-center gap-1.5 justify-between">
              <span className="flex items-center gap-1">
                <Presentation className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                Index Finger = NEXT Slide • OK Sign = PREVIOUS Slide
              </span>
              <span className="text-[9px] text-indigo-600 font-mono font-bold">Real-time macro</span>
            </div>

            {/* Presentation viewport mockup */}
            <div className="flex-1 bg-slate-50 border border-slate-200 p-6 rounded-xl relative flex flex-col justify-between min-h-[200px] hover:border-slate-300 transition">
              
              {/* Slide Counter */}
              <div className="flex justify-between items-center text-[10px] font-bold font-mono text-slate-400">
                <span>SLIDECRAFT DOCK</span>
                <span>{slideIndex + 1} / {slidesData.length}</span>
              </div>

              {/* Dynamic Slides Content */}
              <div className="space-y-3 my-3">
                <h4 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-750 from-violet-700 to-indigo-700 leading-tight">
                  {slidesData[slideIndex].title}
                </h4>
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  {slidesData[slideIndex].description}
                </p>
                <ul className="space-y-1">
                  {slidesData[slideIndex].bullets.map((b, i) => (
                    <li key={i} className="text-[10px] text-slate-500 font-medium flex items-start gap-1">
                      <span className="text-violet-600 font-bold text-xs leading-none">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Carousel Buttons */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-150 border-slate-200">
                <button
                  onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
                  disabled={slideIndex === 0}
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:text-slate-200 transition cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1.5">
                  {slidesData.map((_, i) => (
                    <span 
                      key={i} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === slideIndex ? 'w-4 bg-violet-600' : 'w-1.5 bg-slate-200'}`} 
                    />
                  ))}
                </div>
                <button
                  onClick={() => setSlideIndex(prev => Math.min(slidesData.length - 1, prev + 1))}
                  disabled={slideIndex === slidesData.length - 1}
                  className="p-1 text-slate-400 hover:text-slate-800 disabled:text-slate-200 transition cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Home Automation Commands */}
        {activeTab === 'smarthome' && (
          <div className="flex-1 flex flex-col justify-between space-y-4">
            
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-[9px] text-slate-700 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                GOOD JOB = Lights On • POWER TO = Lights Off • PEACE = Toggle Song • TALK TO THE HAND = Lock/Unlock
              </span>
            </div>

            {/* Smart Home dashboard widgets view */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-[220px]">
              
              {/* Widget 1: Lamp */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-350 transition">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100/80">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${smartHome.smartLight ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/50 text-slate-500'}`}>
                    {smartHome.smartLight ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-slate-800">Porch Spotlights</h5>
                  <p className="text-[9px] text-slate-400 font-semibold">Trigger: GOOD JOB / POWER TO</p>
                </div>
              </div>

              {/* Widget 2: Security Gate */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-350 transition">
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg border ${smartHome.garageDoor ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-650 text-emerald-600 border-emerald-100'}`}>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${smartHome.garageDoor ? 'bg-rose-105 bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {smartHome.garageDoor ? 'LOCKED' : 'OPEN'}
                  </span>
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-slate-800">Security Lock-In</h5>
                  <p className="text-[9px] text-slate-400 font-semibold">Trigger: TALK TO THE HAND</p>
                </div>
              </div>

              {/* Widget 3: Speaker play music */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-350 transition col-span-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${smartHome.soundSpeaker ? 'bg-emerald-50 text-emerald-605 text-emerald-600 border-emerald-110 border-emerald-100 animate-pulse' : 'bg-slate-100 text-slate-405 text-slate-400 border-slate-200'}`}>
                      <Music className="h-4 w-4" />
                    </div>
                    <div>
                      <h5 className="text-[11px] font-bold text-slate-800">Cosmic Lounge Speaker</h5>
                      <p className="text-[9px] text-slate-500 font-medium">
                        {smartHome.soundSpeaker ? 'Now playing: Lofi Ambience (Looping)' : 'Muted'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${smartHome.soundSpeaker ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/50 text-slate-500'}`}>
                    {smartHome.soundSpeaker ? 'STREAMING' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 font-semibold leading-none mt-2">Trigger: PEACE macro toggle</p>
              </div>

            </div>
          </div>
        )}

        {/* TAB 5: Gesture Catalog / Handbook */}
        {activeTab === 'library' && (
          <div className="flex-1 flex flex-col space-y-4 max-h-[440px] overflow-y-auto pr-1">
            <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-[10px] text-slate-750 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                Hand Gesture Handbook: Study and Lock Active States
              </span>
              <span className="text-[8px] bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-mono uppercase font-bold animate-pulse">
                Live Sensor Sync
              </span>
            </div>

            {/* Poster Hero Banner card with exact generated file */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200/85 bg-slate-50 shadow-sm aspect-[16/9] shrink-0">
              <img 
                src={imgSecFailed ? undefined : gestureGuideHero}
                alt="Gestures Reference Poster"
                className="w-full h-full object-cover"
                onError={() => setImgSecFailed(true)}
                referrerPolicy="no-referrer"
              />
              {imgSecFailed && (
                <div className="absolute inset-0 bg-violet-650 bg-violet-650/90 flex flex-col items-center justify-center p-4 text-center text-white">
                  <Sparkles className="h-8 w-8 text-white animate-pulse mb-2" />
                  <h4 className="text-xs font-bold font-sans">Interactive Gesture Catalog Matrix</h4>
                  <p className="text-[10px] text-violet-100 max-w-xs mt-1 leading-normal">
                    Active ML mapping is alive! Show physical gestures in front of the lens to capture corresponding matrices below.
                  </p>
                </div>
              )}
              {!imgSecFailed && (
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-end p-3 px-3.5 pb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">15 Standard Gestures Poster Blueprint</h4>
                    <p className="text-[9px] text-slate-300">Interact in front of the lens to activate corresponding slots instantly.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Grid of 15 Gestures */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
              {[
                { name: 'PEACE', desc: 'Victory / spread spread fingers', symbol: '✌️' },
                { name: 'HANG LOOSE', desc: 'Thumb & pinky extended sideways', symbol: '🤙' },
                { name: 'LOSER', desc: 'Thumb & index vertical right angle', symbol: '🫵' },
                { name: 'HIGH FIVE', desc: 'All five fingers spread wide upright', symbol: '🖐️' },
                { name: 'TALK TO THE HAND', desc: 'Flat palm facing sensory camera', symbol: '✋' },
                { name: 'YOU', desc: 'Index finger pointing forward / up', symbol: '👉' },
                { name: 'GOOD JOB', desc: 'Thumbs up gesture', symbol: '👍' },
                { name: 'DISLIKE', desc: 'Thumbs down gesture', symbol: '👎' },
                { name: 'POWER TO', desc: 'Closed fist', symbol: '✊' },
                { name: 'OK', desc: 'Index and thumb forming circular loop', symbol: '👌' },
                { name: 'A-HOLE', desc: 'Circle loop held upside-down sideways', symbol: '🕳️' },
                { name: 'GOOD LUCK', desc: 'Index and middle fingers crossed closely', symbol: '🤞' },
                { name: 'BANG BANG', desc: 'Gun shape horizontal forward alignment', symbol: '🔫' },
                { name: 'ROCK', desc: 'Index and pinky up, rock sign', symbol: '🤘' },
                { name: 'CALL ME', desc: 'Thumb & pinky up, phone slanted tilt', symbol: '📞' }
              ].map((g) => {
                const isActive = activeGesture?.name === g.name;
                return (
                  <div 
                    key={g.name}
                    className={`p-2.5 rounded-xl border transition-all duration-200 flex flex-col justify-between h-20 relative overflow-hidden ${
                      isActive 
                        ? 'bg-emerald-50/70 border-emerald-420 border-emerald-400 shadow-sm shadow-emerald-100' 
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-lg leading-none">{g.symbol}</span>
                      {isActive ? (
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-0.5 animate-pulse">
                          Active
                        </span>
                      ) : (
                        <span className="text-[7.5px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                          Ready
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className={`text-[9px] font-mono font-bold leading-none ${isActive ? 'text-emerald-800 font-black' : 'text-slate-800'}`}>
                        {g.name}
                      </h5>
                      <span className="text-[7.5px] text-slate-450 text-slate-500 font-medium block leading-tight mt-1 truncate">
                        {g.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
