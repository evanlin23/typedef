// Original path: __tests__/components/FileUpload.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import FileUpload from '../../components/FileUpload';

// Add the necessary matchers for testing-library
 
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void;
      toHaveClass(className: string): void;
    }
  }
}

const mockOnUpload = vi.fn();

describe('FileUpload Component', () => {
  beforeEach(() => {
    mockOnUpload.mockClear();
  });

  test('renders correctly', () => {
    render(<FileUpload onUpload={mockOnUpload} />);
    
    expect(screen.getByRole('button', { name: /file upload area/i })).toBeInTheDocument();
    expect(screen.getByText('Upload PDFs')).toBeInTheDocument();
    expect(screen.getByText('Drag & drop PDF files here, or click to select.')).toBeInTheDocument();
  });

  test('handles file input change', async () => {
    render(<FileUpload onUpload={mockOnUpload} />);
    
    const file = new File(['dummy content'], 'example.pdf', { type: 'application/pdf' });
    // Create a mock FileList
    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => index === 0 ? file : null,
      [Symbol.iterator]: function* () { yield file; }
    } as unknown as FileList;
    
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    
    // Simulate file selection
    fireEvent.change(input, { target: { files: fileList } });
    
    expect(mockOnUpload).toHaveBeenCalledTimes(1);
    expect(mockOnUpload).toHaveBeenCalledWith(fileList);
  });

  test('handles button click to open file dialog', async () => {
    render(<FileUpload onUpload={mockOnUpload} />);
    
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    // Click the upload area directly with fireEvent to avoid multiple events
    fireEvent.click(screen.getByRole('button', { name: /file upload area/i }));
    
    // The spy might be called multiple times depending on the implementation
    // Just verify it was called at least once
    expect(clickSpy).toHaveBeenCalled();
  });

  test('handles keyboard interaction', async () => {
    render(<FileUpload onUpload={mockOnUpload} />);
    
    const uploadArea = screen.getByRole('button', { name: /file upload area/i });
    const fileInput = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    
    // Focus and press Enter with fireEvent
    uploadArea.focus();
    fireEvent.keyDown(uploadArea, { key: 'Enter' });
    
    // Just verify it was called at least once
    expect(clickSpy).toHaveBeenCalled();
    
    // Reset the mock
    clickSpy.mockClear();
    
    // Test with space key
    fireEvent.keyDown(uploadArea, { key: ' ' });
    
    // Just verify it was called at least once
    expect(clickSpy).toHaveBeenCalled();
  });

  test('handles drag and drop', () => {
    render(<FileUpload onUpload={mockOnUpload} />);
    
    const uploadArea = screen.getByRole('button', { name: /file upload area/i });
    
    // Create mock file and dataTransfer
    const file = new File(['dummy content'], 'example.pdf', { type: 'application/pdf' });
    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => index === 0 ? file : null,
      [Symbol.iterator]: function* () { yield file; }
    } as unknown as FileList;
    
    const dataTransfer = {
      files: fileList,
      items: [{ kind: 'file', type: 'application/pdf', getAsFile: () => file }],
      types: ['Files']
    };
    
    // Test drag enter
    fireEvent.dragEnter(uploadArea, { dataTransfer });
    expect(uploadArea).toHaveClass('border-green-400');
    
    // Test drag over
    fireEvent.dragOver(uploadArea, { dataTransfer });
    expect(uploadArea).toHaveClass('border-green-400');
    
    // Test drag leave
    fireEvent.dragLeave(uploadArea, { 
      dataTransfer,
      relatedTarget: document.body // Element outside the component
    });
    expect(uploadArea).not.toHaveClass('border-green-400');
    
    // Test drag enter again
    fireEvent.dragEnter(uploadArea, { dataTransfer });
    expect(uploadArea).toHaveClass('border-green-400');
    
    // Test drop
    fireEvent.drop(uploadArea, { dataTransfer });
    expect(uploadArea).not.toHaveClass('border-green-400');
    expect(mockOnUpload).toHaveBeenCalledTimes(1);
    expect(mockOnUpload).toHaveBeenCalledWith(fileList);
  });
});