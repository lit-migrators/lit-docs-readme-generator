import type { Plugin } from '@stencil/core/internal';
import { join } from 'path';
import { generateDocs } from '.';

/**
 * Stencil plugin that generates README documentation for Lit components
 * during the build process.
 */
export function litDocsPlugin(): any {
  return {
    name: 'lit-docs-generator',

    async buildEnd() {
      console.log('\n🔷 Generating Lit component documentation...\n');

      try {
        const srcDir = join(process.cwd(), 'src');
        const pattern = join(srcDir, 'components/**/*.lit.ts');

        const count = await generateDocs({
          pattern,
          overwrite: true, // Always overwrite to keep docs up-to-date
        });

        if (count > 0) {
          console.log(`\n✓ Generated ${count} Lit component README file(s)\n`);
        } else {
          console.log('\n⚠️  No Lit components found to document\n');
        }
      } catch (error) {
        console.error('\n❌ Error generating Lit docs:', error);
        // Don't fail the build if docs generation fails
      }
    }
  };
}
