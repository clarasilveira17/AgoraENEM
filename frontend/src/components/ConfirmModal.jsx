import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirmar Ação',
  message = 'Tem certeza que deseja prosseguir com esta ação?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDestructive = true,
  isLoading = false
}) {
  const cancelBtnRef = useRef(null);

  // Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isLoading && onCancel) onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Give focus to cancel button by default to prevent accidental deletion on enter
    const timer = setTimeout(() => {
      if (cancelBtnRef.current) {
        cancelBtnRef.current.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#26251e]/40 backdrop-blur-xs animate-fadeIn"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading && onCancel) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md bg-[#ffffff] border border-[#e6e5e0] rounded-xl shadow-xl p-6 text-[#26251e] space-y-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-lg shrink-0 ${isDestructive ? 'bg-[#cf2d56]/10 text-[#cf2d56]' : 'bg-[#f54e00]/10 text-[#f54e00]'}`}>
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 id="confirm-dialog-title" className="text-sm font-semibold text-[#26251e]">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="text-xs text-[#5a5852] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e6e5e0]">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-mono font-medium rounded-md border border-[#e6e5e0] text-[#5a5852] hover:text-[#26251e] hover:bg-[#fafaf7] transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-mono font-semibold rounded-md text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 ${
              isDestructive
                ? 'bg-[#cf2d56] hover:bg-[#b52449]'
                : 'bg-[#f54e00] hover:bg-[#d04200]'
            }`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
