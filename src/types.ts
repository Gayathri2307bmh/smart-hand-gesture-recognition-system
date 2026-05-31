export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandSide = 'Left' | 'Right';

export interface GestureMatch {
  name: string;
  confidence: number;
  isCustom?: boolean;
}

export interface CustomGestureTemplate {
  id: string;
  name: string;
  samples: Landmark[][]; // Multiple recorded frames
  averageLandmarks: Landmark[]; // Calculated average for fast nearest-neighbor matching
  createdAt: string;
}

export interface GestureLog {
  id: string;
  timestamp: Date;
  gesture: string;
  confidence: number;
  handSide: HandSide;
}

export interface DailyStat {
  date: string;
  count: number;
}

export interface GestureFrequency {
  gesture: string;
  count: number;
}

export interface AnalyticsData {
  totalDetected: number;
  mostUsedGesture: string;
  gestureFrequency: GestureFrequency[];
  dailyStats: DailyStat[];
  accuracyMetric: number; // overall simulated/active model matching rate
}

export interface AppSettings {
  voiceFeedbackEnabled: boolean;
  voiceVolume: number;
  detectionConfidenceLimit: number;
  drawingColor: string;
  drawingBrushSize: number;
  activeControlMode: 'none' | 'drawing' | 'volume' | 'presentation' | 'smarthome' | 'library';
  landmarkLinesEnabled: boolean;
  smoothFilter: boolean;
}

export interface SlideContent {
  title: string;
  description: string;
  bullets: string[];
}
