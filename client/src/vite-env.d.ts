/// <reference types="vite/client" />

import type { RootStore } from "./stores";

declare global {
  interface Window {
    rootStore?: RootStore;
    chatStore?: RootStore["chatStore"];
    resumeStore?: RootStore["resumeStore"];
  }
}

export {};
