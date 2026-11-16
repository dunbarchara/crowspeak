import { type MockEngine, createMockEngine } from './mock';

/**
 * The engine connection the app uses. It is the mock until the typed gateway adapter (task 8)
 * replaces it; both implement `EngineClient`.
 */
export const engineClient: MockEngine = createMockEngine();
