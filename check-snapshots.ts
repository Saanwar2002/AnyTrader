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
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
         results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('onSnapshot(')) {
     const lines = content.split('\n');
     for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('onSnapshot(')) {
             // Let's capture the next few lines
             const snippet = lines.slice(i, i+15).join('\n');
             if (!snippet.includes('handleFirestoreError') && !snippet.includes('console.error')) {
                 console.log(`\n\n=== ${file}:${i+1} ===\n${snippet}`);
             }
        }
     }
  }
});
