// src/components/ToastSystem.tsx
import React from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastSystemProps {
  toasts: Toast[];
}

const ToastSystem: React.FC<ToastSystemProps> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-auto max-w-xs sm:max-w-sm">
      {toasts.map(toast => (
        <div key={toast.id} className={`p-3 rounded-md shadow-lg text-sm font-medium animate-fadeIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white' // info
        } border ${
          toast.type === 'success' ? 'border-green-700' : 
          toast.type === 'error' ? 'border-red-700' : 
          'border-blue-700'
        }`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastSystem;