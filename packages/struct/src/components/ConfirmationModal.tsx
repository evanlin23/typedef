// src/components/ConfirmationModal.tsx
import React, { useEffect, useRef } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonClass?: string;
  isConfirmDisabled?: boolean; // New prop
  isCancelDisabled?: boolean;  // New prop
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonClass = 'bg-red-600 hover:bg-red-700',
  isConfirmDisabled = false, // Default to not disabled
  isCancelDisabled = false,  // Default to not disabled
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && !isConfirmDisabled) { // Only focus if not disabled
      confirmButtonRef.current?.focus();
      
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !isCancelDisabled) { // Only if cancel is not disabled
          onCancel();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onCancel, isConfirmDisabled, isCancelDisabled]);

  if (!isOpen) { return null; }

  const finalConfirmButtonClass = `${confirmButtonClass} ${
    isConfirmDisabled ? 'opacity-50 cursor-not-allowed' : ''
  }`;
  const finalCancelButtonClass = `bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 ${
    isCancelDisabled ? 'opacity-50 cursor-not-allowed' : ''
  }`;


  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-gray-700"
      >
        <h3 id="confirmation-modal-title" className="text-xl font-bold text-gray-100 mb-4">{title}</h3>
        <div className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className={`px-4 py-2 ${finalCancelButtonClass}`}
            aria-label={cancelText}
            disabled={isCancelDisabled} // HTML disabled attribute
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${finalConfirmButtonClass}`}
            aria-label={confirmText}
            disabled={isConfirmDisabled} // HTML disabled attribute
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;