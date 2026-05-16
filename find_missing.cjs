const fs = require('fs');
const execSync = require('child_process').execSync;
const output = execSync('npx -c "grep -rnE \'onSnapshot\\([^,]+, \\([^)]+\\) => \\{\' src/"', {encoding: 'utf-8'});
const lines = output.trim().split('\n');

for (const line of lines) {
  if (!line) continue;
  const match = line.match(/(src\/[^:]+):(\d+):/);
  if (!match) continue;
  const file = match[1];
  const startNum = parseInt(match[2]);
  
  const content = fs.readFileSync(file, 'utf-8').split('\n');
  let openBraces = 0;
  let started = false;
  let endNum = -1;
  let text = '';
  
  for (let i = startNum - 1; i < content.length; i++) {
    const l = content[i];
    openBraces += (l.match(/\{/g) || []).length;
    openBraces -= (l.match(/\}/g) || []).length;
    text += l + '\n';
    started = true;
    if (started && openBraces === 0) {
      endNum = i;
      break;
    }
  }
  
  if (endNum !== -1) {
    if (!text.includes('console.error') && !text.includes('handleFirestoreError')) {
      console.log(file + ':' + startNum + ' is missing error handler');
    } else {
        const lastLine = content[endNum].trim();
        if (lastLine === '});') {
            // It might just end with }); instead of }, (err) => ...
            // let's print it to be safe
            console.log(file + ':' + startNum + ' ends with }); (might be missing error handler)');
        }
    }
  }
}
