import '@testing-library/jest-dom';

declare global {
  namespace Vi {
    interface Assertion extends jest.Matchers<any, any> {}
    interface AsymmetricMatchersContaining extends jest.Matchers<any, any> {}
  }
}
