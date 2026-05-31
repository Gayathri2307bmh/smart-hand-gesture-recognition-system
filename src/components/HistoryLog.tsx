import React from 'react';
import { Clock, Trash2, ListFilter, Cpu } from 'lucide-react';
import { GestureLog } from '../types';

interface HistoryLogProps {
  logs: GestureLog[];
  onClearLogs: () => void;
}

export default function HistoryLog({ logs, onClearLogs }: HistoryLogProps) {
  // Map specific gestures to aesthetic theme colours
  const getBadgeColors = (gesture: string) => {
    const term = gesture.toLowerCase();
    if (term.includes('thumbs up')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    } else if (term.includes('stop') || term.includes('down') || term.includes('fist')) {
      return 'bg-rose-50 text-rose-700 border-rose-100';
    } else if (term.includes('victory') || term.includes('ok')) {
      return 'bg-violet-50 text-violet-700 border-violet-105 border-violet-200/50';
    } else if (term.includes('pointing') || term.includes('rock')) {
      return 'bg-amber-50 text-amber-700 border-amber-100';
    }
    return 'bg-blue-50 text-blue-700 border-blue-100';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-full min-h-[300px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-violet-600" />
          <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase font-mono">Gesture History Log</h3>
        </div>
        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer border border-transparent hover:border-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Log
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
          <div className="bg-slate-50 p-3 rounded-full border border-slate-100 mb-2">
            <ListFilter className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No signals recorded yet</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
            Position your hand in front of the camera to trigger real-time detection logs.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[290px] pr-1 space-y-2 custom-scrollbar">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition border border-slate-100 flex items-center justify-between gap-3 animate-fade-in-up"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-[11px] font-semibold tracking-wide px-2.5 py-0.5 rounded-full border ${getBadgeColors(log.gesture)}`}>
                  {log.gesture}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-600 font-semibold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {log.handSide}
                </span>
                <div className="flex items-center gap-0.5" title="Confidence Score">
                  <Cpu className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-700 font-bold font-mono">
                    {Math.round(log.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
