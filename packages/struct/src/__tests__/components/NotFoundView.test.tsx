// Original path: __tests__/components/NotFoundView.test.tsx
// src/__tests__/components/NotFoundView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, expect, describe, beforeEach, test } from 'vitest';
import { MemoryRouter } from 'react-router-dom'; // Only MemoryRouter needed
import NotFoundView from '../../components/NotFoundView';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

// Mock Header and Footer
vi.mock('../../components/Header', () => ({
  default: vi.fn(({ pageTitle, onBackClick, showBackButton }) => (
    <header data-testid="header">
      <div>{pageTitle}</div>
      {showBackButton && <button onClick={onBackClick} data-testid="header-back-button">Back</button>}
    </header>
  )),
}));
vi.mock('../../components/Footer', () => ({
  default: vi.fn(() => <footer data-testid="footer">Footer</footer>),
}));

describe('NotFoundView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (props: Partial<React.ComponentProps<typeof NotFoundView>> = {}) => {
    return render(
      <MemoryRouter>
        <NotFoundView {...props} />
      </MemoryRouter>
    );
  };

  test('renders with default props', () => {
    renderWithRouter();
    expect(screen.getByTestId('header')).toHaveTextContent('Not Found');
    expect(screen.getByRole('heading', { name: /404 - Not Found/i })).toBeInTheDocument();
    expect(screen.getByText(/The page you requested could not be found./i)).toBeInTheDocument();
    expect(screen.queryByText(/\(ID:/i)).not.toBeInTheDocument(); // No ID by default
    expect(screen.getByRole('button', { name: /Go Back to Classes/i })).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  test('renders with custom type and id', () => {
    renderWithRouter({ type: 'Custom Item', id: 'xyz123' });
    expect(screen.getByText(/The custom item you requested could not be found./i)).toBeInTheDocument();
    expect(screen.getByText(/\(ID: xyz123\)/i)).toBeInTheDocument();
  });

  test('calls default navigate on "Go Back to Classes" button click', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByRole('button', { name: /Go Back to Classes/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/classes');
  });

  test('calls custom onBackClick when provided and button is clicked', async () => {
    const user = userEvent.setup();
    const customBackClick = vi.fn();
    renderWithRouter({ onBackClick: customBackClick });
    await user.click(screen.getByRole('button', { name: /Go Back to Classes/i }));
    expect(customBackClick).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled(); // Default navigate should not be called
  });

  test('calls custom onBackClick for header back button when provided', async () => {
    const user = userEvent.setup();
    const customBackClick = vi.fn();
    renderWithRouter({ onBackClick: customBackClick });
    await user.click(screen.getByTestId('header-back-button'));
    expect(customBackClick).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('calls default navigate for header back button if no custom onBackClick', async () => {
    const user = userEvent.setup();
    renderWithRouter();
    await user.click(screen.getByTestId('header-back-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/classes');
  });
});