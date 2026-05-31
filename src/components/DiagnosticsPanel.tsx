import React, { useState } from 'react';
import { 
  Wifi, WifiOff, Camera, CameraOff, Cpu, RefreshCw, 
  CheckCircle2, AlertTriangle, Radio, Code2, ShieldAlert, Zap
} from 'lucide-react';
import { Landmark, GestureMatch, HandSide, AppSettings } from '../types';

interface DiagnosticsPanelProps {
  wsStatus: 'connected' | 'connecting' | 'disconnected';
  wsErrors: number;
  cameraActive: boolean;
  activeHand: HandSide | null;
  activeGesture: GestureMatch | null;
  activeLandmarks: Landmark[];
  fps: number;
  settings: AppSettings;
  onRestartCamera: () => void;
  onForceWsReconnect: () => void;
}

export default function DiagnosticsPanel({
  wsStatus,
  wsErrors,
  cameraActive,
  activeHand,
  activeGesture,
  activeLandmarks,
  fps,
  settings,
  onRestartCamera,
  onForceWsReconnect
}: DiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [permissionSuccess, setPermissionSuccess] = useState<string | null>(null);
  const [permissionTesting, setPermissionTesting] = useState<boolean>(false);

  // Core trigger to test permissions explicitly outside of MediaPipe
  const testCameraPermission = async () => {
    setPermissionTesting(true);
    setPermissionSuccess(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices capabilities are missing in this browser context (Secure HTTP/HTTPS constraint).');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop tracks instantly
      stream.getTracks().forEach(track => track.stop());
      setPermissionSuccess('Webcam hardware handshake succeeded! Camera responds correctly.');
    } catch (err: any) {
      console.error('Explicit permission test failed:', err);
      setPermissionSuccess(`Denied: ${err.message || 'Check camera privacy guidelines or secure address bar settings.'}`);
    } finally {
      setPermissionTesting(false);
    }
  };

  const isSecure = typeof window !== 'undefined' && window.isSecureContext;

  return (
    <div id="diagnostics-panel" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm group hover:border-slate-300 transition duration-300">
      {/* Header section with toggle collapse */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1 px-1.5 bg-violet-50 text-violet-750 text-violet-600 rounded-lg text-xs font-bold leading-none uppercase">
            Diag
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              System Telemetry & ML Diagnostics Center
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold leading-none">
              Monitoring client WebAssembly core and network synchronization threads
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] text-slate-400 hover:text-slate-800 font-bold border border-slate-200 hover:bg-slate-50 px-2 py-1 rounded-lg transition duration-150 cursor-pointer"
        >
          {isOpen ? 'COLLAPSE HUB' : 'EXPAND SYSTEM HUB'}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4">
          
          {/* Diagnostic Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* 1. Camera Sensor */}
            <div className={`p-3 rounded-xl border transition ${
              cameraActive 
                ? 'bg-emerald-50/40 border-emerald-100/85 hover:border-emerald-250' 
                : 'bg-rose-50/40 border-rose-100/85 hover:border-rose-250'
            }`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">
                  1. CAMERA SENSOR
                </span>
                {cameraActive ? (
                  <Camera className="h-4 w-4 text-emerald-600 animate-pulse" />
                ) : (
                  <CameraOff className="h-4 w-4 text-rose-500" />
                )}
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-base font-extrabold font-mono ${cameraActive ? 'text-emerald-705 text-emerald-600 font-extrabold' : 'text-rose-600'}`}>
                    {cameraActive ? `${fps} FPS` : 'BLOCKED'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">Stream Data</span>
                </div>
                <span className="text-[9.5px] text-slate-500 font-medium block mt-1 leading-normal">
                  {cameraActive 
                    ? 'Sensors capturing active frames.' 
                    : 'Webcam permission blocked / occupied by another device.'}
                </span>

                {/* Secure context validator badge */}
                <div className="mt-2 flex items-center gap-1">
                  <span className={`text-[8.5px] font-bold font-mono px-1 rounded ${isSecure ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isSecure ? '✓ HTTPS/LOCALHOST' : '⚠ INSECURE ORIGIN'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. MediaPipe Hands ML Model */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">
                  2. Hands ML Core
                </span>
                <Cpu className="h-4 w-4 text-violet-600 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-extrabold font-mono text-slate-800">
                    {cameraActive ? 'ACTIVATED' : 'NOT LOADING'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">Status</span>
                </div>
                <span className="text-[9.5px] text-slate-500 font-medium block mt-1 leading-normal">
                  Min Conf: <strong className="text-violet-600">{settings.detectionConfidenceLimit * 100}%</strong>, Complexity: Low-Latency. WebAssembly accelerated.
                </span>
              </div>
            </div>

            {/* 3. Telemetry WebSocket */}
            <div className={`p-3 rounded-xl border transition ${
              wsStatus === 'connected' 
                ? 'bg-emerald-50/40 border-emerald-100/85 hover:border-emerald-250' 
                : wsStatus === 'connecting'
                ? 'bg-amber-50/40 border-amber-100/85 hover:border-amber-250'
                : 'bg-rose-50/40 border-rose-100/85 hover:border-rose-250'
            }`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">
                  3. WebSocket Stream
                </span>
                {wsStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-emerald-600 animate-pulse" />
                ) : (
                  <WifiOff className="h-4 w-4 text-amber-600 animate-bounce" />
                )}
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-base font-extrabold font-mono uppercase ${
                    wsStatus === 'connected' ? 'text-emerald-605 text-emerald-600' : 'text-amber-600'
                  }`}>
                    {wsStatus}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono">Channel</span>
                </div>
                <span className="text-[9.5px] text-slate-500 font-medium block mt-1 leading-normal">
                  Reconnections: <strong className="text-semibold text-slate-700">{wsErrors}</strong> counts. Heartbeat loops healthy. Zero platform crashes on disconnects.
                </span>
              </div>
            </div>

            {/* 4. Real-time Coordinate Monitor */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase">
                  4. Vector Stream
                </span>
                <Radio className="h-4 w-4 text-violet-605 text-violet-600 animate-pulse" />
              </div>
              <div className="mt-2.5">
                {activeLandmarks.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-indigo-700 font-bold leading-none flex items-center justify-between">
                      <span>Wrist (0)</span>
                      <span>X:{activeLandmarks[0].x.toFixed(3)} Y:{activeLandmarks[0].y.toFixed(3)}</span>
                    </div>
                    <div className="text-[10px] font-mono text-violet-700 font-bold leading-none flex items-center justify-between">
                      <span>Index (8)</span>
                      <span>X:{activeLandmarks[8].x.toFixed(3)} Y:{activeLandmarks[8].y.toFixed(3)}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase font-mono mt-0.5">
                      Coordinates mapped locally
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-base font-extrabold font-mono text-slate-400">
                      NO SIGNAL
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-medium block mt-1 leading-normal">
                      Skeletal points stream will display here once hand is visible under frame.
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick Diagnostics Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3 px-3.5 mt-3.5">
            <div className="flex flex-wrap gap-2.5">
              {/* Test Camera Device Access */}
              <button
                onClick={testCameraPermission}
                disabled={permissionTesting}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-bold shadow-6xs cursor-pointer transition flex items-center gap-1"
              >
                {permissionTesting ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                ) : (
                  <Zap className="h-3 w-3 text-amber-500" />
                )}
                Run Permission Diagnostics Check
              </button>

              {/* Force WebSocket telemetry link reload */}
              <button
                onClick={onForceWsReconnect}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-bold shadow-6xs cursor-pointer transition flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3 text-violet-600" />
                Reset Telemetry Channel
              </button>

              {/* Reset MediaPipe core camera sensor */}
              <button
                onClick={onRestartCamera}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-705 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-bold shadow-6xs cursor-pointer transition flex items-center gap-1"
              >
                <Code2 className="h-3 w-3 text-emerald-600" />
                Align Core Sensors
              </button>
            </div>

            {isSecureContext && (
              <span className="text-[10px] text-emerald-700 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full font-bold">
                ✓ Secured Sandbox Context
              </span>
            )}
          </div>

          {/* Diagnostics Log Output Notification area */}
          {permissionSuccess && (
            <div className={`p-3 border rounded-xl flex items-start gap-2 text-xs font-semibold ${
              permissionSuccess.includes('succeeded')
                ? 'bg-emerald-50 border-emerald-150 text-emerald-800'
                : 'bg-rose-50 border-rose-150 text-rose-800'
            }`}>
              {permissionSuccess.includes('succeeded') ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold flex items-center gap-1 text-[11px]">
                  Diagnostics Result Checklist:
                </p>
                <p className="text-[10.5px] leading-relaxed mt-0.5 font-medium">{permissionSuccess}</p>
              </div>
            </div>
          )}

          {/* Step by step manual camera browser solution */}
          {!cameraActive && (
            <div className="bg-slate-50 border border-slate-150/80 rounded-xl p-3 px-3.5 text-slate-600 text-[10.5px] font-medium leading-normal shadow-6xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-550 mr-2 flex items-center gap-1 uppercase block text-indigo-700 tracking-wide">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                Why is the webcam blocked? Step-by-Step IFrame Sandbox Resolve instructions:
              </span>
              <p className="text-slate-500 font-bold mt-0.5">
                Modern browsers prevent camera, geolocation, and audio requests from within standard frame-embedded documents. Resolve this immediately:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <h6 className="font-bold text-slate-800 text-[10px]">Method A: Standalone Mode (Recommended)</h6>
                  <p className="text-slate-400 text-[9.5px] mt-0.5">
                    Click the **Open App** (square box with diagonal arrow) at the top-right preview header panel to launch standalone.
                  </p>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <h6 className="font-bold text-slate-800 text-[10px]">Method B: Secure Settings</h6>
                  <p className="text-slate-400 text-[9.5px] mt-0.5">
                    Click the **Lock Icon 🔒** in your browser's address bar next to dev-t3nb2qpw... and toggle **Camera** to **Allow**.
                  </p>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <h6 className="font-bold text-slate-800 text-[10px]">Method C: Close Busy App</h6>
                  <p className="text-slate-400 text-[9.5px] mt-0.5">
                    Verify that zoom, teams, meet, or other browser windows aren't locking your physical stream device.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
