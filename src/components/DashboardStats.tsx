import React from 'react';
import { BarChart3, TrendingUp, Award, Zap, Activity, Info, BarChart } from 'lucide-react';
import { AnalyticsData } from '../types';

interface DashboardStatsProps {
  analyticsData: AnalyticsData;
  activeFps: number;
}

export default function DashboardStats({ analyticsData, activeFps }: DashboardStatsProps) {
  const { totalDetected, mostUsedGesture, gestureFrequency, dailyStats, accuracyMetric } = analyticsData;

  // Max occurrence helper for rendering percentage bars
  const maxOccurrences = gestureFrequency.length > 0 
    ? Math.max(...gestureFrequency.map(g => g.count)) 
    : 1;

  // Aesthetic colors for categories
  const getProgressColor = (index: number) => {
    const colors = [
      'bg-indigo-650 bg-indigo-600 shadow-indigo-100',
      'bg-violet-650 bg-violet-600 shadow-violet-100',
      'bg-indigo-600 bg-indigo-500 shadow-indigo-55',
      'bg-purple-650 bg-purple-600 shadow-purple-100',
      'bg-rose-550 bg-rose-500 shadow-rose-100'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* 4-Bento Grid Stats Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Detections */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-350 hover:border-slate-300 transition duration-300 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold font-mono text-slate-400 capitalize">Total Detected</span>
            <span className="p-2 bg-violet-50 text-violet-600 rounded-xl border border-violet-100/50">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-extrabold tracking-tight text-slate-800 mb-0.5">{totalDetected}</h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <TrendingUp className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Real-time telemetry</span>
            </div>
          </div>
        </div>

        {/* Card 2: Most Common Gesture */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-350 hover:border-slate-300 transition duration-300 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold font-mono text-slate-400 capitalize">Most Active Pose</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-extrabold tracking-tight text-slate-800 truncate mb-0.5" title={mostUsedGesture}>
              {mostUsedGesture || 'No Handoff'}
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold">Highest recurrent density</p>
          </div>
        </div>

        {/* Card 3: Model Target Accuracy */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-350 hover:border-slate-300 transition duration-300 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold font-mono text-slate-400 capitalize">Classification S/N</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
              <Zap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-extrabold tracking-tight text-slate-800 mb-0.5">
              {Math.round(accuracyMetric * 100)}%
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold">Pose signal-to-noise ratio</p>
          </div>
        </div>

        {/* Card 4: Hardware FPS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-350 hover:border-slate-300 transition duration-300 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold font-mono text-slate-400 capitalize">Sensor Frame Rate</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
              <BarChart3 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-extrabold tracking-tight text-slate-800 mb-0.5">
              {activeFps > 0 ? `${activeFps} FPS` : 'Idle'}
            </h4>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${activeFps > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span>{activeFps > 0 ? 'Optimal Frame Stream' : 'Awaiting webcam sensor'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Distribution Frequency Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs md:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xs font-bold tracking-tight text-slate-800 uppercase flex items-center gap-1.5">
                  <BarChart className="h-4 w-4 text-violet-600" />
                  Gesture Distribution
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Comparative frequency logs of current session</p>
              </div>
            </div>

            {gestureFrequency.length === 0 ? (
              <div className="h-[210px] flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                <Info className="h-4 w-4 text-slate-300 mb-1" />
                <p className="text-xs font-semibold text-slate-700">No telemetry recorded</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Trigger hand gestures in webcam feed</p>
              </div>
            ) : (
              <div className="space-y-3.5 h-[210px] overflow-y-auto pr-1">
                {gestureFrequency.slice(0, 5).map((gf, idx) => {
                  const pct = Math.max(8, Math.round((gf.count / maxOccurrences) * 100));
                  return (
                    <div key={gf.gesture} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>{gf.gesture}</span>
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">
                          {gf.count} hits ({Math.round((gf.count / totalDetected) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-150 border-slate-200/40">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(idx)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Daily Stats Log Chart (Interactive SVG Grid) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs md:col-span-5 flex flex-col">
          <div className="mb-4">
            <h4 className="text-xs font-bold tracking-tight text-slate-800 uppercase flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Activity Trend (24h)
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Tracking periodic detection density</p>
          </div>

          <div className="flex-1 flex flex-col justify-end">
            {dailyStats.length === 0 ? (
              <div className="h-[180px] flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                <Info className="h-4 w-4 text-slate-300 mb-1" />
                <p className="text-xs font-semibold text-slate-700">Uptime statistics clearing</p>
              </div>
            ) : (
              <div className="relative h-[180px] w-full flex flex-col justify-between">
                
                {/* SVG Area Chart representing historical timeline */}
                <div className="absolute inset-0 flex items-end">
                  <svg className="w-full h-[120px] overflow-visible" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={generateSvgPath(dailyStats)}
                      fill="url(#chartGrad)"
                      stroke="#4f46e5"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                {/* Timeline Axis Labels */}
                <div className="w-full h-full flex flex-col justify-between relative z-10 pointer-events-none">
                  <div className="flex justify-between text-[8px] font-bold font-mono text-slate-400 border-b border-slate-100 pb-1">
                    <span>MAX</span>
                    <span>{Math.max(...dailyStats.map(d => d.count), 5)}</span>
                  </div>
                  <div className="flex justify-between text-[8px] font-bold font-mono text-slate-400 border-b border-slate-100 pb-1">
                    <span>MID</span>
                    <span>{Math.round(Math.max(...dailyStats.map(d => d.count), 5) / 2)}</span>
                  </div>
                  <div className="flex justify-between items-end text-[9px] font-bold font-mono text-slate-400 pt-1">
                    {dailyStats.map(stat => (
                      <span key={stat.date}>{stat.date}</span>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Generate path strings helper for SVG trend chart
function generateSvgPath(data: any[]): string {
  if (data.length === 0) return '';
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const widthStep = 100 / (data.length - 1);
  
  // Point strings
  const points = data.map((d, i) => {
    const x = i * widthStep;
    const y = 50 - (d.count / maxVal) * 40; // reserve padding
    return `${x},${y}`;
  });

  // Construct closed loop for area chart
  return `M 0,50 L ${points.join(' L ')} L 100,50 Z`;
}
