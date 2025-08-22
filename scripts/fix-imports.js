import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function fixImports(dir) {
  const items = await readdir(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await fixImports(fullPath);
    } else if (extname(item) === '.js') {
      await fixFileImports(fullPath);
    }
  }
}

async function fixFileImports(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    let modified = false;
    
    // Fix relative imports by adding .js extension
    // This regex matches import statements with relative paths that don't have .js extension
    const importRegex = /(import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*)?\s+from\s+['"])(\.\.?\/[^'"]*?)(['"])/g;
    
    // First pass: collect all imports that need fixing
    const importsToFix = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const [fullMatch, prefix, importPath, suffix] = match;
      if (!importPath.endsWith('.js')) {
        importsToFix.push({ fullMatch, prefix, importPath, suffix, index: match.index });
      }
    }
    
    // Second pass: fix imports from end to start to avoid index shifting
    for (let i = importsToFix.length - 1; i >= 0; i--) {
      const { fullMatch, prefix, importPath, suffix, index } = importsToFix[i];
      
      // Check if this is a directory import (no file extension)
      const distPath = join(__dirname, '..', 'dist');
      const fullImportPath = join(distPath, importPath);
      
      try {
        const stats = await stat(fullImportPath);
        if (stats.isDirectory()) {
          // It's a directory, append /index.js
          const newImport = `${prefix}${importPath}/index.js${suffix}`;
          content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
          modified = true;
        } else {
          // It's a file, append .js
          const newImport = `${prefix}${importPath}.js${suffix}`;
          content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
          modified = true;
        }
      } catch (error) {
        // If we can't determine, assume it's a file and append .js
        const newImport = `${prefix}${importPath}.js${suffix}`;
        content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
        modified = true;
      }
    }
    
    if (modified) {
      await writeFile(filePath, content, 'utf8');
      console.log(`Fixed imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  try {
    const distPath = join(__dirname, '..', 'dist');
    console.log('Fixing import extensions in dist folder...');
    await fixImports(distPath);
    console.log('Import extensions fixed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
