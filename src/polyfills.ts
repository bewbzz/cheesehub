import { Buffer } from "buffer";

// Polyfills for Node.js globals needed by WAX libraries
(window as any).global = window;
(window as any).Buffer = Buffer;
(window as any).process = { env: {} };
