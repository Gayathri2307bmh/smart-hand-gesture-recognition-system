import React, { useState, useEffect } from 'react';
import { Sparkles, Play, StopCircle, RefreshCw, Trash2, HelpCircle, Trophy, Disc } from 'lucide-react';
import { Landmark, CustomGestureTemplate } from '../types';
import { normalizeHandLandmarks } from '../utils/classifier';

interface CustomTrainerProps {
  activeLandmarks: Landmark[];
  customTemplates: CustomGestureTemplate[];
  onSaveTemplate: (template: CustomGestureTemplate) => void;
  onDeleteTemplate: (id: string) => void;
}

export default function CustomTrainer({
  activeLandmarks,
  customTemplates,
  onSaveTemplate,
  onDeleteTemplate
}: CustomTrainerProps) {
  const [gestureName, setGestureName] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [samplesCaptured, setSamplesCaptured] = useState<Landmark[][]>([]);
  const [isDone, setIsDone] = useState<boolean>(false);

  // Auto-recording capture clock
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isRecording && countdown === 0) {
      // Start capturing frames!
      startFrameHarvesting();
    }
    return () => clearTimeout(timer);
  }, [isRecording, countdown]);

  const startTrainingSequence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gestureName.trim()) return;
    
    // Reset States
    setSamplesCaptured([]);
    setIsDone(false);
    setIsRecording(true);
    setCountdown(3); // 3-second countdown before harvesting images
  };

  const startFrameHarvesting = () => {
    let framesCollected: Landmark[][] = [];
    const intervalTime = 120; // capture every 120ms
    const totalFramesNeeded = 12;

    const harvestInterval = setInterval(() => {
      // Check if user has their hand in front of the camera
      if (activeLandmarks && activeLandmarks.length === 21) {
        // Normalize the hand pose landmarks
        const normalized = normalizeHandLandmarks(activeLandmarks);
        framesCollected.push(normalized);
        setSamplesCaptured([...framesCollected]);
      }

      if (framesCollected.length >= totalFramesNeeded) {
        clearInterval(harvestInterval);
        finalizeModelTraining(framesCollected);
      }
    }, intervalTime);
  };

  const finalizeModelTraining = (frames: Landmark[][]) => {
    setIsRecording(false);
    if (frames.length === 0) {
      alert('Could not capture hand joint features. Make sure your hand is visible in the webcam feed.');
      return;
    }

    // Data Augmentation & Dataset Balancing:
    // Generate exactly 10 variations (combining random scale, 2D Z-rotation, and 3D coordinate jitter)
    // for each of the 12 captured frames, producing exactly 120 balanced samples for model average training.
    const augmentedFrames: Landmark[][] = [];
    frames.forEach(frame => {
      // 1. Maintain original ground-truth sample
      augmentedFrames.push(frame);

      // 2. Generate 9 synthetic augmented twins
      for (let k = 0; k < 9; k++) {
        const scale = 0.90 + Math.random() * 0.20; // scale boundary: 90% to 110%
        const rotRad = (Math.random() - 0.5) * 0.52; // rotation boundary: ~ -15 to +15 deg
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);

        const augmentedTwin = frame.map(lm => {
          // Perform orbital rotation around origin (wrist) on the Z-sensor plane
          const rx = lm.x * cos - lm.y * sin;
          const ry = lm.x * sin + lm.y * cos;

          // Introduce gaussian-like noise (micro-shivers/jitter)
          const jitterX = (Math.random() - 0.5) * 0.02;
          const jitterY = (Math.random() - 0.5) * 0.02;
          const jitterZ = (Math.random() - 0.5) * 0.01;

          return {
            x: rx * scale + jitterX,
            y: ry * scale + jitterY,
            z: lm.z * scale + jitterZ
          };
        });
        augmentedFrames.push(augmentedTwin);
      }
    });

    // 3. Compute mathematically superior average of 21 landmark positions across all 120 balanced samples
    const averageLandmarks: Landmark[] = [];
    for (let jointId = 0; jointId < 21; jointId++) {
      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;

      augmentedFrames.forEach(frame => {
        const joint = frame[jointId];
        if (joint) {
          sumX += joint.x;
          sumY += joint.y;
          sumZ += joint.z;
        }
      });

      averageLandmarks.push({
        x: sumX / augmentedFrames.length,
        y: sumY / augmentedFrames.length,
        z: sumZ / augmentedFrames.length
      });
    }

    // 4. Generate augmented trained dataset templates bundle
    const newTemplate: CustomGestureTemplate = {
      id: Math.random().toString(36).substring(2, 9),
      name: gestureName.trim(),
      samples: augmentedFrames,
      averageLandmarks,
      createdAt: new Date().toISOString()
    };

    // 3. Save to app registry
    onSaveTemplate(newTemplate);
    setIsDone(true);
    setGestureName('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 h-full">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-mono">Custom Gesture Recorder</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Playbook form panel */}
        <div className="lg:col-span-6 space-y-4">
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Record unique postures (e.g. "Spider-Man", "A Peace Sign") and train on-the-fly local models.
          </p>

          {!isRecording && !isDone && (
            <form onSubmit={startTrainingSequence} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500">
                  Gesture Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Finger Gun, Spock"
                  value={gestureName}
                  onChange={(e) => setGestureName(e.target.value)}
                  maxLength={20}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-violet-500/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500/10 transition duration-200 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={!gestureName.trim() || !activeLandmarks || activeLandmarks.length === 0}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-50 disabled:to-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:border text-white rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                {!activeLandmarks || activeLandmarks.length === 0 ? 'Place Hand to Unlock' : 'Start Auto Recording'}
              </button>
            </form>
          )}

          {/* Training Interactive Overlays */}
          {isRecording && (
            <div className="p-4 bg-slate-50 rounded-xl border border-violet-100 text-center space-y-3">
              {countdown > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-violet-600 font-mono tracking-widest uppercase animate-pulse font-bold">
                    Hold Gesture Prompt!
                  </p>
                  <h4 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
                    {countdown}
                  </h4>
                  <p className="text-[10px] text-slate-400">Capture begins in a moment...</p>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex justify-center">
                    <Disc className="h-6 w-6 text-rose-500 animate-spin" />
                  </div>
                  <p className="text-xs text-rose-600 font-bold font-mono">Recording Active</p>
                  <div className="w-full bg-slate-100 border border-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-all duration-100"
                      style={{ width: `${(samplesCaptured.length / 12) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Harvesting landmarks: <span className="font-bold text-slate-800">{samplesCaptured.length}</span>/12 frames
                  </p>
                </div>
              )}
            </div>
          )}

          {isDone && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center space-y-3 animate-fade-in">
              <div className="bg-emerald-100 text-emerald-700 h-10 w-10 flex items-center justify-center rounded-full mx-auto">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-700">Auto Calibration Successful</h4>
                <p className="text-[10px] text-slate-550 text-slate-500 mt-1">
                  Landmarks processed and compiled instantly. Your gesture is now integrated into the neural classifications engine.
                </p>
              </div>
              <button
                onClick={() => setIsDone(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-[10px] font-semibold transition cursor-pointer"
              >
                Record Another Poses
              </button>
            </div>
          )}
        </div>

        {/* Existing templates catalog */}
        <div className="lg:col-span-6 space-y-3 h-[210px] overflow-y-auto pr-1">
          <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 block pb-1 border-b border-slate-100">
            Registered Customs ({customTemplates.length})
          </label>

          {customTemplates.length === 0 ? (
            <div className="h-[160px] flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-center">
              <HelpCircle className="h-5 w-5 text-slate-300 mb-1" />
              <p className="text-[10px] font-medium">No custom gestures found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customTemplates.map((item) => (
                <div
                  key={item.id}
                  className="p-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition rounded-xl flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <span className="text-xs font-bold text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      {item.samples.length} frames • {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => onDeleteTemplate(item.id)}
                    className="text-rose-600 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition"
                    title="Deregister trained gesture"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
