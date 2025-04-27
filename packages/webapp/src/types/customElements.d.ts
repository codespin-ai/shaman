// File path: ./packages/webapp/src/types/custom-elements.d.ts

declare global {
  namespace JSX {
    interface IntrinsicElements {      
      "hello-world": {};
    }
  }
}

// Extend HTMLElement to include the render method used by Magic Loop
declare global {
  interface HTMLElement {
    render(): void;
  }
}

export {};
