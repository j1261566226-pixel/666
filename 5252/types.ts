export enum AppState {
  INTRO = 'intro',
  TREE = 'tree',
  EXPLODE = 'explode',
  CAROUSEL = 'carousel',
  HEART_MOMENT = 'heart_moment'
}

export enum InputMode {
  MOUSE = 'mouse',
  CAMERA = 'camera'
}

export interface HandData {
  present: boolean;
  x: number; // 0-1
  y: number; // 0-1
  isPinching: boolean;
  isFist: boolean;
  isHeartGesture: boolean;
}

export interface PhotoData {
  url: string;
}

// Global types for MediaPipe since we load via CDN
declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
  }
}
