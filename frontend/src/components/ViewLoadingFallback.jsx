import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ViewLoadingFallback({ message = 'Carregando visualização...' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="h-full min-h-[300px] flex flex-col items-center justify-center text-[#26251e] space-y-3 animate-fadeIn"
    >
      <div className="p-3 bg-[#fafaf7] border border-[#e6e5e0] rounded-xl shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-[#f54e00]" aria-hidden="true" />
      </div>
      <span className="text-xs text-[#5a5852] font-mono tracking-tight">{message}</span>
    </div>
  );
}
