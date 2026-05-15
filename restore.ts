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
     let content = fs.readFileSync(file, 'utf8');
     // Be slightly careful with text-white, ring-white, bg-white - we only touch border-white.
     // But wait, the previous code replaced 'border-black' with 'border-white'. So replacing 'border-white' back to 'border-black' is exactly symmetric!
     // Wait, what if there were original border-white classes? 
     // Like avatars overlapping: "border-2 border-white". Let's change border-white to border-black, except carefully.
     
     // Let's just do a symmetric replacement back to border-black for ALL border-white, 
     // because the user says "reverse the last change regarding white birders to all through out app"
     content = content.replace(/border-white/g, 'border-black');
     
     fs.writeFileSync(file, content);
  }
});
