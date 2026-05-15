import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
         results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src/components');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/border-white/g);
  if (matches) {
     console.log(`${file}: ${matches.length}`);
  }
});
