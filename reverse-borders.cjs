const fs = require('fs');
const path = require('path');

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

const SKIP_FILES = [
  'Availability.tsx',
  'Appointments.tsx',
  'ConsultancyCalendar.tsx',
  'AppointmentsDialog.tsx',
  'Calendar.tsx' // If any
];

walk('./src', (err, files) => {
  if (err) throw err;
  let changedFiles = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    const fileName = path.basename(file);
    if (SKIP_FILES.includes(fileName)) return;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace border-black with border-slate-100 unless preceded by hover:, focus:, active:, group-hover:, peer-focus:
    content = content.replace(/(?<!(hover|focus|active|group-hover|peer-focus|ui-selected|focus-within):)border-black(?!\/)/g, 'border-slate-100');
    // For any that actually WERE border-white (e.g. driver terminal), it might replace them with slate-100. Let's assume slate-100 is the main one meant.
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      changedFiles++;
    }
  });
  
  console.log(`Reverted borders in ${changedFiles} files.`);
});
