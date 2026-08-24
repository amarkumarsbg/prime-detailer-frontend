// Tailwind v4 / Next.js: declare CSS modules to satisfy TypeScript
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
