// Original path: __tests__/components/LoadingView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LoadingView from '../../components/LoadingView';

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

vi.mock('../../components/LoadingSpinner', () => ({
  default: vi.fn(({ size }) => (
    <div data-testid="loading-spinner" data-size={size}>
      Loading Spinner
    </div>
  ))
}));

describe('LoadingView Component', () => {
  const mockProps = {
    message: 'Loading data...',
    pageTitle: 'Loading Page',
    onBackClick: vi.fn(),
    showBackButton: true,
    showHeader: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with default props', () => {
    render(<LoadingView />);
    
    // Check if header is rendered with default title
    expect(screen.getByTestId('header')).toBeInTheDocument();
    
    // Check if loading spinner is rendered
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    // Check if default message is rendered
    const messageText = screen.getByText('Loading...', { selector: '.text-gray-400' });
    expect(messageText).toBeInTheDocument();
    
    // Check if footer is rendered
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    
    // Back button should not be rendered by default
    expect(screen.queryByTestId('back-button')).not.toBeInTheDocument();
  });

  test('renders correctly with custom props', () => {
    render(<LoadingView {...mockProps} />);
    
    // Check if header is rendered with custom title
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByText('Loading Page')).toBeInTheDocument();
    
    // Check if loading spinner is rendered
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    // Check if custom message is rendered
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    
    // Check if footer is rendered
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    
    // Back button should be rendered
    expect(screen.getByTestId('back-button')).toBeInTheDocument();
  });

  test('renders correctly without header', () => {
    render(<LoadingView {...mockProps} showHeader={false} />);
    
    // Header and footer should not be rendered
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    
    // Loading spinner and message should still be rendered
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('calls onBackClick when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoadingView {...mockProps} />);
    
    // Click on the back button
    await user.click(screen.getByTestId('back-button'));
    
    // Check if onBackClick was called
    expect(mockProps.onBackClick).toHaveBeenCalledTimes(1);
  });
});