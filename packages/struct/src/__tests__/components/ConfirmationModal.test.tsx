// Original path: __tests__/components/ConfirmationModal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ConfirmationModal from '../../components/ConfirmationModal';

describe('ConfirmationModal Component', () => {
  const mockProps = {
    isOpen: true,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
    onCancel: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly when open', () => {
    render(<ConfirmationModal {...mockProps} />);
    
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<ConfirmationModal {...mockProps} isOpen={false} />);
    
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  test('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationModal {...mockProps} />);
    
    await user.click(screen.getByText('Confirm'));
    
    expect(mockProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationModal {...mockProps} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when Escape key is pressed', () => {
    render(<ConfirmationModal {...mockProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test('does not call onCancel when Escape key is pressed if modal is closed', () => {
    render(<ConfirmationModal {...mockProps} isOpen={false} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onCancel).not.toHaveBeenCalled();
  });

  test('uses custom button text when provided', () => {
    render(
      <ConfirmationModal 
        {...mockProps} 
        confirmText="Yes, Delete" 
        cancelText="No, Keep It" 
      />
    );
    
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep It')).toBeInTheDocument();
  });

  test('applies custom confirm button class', () => {
    render(
      <ConfirmationModal 
        {...mockProps} 
        confirmButtonClass="bg-blue-500 hover:bg-blue-600" 
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-blue-500', 'hover:bg-blue-600');
  });

  test('disables confirm button when isConfirmDisabled is true', () => {
    render(
      <ConfirmationModal 
        {...mockProps} 
        isConfirmDisabled={true}
        confirmText="Processing..." 
      />
    );
    
    const confirmButton = screen.getByText('Processing...');
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  test('disables cancel button when isCancelDisabled is true', () => {
    render(
      <ConfirmationModal 
        {...mockProps} 
        isCancelDisabled={true} 
      />
    );
    
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
    expect(cancelButton).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  test('does not call onCancel when Escape key is pressed if cancel is disabled', () => {
    render(
      <ConfirmationModal 
        {...mockProps} 
        isCancelDisabled={true} 
      />
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(mockProps.onCancel).not.toHaveBeenCalled();
  });

  test('focuses confirm button when modal opens', () => {
    render(<ConfirmationModal {...mockProps} />);
    
    const confirmButton = screen.getByText('Confirm');
    expect(document.activeElement).toBe(confirmButton);
  });

  test('does not focus confirm button when disabled', () => {
    // Save original focus
    const originalActiveElement = document.activeElement;
    
    render(
      <ConfirmationModal 
        {...mockProps} 
        isConfirmDisabled={true} 
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(document.activeElement).not.toBe(confirmButton);
    expect(document.activeElement).toBe(originalActiveElement);
  });

  test('renders ReactNode message correctly', () => {
    const messageNode = (
      <div data-testid="message-node">
        <p>First paragraph</p>
        <p>Second paragraph</p>
      </div>
    );
    
    render(
      <ConfirmationModal 
        {...mockProps} 
        message={messageNode} 
      />
    );
    
    expect(screen.getByTestId('message-node')).toBeInTheDocument();
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
  });
});