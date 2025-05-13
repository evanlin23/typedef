// src/__tests__/vitest.d.ts
import '@testing-library/jest-dom';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'; // Import base type

declare global {
  // Add Vitest globals to global namespace
  const describe: typeof import('vitest')['describe'];
  const test: typeof import('vitest')['test'];
  const expect: typeof import('vitest')['expect'];
  const vi: typeof import('vitest')['vi'];
  const beforeEach: typeof import('vitest')['beforeEach'];
  const afterEach: typeof import('vitest')['afterEach'];

  // Add Jest compatibility
  namespace jest {
    // Use unknown instead of any for default types
    type Mock<T = unknown, Y extends unknown[] = unknown[]> = import('vitest').Mock<T, Y>;
    // Remove unused generic parameters R and T. Extend the base matchers type.
    // eslint-disable-next-line @typescript-eslint/no-empty-interface -- Extending is the purpose here
    interface Matchers<R = void, T = unknown> extends TestingLibraryMatchers<typeof expect.stringContaining, R> {}
  }

  // Extend Vitest's Assertion interface with jest-dom matchers
  namespace Vi {
    // Use more specific types instead of any where possible
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
      // Use string | undefined for attribute value
      toHaveAttribute(attr: string, value?: string | undefined): void;
      toHaveClass(...classNames: string[]): void;
      toHaveFocus(): void;
      // Use unknown for form values as they can be diverse
      toHaveFormValues(expectedValues: Record<string, unknown>): void;
      // Use string | number for CSS values
      toHaveStyle(css: string | Record<string, string | number>): void;
      toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
      toBeChecked(): void;
      toBePartiallyChecked(): void;
      toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): void;
      toHaveErrorMessage(text?: string | RegExp): void;
    }
  }
}

export {}; // Ensure this is treated as a module