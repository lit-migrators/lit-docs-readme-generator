#!/usr/bin/env node

/**
 * CLI for lit-docs-generator
 */

import { generateDocs } from './index.js';

const args = process.argv.slice(2);

// Parse command line arguments
let pattern: string | string[] = '**/*.lit.ts';
let overwrite = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--overwrite' || arg === '-o') {
    overwrite = true;
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else if (arg === '--version' || arg === '-v') {
    printVersion();
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    pattern = arg;
  }
}

function printHelp() {
  console.log(`
lit-docs-generator - Generate Stencil.js-compatible README docs for Lit components

Usage:
  lit-docs [pattern] [options]

Arguments:
  pattern           Glob pattern for files to process (default: **/*.lit.ts)

Options:
  -o, --overwrite   Overwrite existing README.md files
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  lit-docs "**/*.lit.ts"
  lit-docs "src/components/**/*.ts" --overwrite
  lit-docs "src/my-component.lit.ts"

The generator will:
  1. Find all files matching the pattern
  2. Parse Lit components (classes extending LitElement)
  3. Extract metadata from decorators and JSDoc
  4. Generate README.md in the same directory as each component

Supported JSDoc tags (Stencil.js compatible):
  @slot [name] - description
  @cssprop --property-name - description [default: value]
  @part name - description
  @example usage example code
  @dependency component-tag-name
  @deprecated [message]
  @required (for properties)
  @param, @returns (for methods)
`);
}

function printVersion() {
  // Read version from package.json
  console.log('lit-docs-generator v0.0.1');
}

async function main() {
  console.log('🔍 Lit Documentation Generator\n');

  try {
    const count = await generateDocs({
      pattern,
      overwrite,
    });

    console.log(`\n✨ Done! Generated documentation for ${count} component(s).\n`);

    if (count === 0) {
      console.log('💡 Tip: Make sure your components:');
      console.log('   - Extend LitElement');
      console.log('   - Have @customElement decorator');
      console.log('   - Match the file pattern\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
