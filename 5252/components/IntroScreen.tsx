import React from 'react';
import { InputMode } from '../types';

interface IntroScreenProps {
  onSelectMode: (mode: InputMode) => void;
  onPhotoUpload: (files: FileList) => void;
  isLoading: boolean;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onSelectMode, onPhotoUpload, isLoading }) => {
  return (
    <div className={`absolute top-0 left-0 w-full h-full bg-black/85 z-20 flex flex-col justify-center items-center text-white transition-opacity duration-1000 ${isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <h1 className="mb-5 font-light tracking-widest font-['Great_Vibes'] text-6xl text-shadow-pink">
        Merry Christmas WRQ
      </h1>
      <div className="subtitle mb-8 opacity-80 text-sm">互动前，请先加载我们的记忆</div>

      <input 
        type="file" 
        id="file-input" 
        multiple 
        accept="image/*" 
        className="hidden"
        onChange={(e) => e.target.files && onPhotoUpload(e.target.files)}
      />
      
      <button 
        className="btn border border-white/60 bg-white/10 text-[#ffd700] border-[#ffd700] rounded-full px-8 py-4 m-2 text-lg hover:bg-yellow-500/20 hover:scale-105 transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.3)]"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        🖼️ 加载我们的记忆 (可选)
      </button>
      
      <div className="w-24 h-[1px] bg-white/20 my-4"></div>

      <button 
        className="btn border border-white/60 bg-white/10 text-white rounded-full px-8 py-4 m-2 text-lg hover:bg-white/30 hover:scale-105 transition-all duration-300 backdrop-blur-sm min-w-[220px]"
        onClick={() => onSelectMode(InputMode.MOUSE)}
      >
        🖱️ 鼠标 / 触摸模式 <span className="text-xs ml-2 opacity-70">(无摄像头)</span>
      </button>

      <button 
        className="btn border border-white/60 bg-white/10 text-white rounded-full px-8 py-4 m-2 text-lg hover:bg-white/30 hover:scale-105 transition-all duration-300 backdrop-blur-sm min-w-[220px]"
        onClick={() => onSelectMode(InputMode.CAMERA)}
      >
        📷 摄像头手势模式 <span className="text-xs ml-2 opacity-70">(需授权)</span>
      </button>
    </div>
  );
};
