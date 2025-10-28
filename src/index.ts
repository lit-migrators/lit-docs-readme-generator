/**
 * Main entry point for lit-docs-generator
 */

import { glob } from 'glob';
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { parseLitComponent } from './parser.js';
import { generateReadme } from './markdown-generator.js';
import type { GeneratorOptions, LitComponentDocs } from './types.js';

export * from './types.js';
export { parseLitComponent } from './parser.js';
export { generateReadme } from './markdown-generator.js';

/**
 * Generate README files for Lit components matching the pattern
 */
export async function generateDocs(options: GeneratorOptions): Promise<number> {
  const patterns = Array.isArray(options.pattern) ? options.pattern : [options.pattern];

  let processedCount = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    console.log(`Found ${files.length} file(s) matching pattern: ${pattern}`);

    for (const filePath of files) {
      const fileName = basename(filePath);
      console.log(`\n📄 Processing: ${fileName}`);

      try {
        // Parse the component
        const docs = parseLitComponent(filePath);

        if (!docs) {
          console.log(`  ⚠️  Skipped: Not a valid Lit component`);
          continue;
        }

        console.log(`  ✓ Found component: ${docs.tagName} (${docs.className})`);

        // Generate README content
        const readmeContent = options.template
          ? options.template(docs)
          : generateReadme(docs);

        // Determine output path
        const componentDir = dirname(filePath);
        const readmePath = join(componentDir, 'README.md');

        // Check if file exists
        if (existsSync(readmePath) && !options.overwrite) {
          console.log(`  ⚠️  Skipped: README.md already exists (use --overwrite to replace)`);
          continue;
        }

        // Write README file
        writeFileSync(readmePath, readmeContent, 'utf-8');
        console.log(`  ✓ Generated: ${readmePath}`);

        processedCount++;

        // Log summary
        console.log(`    - Properties: ${docs.properties.length}`);
        console.log(`    - Events: ${docs.events.length}`);
        console.log(`    - Methods: ${docs.methods.length}`);
        console.log(`    - Slots: ${docs.slots.length}`);
        console.log(`    - CSS Props: ${docs.cssProperties.length}`);
        console.log(`    - CSS Parts: ${docs.cssParts.length}`);

      } catch (error) {
        console.error(`  ❌ Error processing file:`, error);
      }
    }
  }

  return processedCount;
}

/**
 * Generate documentation for a single component file
 */
export function generateComponentDocs(filePath: string): LitComponentDocs | null {
  return parseLitComponent(filePath);
}
