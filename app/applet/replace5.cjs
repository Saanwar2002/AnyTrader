const fs = require('fs');
let code = fs.readFileSync('src/components/driver/DriverTerminal.tsx', 'utf8');
code = code.replace(/bg-\[#1A1A1E\] border border-\[#2C2C30\] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full/g, 'bg-[#1A1A1E] border border-[#2C2C30] rounded-3xl p-3 shadow-2xl relative overflow-hidden pointer-events-auto flex flex-col w-full max-h-[calc(100vh-8.5rem-env(safe-area-inset-top))]');
code = code.replace(/text-\[11px\] font-bold leading-snug truncate whitespace-normal line-clamp-2/g, 'text-[10px] font-bold truncate whitespace-nowrap');
fs.writeFileSync('src/components/driver/DriverTerminal.tsx', code);
console.log('done replacing');
