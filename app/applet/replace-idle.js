import fs from 'fs';
let code = fs.readFileSync('src/components/driver/DriverTerminal.tsx', 'utf8');

code = code.replace(
  /<div className="fixed bottom-\[calc\(76px\+env\(safe-area-inset-bottom\)\)\] left-0 right-0 px-4 z-50 pointer-events-none flex flex-col items-center">/g,
  '<div className="fixed left-0 right-0 px-4 z-50 pointer-events-none flex flex-col items-center" style={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}>'
);

fs.writeFileSync('src/components/driver/DriverTerminal.tsx', code);
console.log('done replacing idle bottom nav indicator');
