import { expect, vi, test, describe, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

declare global {
  // Add Vitest globals to global namespace
  const describe: typeof import('vitest')['describe'];
  const test: typeof import('vitest')['test'];
  const expect: typeof import('vitest')['expect'];
  const vi: typeof import('vitest')['vi'];
  const beforeEach: typeof import('vitest')['beforeEach'];
  
  // Add Jest compatibility
  namespace jest {
    type Mock<T = any, Y extends any[] = any[]> = import('vitest').Mock<T, Y>;
    interface Matchers<R, T> extends import('@testing-library/jest-dom/matchers') {}
  }

  // Extend Vitest's Assertion interface with jest-dom matchers
  namespace Vi {
    interface Assertion {
      toBeInTheDocument(): void;
      toHaveValue(value: string | number | string[]): void;
      toBeDisabled(): void;
      toBeEnabled(): void;
      toBeEmptyDOMElement(): void;
      toBeInvalid(): void;
      toBeRequired(): void;
      toBeValid(): void;
      toBeVisible(): void;
      toContainElement(element: HTMLElement | null): void;
      toContainHTML(htmlText: string): void;
      toHaveAccessibleDescription(description?: string | RegExp): void;
      toHaveAccessibleName(name?: string | RegExp): void;
      toHaveAttribute(attr: string, value?: any): void;
      toHaveClass(...classNames: string[]): void;
      toHaveFocus(): void;
      toHaveFormValues(expectedValues: Record<string, any>): void;
      toHaveStyle(css: string | Record<string, any>): void;
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
      toBeChecked(): void;
      toBePartiallyChecked(): void;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): void;
      toHaveErrorMessage(text?: string | RegExp): void;
    }
  }
}

export {};
