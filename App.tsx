import React, { useEffect, useRef, useState } from 'react';
import { ThreeEngine } from './services/ThreeEngine';
import { loadScripts } from './services/scriptLoader';
import { MEDIAPIPE_URLS, CONFIG } from './constants';
import { AppState, InputMode } from './types';
import { IntroScreen } from './components/IntroScreen';
import { HUD } from './components/HUD';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ThreeEngine | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.INTRO);
  const [isLoading, setIsLoading] = useState(false);
  const [cursorState, setCursorState] = useState({ x: 0, y: 0, isPinching: false, visible: false });

  // Mouse logic state
  const mouseRef = useRef({ x: 0, y: 0, isDown: false, downTime: 0 });

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      engineRef.current = new ThreeEngine(containerRef.current, (state) => setAppState(state));
    }
    return () => engineRef.current?.dispose();
  }, []);

  const handleSelectMode = async (mode: InputMode) => {
    setInputMode(mode);
    setIsLoading(true);
    
    if (engineRef.current) {
      engineRef.current.setMode(mode);
    }

    if (mode === InputMode.CAMERA) {
      try {
        await loadScripts(MEDIAPIPE_URLS);
        initMediaPipe();
      } catch (e) {
        console.error("Failed to load MediaPipe", e);
        alert("无法加载摄像头组件，请检查网络");
        setIsLoading(false);
      }
    } else {
        initMouseControls();
        setIsLoading(false);
        setCursorState(prev => ({ ...prev, visible: true }));
    }
  };

  const initMouseControls = () => {
    const handleMove = (e: MouseEvent) => {
       if (!engineRef.current) return;
       engineRef.current.updateMouse(e.clientX, e.clientY, mouseRef.current.isDown);
       setCursorState({ x: e.clientX, y: e.clientY, isPinching: mouseRef.current.isDown, visible: true });
    };
    
    const handleDown = () => {
       mouseRef.current.isDown = true;
       mouseRef.current.downTime = Date.now();
       if (engineRef.current) engineRef.current.updateMouse(mouseRef.current.x, mouseRef.current.y, true);
    };

    const handleUp = () => {
        mouseRef.current.isDown = false;
        if (engineRef.current) {
            engineRef.current.updateMouse(mouseRef.current.x, mouseRef.current.y, false);
            engineRef.current.setFistGesture(false); 
        }
    };
    
    // Check for long press (simulating Fist)
    const checkLongPress = setInterval(() => {
        if (mouseRef.current.isDown && Date.now() - mouseRef.current.downTime > 500) {
            if (engineRef.current) engineRef.current.setFistGesture(true);
        }
    }, 100);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    
    // Cleanup handled by global event listeners, but for a pure component we might want to remove them.
    // For this app, they persist for the session.
  };

  const initMediaPipe = () => {
    if (!videoRef.current) return;
    
    const hands = new window.Hands({locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    
    hands.onResults((results: any) => {
        setIsLoading(false);
        if (!engineRef.current) return;

        let handData = { present: false, x: 0.5, y: 0.5, isPinching: false, isFist: false, isHeartGesture: false };
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            handData.present = true;
            const landmarks = results.multiHandLandmarks[0];
            
            // Heart Gesture Check (2 hands)
            if (results.multiHandLandmarks.length === 2) {
                const h1 = results.multiHandLandmarks[0];
                const h2 = results.multiHandLandmarks[1];
                const distIdx = Math.hypot(h1[8].x - h2[8].x, h1[8].y - h2[8].y);
                const distThumb = Math.hypot(h1[4].x - h2[4].x, h1[4].y - h2[4].y);
                if (distIdx < 0.1 && distThumb < 0.1) handData.isHeartGesture = true;
            }

            // Finger counting (simple logic)
            const wrist = landmarks[0];
            const tips = [8, 12, 16, 20];
            const extended = tips.filter(idx => Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y) > 0.15).length;
            
            handData.isFist = extended < 2;
            
            // Position (Index finger tip or avg)
            handData.x = 1 - landmarks[8].x; // Mirror
            handData.y = landmarks[8].y;
            
            // Pinch
            const pinchDist = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
            handData.isPinching = pinchDist < 0.05;
            
            setCursorState({
                x: handData.x * window.innerWidth,
                y: handData.y * window.innerHeight,
                isPinching: handData.isPinching,
                visible: true
            });
        } else {
            setCursorState(prev => ({ ...prev, visible: false }));
        }
        
        engineRef.current.updateHand(handData);
    });

    handsRef.current = hands;
    
    const camera = new window.Camera(videoRef.current, {
        onFrame: async () => { await hands.send({image: videoRef.current}); },
        width: 640,
        height: 480
    });
    camera.start();
    cameraRef.current = camera;
  };

  const handlePhotoUpload = (files: FileList) => {
    const urls: string[] = [];
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                urls.push(e.target.result as string);
                if (urls.length === files.length && engineRef.current) {
                    engineRef.current.loadUserPhotos(urls);
                }
            }
        };
        reader.readAsDataURL(file);
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
       {/* 3D Scene Container */}
       <div ref={containerRef} className="absolute inset-0 z-0" />
       
       {/* UI Layers */}
       {!inputMode && (
          <IntroScreen 
            onSelectMode={handleSelectMode} 
            onPhotoUpload={handlePhotoUpload}
            isLoading={isLoading} 
          />
       )}
       
       {/* Loading Overlay */}
       {isLoading && (
         <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 text-white">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
            <div>正在初始化视觉引擎...</div>
         </div>
       )}

       <HUD 
         inputMode={inputMode} 
         appState={appState} 
         cursorX={cursorState.x}
         cursorY={cursorState.y}
         isPinching={cursorState.isPinching}
         showCursor={cursorState.visible}
       />

       {/* Hidden video for MediaPipe */}
       <video 
         ref={videoRef} 
         className={`absolute top-4 right-4 w-40 h-32 scale-x-[-1] rounded-lg opacity-70 border-2 border-white/30 z-20 pointer-events-none ${inputMode === InputMode.CAMERA ? 'block' : 'hidden'}`}
         playsInline
       />
    </div>
  );
};

export default App;
