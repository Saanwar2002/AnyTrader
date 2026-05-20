const fs = require('fs');
const path = require('path');
function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory() && !file.includes('node_modules')) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.tsx') || file.endsWith('.ts')) {
             results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}
walk('src', (err, results) => {
  if (err) throw err;
  results.forEach(file => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('.toFixed')) {
         const simplified = line.replace(/^\s+/, '').replace(/\s+$/, '');
         const isSafe = /^.*\?\.[a-zA-Z0-9_]*\.toFixed|.*\)\.toFixed/.test(simplified);
         if (!isSafe && !line.includes('?.toFixed') && !line.includes('|| 0).toFixed') && !line.includes("parseFloat") && !line.includes('?.price ||')) {
            console.log(file + ':' + (i+1) + ' ' + simplified);
         }
      }
    });
  });
});
