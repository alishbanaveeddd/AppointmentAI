/**
 * Type declarations for CSS module imports.
 * Required so TypeScript recognises `import './globals.css'` side-effect imports.
 */
declare module '*.css' {
  const content: Record<string, unknown>;
  export default content;
}
