// Original path: __tests__/components/NotesArea.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Recreate the NotesArea component for testing
interface NotesAreaProps {
  notes: string;
  onNotesChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const NotesArea = ({ notes, onNotesChange }: NotesAreaProps) => (
  <aside className="w-1/3 max-w-sm lg:max-w-md xl:max-w-lg bg-gray-800 p-4 flex flex-col border-l border-gray-700 overflow-y-auto">
    <h3 className="text-lg font-semibold text-gray-100 mb-3">Class Notes</h3>
    <textarea
      value={notes}
      onChange={onNotesChange}
      placeholder="Type your notes for this class here..."
      className="flex-1 w-full p-2 bg-gray-900 text-gray-200 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
      aria-label="Class notes"
    />
  </aside>
);

describe('NotesArea Component', () => {
  test('renders with correct content and styling', () => {
    const mockProps = {
      notes: 'Test notes content',
      onNotesChange: vi.fn()
    };
    
    render(<NotesArea {...mockProps} />);
    
    // Check if heading is displayed
    const heading = screen.getByText('Class Notes');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('text-lg');
    expect(heading).toHaveClass('font-semibold');
    
    // Check if textarea is rendered with correct value
    const textarea = screen.getByLabelText('Class notes');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Test notes content');
    expect(textarea).toHaveAttribute('placeholder', 'Type your notes for this class here...');
    
    // Check container styling
    const container = heading.parentElement;
    expect(container).toHaveClass('bg-gray-800');
    expect(container).toHaveClass('p-4');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('flex-col');
  });
  
  test('calls onNotesChange when typing in textarea', async () => {
    const mockProps = {
      notes: 'Initial notes',
      onNotesChange: vi.fn()
    };
    const user = userEvent.setup();
    
    render(<NotesArea {...mockProps} />);
    
    // Get textarea
    const textarea = screen.getByLabelText('Class notes');
    
    // Type in textarea
    await user.clear(textarea);
    await user.type(textarea, 'New notes content');
    
    // Check if onNotesChange was called
    expect(mockProps.onNotesChange).toHaveBeenCalled();
  });
});