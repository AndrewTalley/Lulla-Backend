import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname, dirname } from 'path';
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
      
      // Get the directory of the current file to resolve relative paths correctly
      const currentFileDir = dirname(filePath);
      const distPath = join(__dirname, '..', 'dist');
      const relativePath = filePath.replace(distPath, '').replace(/\\/g, '/');
      const relativeDir = dirname(relativePath);
      
      // Construct the full path to check if it's a directory or file
      let fullImportPath;
      if (importPath.startsWith('./')) {
        fullImportPath = join(currentFileDir, importPath);
      } else if (importPath.startsWith('../')) {
        fullImportPath = join(currentFileDir, importPath);
      } else {
        fullImportPath = join(currentFileDir, importPath);
      }
      
      try {
        const stats = await stat(fullImportPath);
        if (stats.isDirectory()) {
          // It's a directory, append /index.js
          const newImport = `${prefix}${importPath}/index.js${suffix}`;
          content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
          modified = true;
          console.log(`Fixed directory import: ${importPath} -> ${importPath}/index.js in ${filePath}`);
        } else {
          // It's a file, append .js
          const newImport = `${prefix}${importPath}.js${suffix}`;
          content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
          modified = true;
          console.log(`Fixed file import: ${importPath} -> ${importPath}.js in ${filePath}`);
        }
      } catch (error) {
        // If we can't determine, assume it's a file and append .js
        const newImport = `${prefix}${importPath}.js${suffix}`;
        content = content.substring(0, index) + newImport + content.substring(index + fullMatch.length);
        modified = true;
        console.log(`Assumed file import: ${importPath} -> ${importPath}.js in ${filePath}`);
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
