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
const now = Date.now();
files.forEach(file => {
  const stat = fs.statSync(file);
  const diffMinutes = (now - stat.mtimeMs) / (1000 * 60);
  if (diffMinutes < 30) {
     console.log(`${file}: modified ${diffMinutes.toFixed(1)} minutes ago`);
  }
});
