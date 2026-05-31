import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, Camera, Cpu, Settings, Activity, LayoutGrid, RotateCcw, 
  Volume2, VolumeX, Eye, Info, Layers, Award, ShieldAlert, HelpCircle
} from 'lucide-react';
import { 
  Landmark, GestureMatch, HandSide, AppSettings, GestureLog, AnalyticsData, CustomGestureTemplate 
} from './types';
import CameraView from './components/CameraView';
import HistoryLog from './components/HistoryLog';
import DashboardStats from './components/DashboardStats';
import CustomTrainer from './components/CustomTrainer';
import GestureControls from './components/GestureControls';
import DiagnosticsPanel from './components/DiagnosticsPanel';

// Predefined default analytics data
const initialAnalytics: AnalyticsData = {
  totalDetected: 0,
  mostUsedGesture: '',
  gestureFrequency: [],
  dailyStats: [
    { date: '10:00', count: 4 },
    { date: '12:00', count: 12 },
    { date: '14:00', count: 8 },
    { date: '16:00', count: 18 },
    { date: '18:00', count: 24 },
    { date: '20:00', count: 15 }
  ],
  accuracyMetric: 0.95
};

export default function App() {
  // Adaptive Diagnostics & Connectivity States
  const [cameraActiveState, setCameraActiveState] = useState<boolean>(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [wsErrors, setWsErrors] = useState<number>(0);
  const [reconnectTrigger, setReconnectTrigger] = useState<number>(0);
  const [cameraRestartTrigger, setCameraRestartTrigger] = useState<number>(0);

  // App primary configurations state
  const [settings, setSettings] = useState<AppSettings>({
    voiceFeedbackEnabled: true,
    voiceVolume: 0.6,
    detectionConfidenceLimit: 0.55,
    drawingColor: '#8b5cf6', // Violet accent
    drawingBrushSize: 6,
    activeControlMode: 'drawing',
    landmarkLinesEnabled: true,
    smoothFilter: true
  });

  // Target classified gestures
  const [activeGesture, setActiveGesture] = useState<GestureMatch | null>(null);
  const [activeHandSide, setActiveHandSide] = useState<HandSide>('Right');
  const [activeLandmarks, setActiveLandmarks] = useState<Landmark[]>([]);

  // Persistent user custom gesture models
  const [customTemplates, setCustomTemplates] = useState<CustomGestureTemplate[]>([]);

  // Logs and telemetry metrics registers
  const [logs, setLogs] = useState<GestureLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>(initialAnalytics);
  const [fps, setFps] = useState<number>(0);

  // References to handle voice loop duplicates
  const lastSpokenGesture = useRef<string>('');
  const logCooldown = useRef<Record<string, number>>({});

  // 1. Load custom models from storage on boot load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smart_gesture_customs');
      if (stored) {
        setCustomTemplates(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load custom gestures from localStorage:', e);
    }
  }, []);

  // Resilience: Real-time telemetry connection monitor with exponentional reconnect loops
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let attempts = 0;

    const connect = () => {
      if (socket) {
        try { socket.close(); } catch (e) {}
      }
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      setWsStatus('connecting');
      
      try {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          attempts = 0;
          setWsStatus('connected');
        };

        socket.onerror = () => {
          setWsErrors(v => v + 1);
        };

        socket.onclose = () => {
          setWsStatus('disconnected');
          // Exponential backoff reconnect
          const delay = Math.min(15000, Math.pow(2, attempts) * 1000 + Math.random() * 505);
          attempts++;
          reconnectTimeout = setTimeout(connect, delay);
        };
      } catch (e) {
        setWsErrors(v => v + 1);
        setWsStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        try { socket.close(); } catch (e) {}
      }
    };
  }, [reconnectTrigger]);

  // Update setSettings from inner child components
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // 2. Clear out log registers
  const clearLogs = () => {
    setLogs([]);
    setAnalytics(prev => ({
      ...prev,
      totalDetected: 0,
      mostUsedGesture: '',
      gestureFrequency: []
    }));
  };

  // 3. Save new custom gesture template
  const saveCustomTemplate = (template: CustomGestureTemplate) => {
    const updated = [...customTemplates, template];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('smart_gesture_customs', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Delete custom template registry
  const deleteCustomTemplate = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('smart_gesture_customs', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Trigger voice synthesis on gesture transitions
  const triggerVoiceFeedback = useCallback((gestureName: string) => {
    if (!settings.voiceFeedbackEnabled || !('speechSynthesis' in window)) return;
    
    // Normalize speaking labels for clean voice flow
    let speakPhrase = gestureName;
    if (gestureName === 'GOOD JOB') speakPhrase = 'Good Job';
    else if (gestureName === 'POWER TO') speakPhrase = 'Power To';
    else if (gestureName === 'TALK TO THE HAND') speakPhrase = 'Talk To The Hand';
    else if (gestureName === 'BANG BANG') speakPhrase = 'Bang Bang';
    else if (gestureName === 'A-HOLE') speakPhrase = 'A Hole';
    else if (gestureName === 'PEACE') speakPhrase = 'Peace';

    try {
      window.speechSynthesis.cancel(); // immediately stop previous utterances
      const utterance = new SpeechSynthesisUtterance(speakPhrase);
      utterance.volume = settings.voiceVolume;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Voice synthesis error:', err);
    }
  }, [settings.voiceFeedbackEnabled, settings.voiceVolume]);

  // 6. Push gesture occurrences to analytics
  const logGestureOccurrence = useCallback((gesture: GestureMatch, handSide: HandSide) => {
    if (gesture.name === 'Detecting...') return; // Skip Logging temporary state
    const now = Date.now();
    const gestureKey = gesture.name;

    // Guard log density to avoid pushing 30 frames per second
    const lastLogged = logCooldown.current[gestureKey] || 0;
    if (now - lastLogged < 2000) return; // rate limit: log identical gesture every 2s

    logCooldown.current[gestureKey] = now;

    // Speak!
    if (gesture.name !== lastSpokenGesture.current) {
      triggerVoiceFeedback(gesture.name);
      lastSpokenGesture.current = gesture.name;
    }

    // Append history line
    const newLog: GestureLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      gesture: gestureKey,
      confidence: gesture.confidence,
      handSide
    };

    setLogs(prev => [newLog, ...prev.slice(0, 49)]); // keep latest 50 logs

    // Re-crunch frequency scores
    setAnalytics(prev => {
      // Build updated frequencies
      const frequencies = [...prev.gestureFrequency];
      const match = frequencies.find(f => f.gesture === gestureKey);
      if (match) {
        match.count += 1;
      } else {
        frequencies.push({ gesture: gestureKey, count: 1 });
      }

      frequencies.sort((a, b) => b.count - a.count);
      const mostUsed = frequencies.length > 0 ? frequencies[0].gesture : 'None';

      // Update today's timeline
      const updatedDaily = [...prev.dailyStats];
      const hourStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const lastDaily = updatedDaily[updatedDaily.length - 1];
      if (lastDaily && updatedDaily.length > 0) {
        lastDaily.count += 1;
      }

      return {
        ...prev,
        totalDetected: prev.totalDetected + 1,
        mostUsedGesture: mostUsed,
        gestureFrequency: frequencies,
        dailyStats: updatedDaily,
        accuracyMetric: Math.min(0.99, 0.90 + (frequencies.length * 0.01))
      };
    });
  }, [triggerVoiceFeedback]);

  // Unified callback from webcam view results
  const handleGestureDetected = useCallback((
    gesture: GestureMatch | null,
    handSide: HandSide,
    landmarks: Landmark[]
  ) => {
    // 1. Avoid resetting state repeatedly if it is already null
    if (gesture === null && activeGesture === null && landmarks.length === 0 && activeLandmarks.length === 0) {
      return;
    }

    // 2. Avoid redundant non-null state triggers that map to equivalent values
    if (
      gesture && 
      activeGesture && 
      gesture.name === activeGesture.name && 
      gesture.confidence === activeGesture.confidence && 
      handSide === activeHandSide &&
      landmarks.length === activeLandmarks.length &&
      landmarks.length > 0 &&
      activeLandmarks.length > 0 &&
      Math.abs(landmarks[0].x - activeLandmarks[0].x) < 0.0001 &&
      Math.abs(landmarks[0].y - activeLandmarks[0].y) < 0.0001
    ) {
      return;
    }

    setActiveGesture(gesture);
    setActiveHandSide(handSide);
    setActiveLandmarks(landmarks);

    if (gesture) {
      logGestureOccurrence(gesture, handSide);
    }
  }, [activeGesture, activeHandSide, activeLandmarks, logGestureOccurrence]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-violet-500/10 selection:text-slate-900">
      
      {/* Absolute top grid texture background */}
      <div className="absolute inset-x-0 top-0 h-[400px] bg-gradient-to-b from-slate-200/20 via-transparent to-transparent pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 w-full py-6 flex-1 flex flex-col gap-6 relative z-10">
        
        {/* Modern App Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                <Cpu className="h-5 w-5 text-violet-600" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  Smart Hand Gesture Recognition
                  <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full font-mono uppercase font-bold shadow-xs">
                    v1.0 ML-Core
                  </span>
                </h1>
                <p className="text-xs text-slate-550 text-slate-500 font-medium">
                  Interactive real-time hand-landmarks mesh and computer interaction mapper.
                </p>
              </div>
            </div>
          </div>

          {/* Quick HUD controls */}
          <div className="flex flex-wrap items-center gap-3 backdrop-blur-md bg-white p-2 rounded-xl border border-slate-200">
            {/* Mesh Overlay Toggle */}
            <button
              onClick={() => updateSettings({ landmarkLinesEnabled: !settings.landmarkLinesEnabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                settings.landmarkLinesEnabled 
                  ? 'bg-violet-50 text-violet-700 border border-violet-100 shadow-xs font-bold' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              {settings.landmarkLinesEnabled ? 'Mesh Overlay ON' : 'Mesh Overlay OFF'}
            </button>

            {/* Voice Feedback Toggle */}
            <button
              onClick={() => updateSettings({ voiceFeedbackEnabled: !settings.voiceFeedbackEnabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                settings.voiceFeedbackEnabled 
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-xs font-bold' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {settings.voiceFeedbackEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {settings.voiceFeedbackEnabled ? 'Speech Feedback ON' : 'Speech Feedback OFF'}
            </button>
          </div>
        </header>

        {/* Primary Dashboard Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* LEFT SECTION: Cameras HUD & Showcase (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-5 justify-between">
            <CameraView
              onGestureDetected={handleGestureDetected}
              settings={settings}
              customTemplates={customTemplates}
              onFpsUpdate={setFps}
              onCameraActiveChange={setCameraActiveState}
              restartTrigger={cameraRestartTrigger}
            />

            {/* Active Recognition Spotlight under camera */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between items-stretch min-h-[110px] relative overflow-hidden group hover:border-slate-300 transition duration-300 shadow-xs">
              <div className="absolute right-0 top-0 h-[200px] w-[200px] bg-gradient-to-br from-violet-500/5 to-transparent blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-center z-10">
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-500 uppercase flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                  Neural Signal Output
                </span>
                {activeGesture && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold font-mono px-2 py-0.5 rounded-full border border-indigo-100/60 flex items-center gap-1 shadow-xs">
                    <Layers className="h-3 w-3" />
                    Hand: {activeHandSide}
                  </span>
                )}
              </div>

              {activeGesture ? (
                <div className="flex items-end justify-between mt-3 z-10 animate-fade-in">
                  <div>
                    <h2 className={`text-2xl font-extrabold leading-tight flex items-center gap-2 ${
                      activeGesture.name === 'Detecting...' ? 'text-violet-600 animate-pulse' : 'text-slate-800'
                    }`}>
                      {activeGesture.name}
                      {activeGesture.isCustom && (
                        <span className="text-[9px] bg-amber-50 text-amber-705 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full tracking-wider uppercase font-bold animate-pulse shadow-xs">
                          Custom Pose
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5">
                      <Award className={`h-3.5 w-3.5 text-indigo-600 hover:scale-110 transition-transform ${
                        activeGesture.name === 'Detecting...' ? 'animate-spin' : ''
                      }`} />
                      {activeGesture.name === 'Detecting...' ? 'Verifying skeletal pose stability...' : 'Predicted Landmark Confidence Vector'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono text-indigo-600 leading-none">
                      {Math.round(activeGesture.confidence * 100)}%
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono mt-0.5">Correlation</span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3 text-slate-400 z-10">
                  <div className="bg-slate-50 p-2.5 border border-slate-200 rounded-xl">
                    <ShieldAlert className="h-5 w-5 text-slate-355 text-slate-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Position Hand inside Webcam Frame</p>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Align knuckles flat to sensor to establish baseline skeletal vectors.
                    </p>
                  </div>
                </div>
              )}

              {/* Small Confidence progress bar indicator inside box */}
              {activeGesture && (
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-200 z-10 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300"
                    style={{ width: `${Math.round(activeGesture.confidence * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SECTION: Tab controls panel (5 columns) */}
          <div className="lg:col-span-5 flex flex-col">
            <GestureControls
              activeGesture={activeGesture}
              landmarks={activeLandmarks}
              settings={settings}
              onUpdateSettings={updateSettings}
            />
          </div>

        </div>

        {/* Dynamic Secondary Section: Custom template Training + history logging */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* Custom training panel */}
          <div className="md:col-span-7">
            <CustomTrainer
              activeLandmarks={activeLandmarks}
              customTemplates={customTemplates}
              onSaveTemplate={saveCustomTemplate}
              onDeleteTemplate={deleteCustomTemplate}
            />
          </div>

          {/* Real-time history logs */}
          <div className="md:col-span-5">
            <HistoryLog
              logs={logs}
              onClearLogs={clearLogs}
            />
          </div>

        </div>

        {/* Bottom Metrics dashboard */}
        <DashboardStats
          analyticsData={analytics}
          activeFps={fps}
        />

        {/* Dynamic Diagnostics Command Hub */}
        <DiagnosticsPanel
          wsStatus={wsStatus}
          wsErrors={wsErrors}
          cameraActive={cameraActiveState}
          activeHand={activeHandSide}
          activeGesture={activeGesture}
          activeLandmarks={activeLandmarks}
          fps={fps}
          settings={settings}
          onRestartCamera={() => setCameraRestartTrigger(v => v + 1)}
          onForceWsReconnect={() => setReconnectTrigger(v => v + 1)}
        />

        {/* Mini Technical Informational card */}
        <footer className="mt-4 bg-white rounded-xl border border-slate-200 p-4 flex gap-3 text-slate-500 shadow-xs">
          <Info className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
              Architecture Sandbox Info
            </h5>
            <p className="text-[11px] leading-relaxed text-slate-400 font-semibold">
              This system compiles MediaPipe landmark models natively using browser WebAssembly. 
              The 21 coordinates represent physical positions in 3D sensor plane space. Custom gesture classifiers compute 
              normalized cumulative Euclidean distances against user templates to trigger smart macro triggers locally on-device.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}
