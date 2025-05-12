import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ErrorView from '../../components/ErrorView';

// Mock the child components
vi.mock('../../components/Header', () => ({
  default: vi.fn(({ pageTitle, onBackClick, showBackButton }) => (
    <header data-testid="header">
      <h1>{pageTitle}</h1>
      {showBackButton && (
        <button onClick={onBackClick} data-testid="back-button">
          Back
        </button>
      )}
    </header>
  ))
}));

vi.mock('../../components/Footer', () => ({
  default: vi.fn(() => <footer data-testid="footer">Footer</footer>)
}));

describe('ErrorView Component', () => {
  const mockProps = {
    title: 'Error Title',
    message: 'Error Message',
    onBackClick: vi.fn(),
    showHeader: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with header', () => {
    render(<ErrorView {...mockProps} />);
    
    // Check if header is rendered
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    
    // Check if error title and message are rendered
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error Message')).toBeInTheDocument();
    
    // Check if back button is rendered
    expect(screen.getByText('Go Back')).toBeInTheDocument();
    
    // Check if footer is rendered
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  test('renders correctly without header', () => {
    render(<ErrorView {...mockProps} showHeader={false} />);
    
    // Header and footer should not be rendered
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    
    // Error title, message, and back button should still be rendered
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error Message')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  test('calls onBackClick when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<ErrorView {...mockProps} />);
    
    // Click on the back button
    await user.click(screen.getByText('Go Back'));
    
    // Check if onBackClick was called
    expect(mockProps.onBackClick).toHaveBeenCalledTimes(1);
  });

  test('calls onBackClick when header back button is clicked', async () => {
    const user = userEvent.setup();
    render(<ErrorView {...mockProps} />);
    
    // Click on the header back button
    await user.click(screen.getByTestId('back-button'));
    
    // Check if onBackClick was called
    expect(mockProps.onBackClick).toHaveBeenCalledTimes(1);
  });
});
