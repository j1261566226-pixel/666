import React, { useEffect, useState } from 'react';
import { AppState, InputMode } from '../types';

interface HUDProps {
  inputMode: InputMode | null;
  appState: AppState;
  cursorX: number;
  cursorY: number;
  isPinching: boolean;
  showCursor: boolean;
}

export const HUD: React.FC<HUDProps> = ({ inputMode, appState, cursorX, cursorY, isPinching, showCursor }) => {
  const [instructions, setInstructions] = useState<string[]>([]);

  useEffect(() => {
    if (!inputMode) return;
    if (inputMode === InputMode.CAMERA) {
      setInstructions([
        "✊ 握拳：退出/回树",
        "✋ 举手：星河轮播",
        "👌 按住：放大照片",
        "🫶 双手比心：回忆杀"
      ]);
    } else {
      setInstructions([
        "🖱️ 长按左键：退出/回树",
        "⬆️ 移至顶部：星河轮播",
        "🖱️ 点击：放大照片"
      ]);
    }
  }, [inputMode]);

  if (!inputMode) return null;

  return (
    <>
      {/* Instructions */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-center pointer-events-none z-10 w-[90%] transition-opacity duration-1000">
        {instructions.map((text, i) => (
          <span key={i} className="inline-block m-1 text-sm bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
            {text}
          </span>
        ))}
      </div>

      {/* Hand Cursor */}
      {showCursor && (
        <div 
          className={`absolute w-8 h-8 border-2 border-white/80 rounded-full pointer-events-none z-50 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-200 ${isPinching ? 'w-5 h-5 bg-[#ffd700]/80 border-[#ffd700]' : ''}`}
          style={{ left: cursorX, top: cursorY }}
        />
      )}
    </>
  );
};
