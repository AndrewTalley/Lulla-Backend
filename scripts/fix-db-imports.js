import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function fixDbImports(dir) {
  const items = await readdir(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await fixDbImports(fullPath);
    } else if (extname(item) === '.js') {
      await fixFileDbImports(fullPath);
    }
  }
}

async function fixFileDbImports(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    let modified = false;
    
    // Fix ../db imports to ../db/index.js (both with and without .js extension)
    if (content.includes('from "../db"')) {
      content = content.replace(/from "\.\.\/db"/g, 'from "../db/index"');
      modified = true;
    }
    
    if (content.includes("from '../db'")) {
      content = content.replace(/from '\.\.\/db'/g, "from '../db/index'");
      modified = true;
    }
    
    if (content.includes('from "../db.js"')) {
      content = content.replace(/from "\.\.\/db\.js"/g, 'from "../db/index.js"');
      modified = true;
    }
    
    if (content.includes("from '../db.js'")) {
      content = content.replace(/from '\.\.\/db\.js'/g, "from '../db/index.js'");
      modified = true;
    }
    
    if (modified) {
      await writeFile(filePath, content, 'utf8');
      console.log(`Fixed db imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  try {
    const distPath = join(__dirname, '..', 'dist');
    console.log('Fixing db import paths in dist folder...');
    await fixDbImports(distPath);
    console.log('Db import paths fixed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
