var fs = require('fs');
var path = require('path');

const walk = (dir, done) => {
  let results = [];
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(file => {
      file = path.resolve(dir, file);
      fs.stat(file, (err, stat) => {
        if (stat && stat.isDirectory()) {
          walk(file, (err, res) => {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

walk('./src', (err, files) => {
  if (err) throw err;
  let changedFiles = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace border-slate-100 with border-black
    // Replace border-slate-200 with border-black
    content = content.replace(/border-slate-100/g, 'border-black');
    content = content.replace(/border-slate-200/g, 'border-black');
    
    // We can also ensure border-white is restored if it was accidentally changed (optional)
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      changedFiles++;
      console.log('Restored in ' + file);
    }
  });
  
  console.log(`Replaced borders in ${changedFiles} files.`);
});
