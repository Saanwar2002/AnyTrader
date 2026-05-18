const fs = require('fs');
let text = fs.readFileSync('src/components/driver/DriverTerminal.tsx', 'utf8');
text = text.replace(/if \(\(map\.getZoom\(\) \|\| 0\) > 13\)/g, 'if ((map.getZoom() || 0) > 17)');
text = text.replace(/map\.setZoom\(13\); \/\/ Restrict to 13 as user mentioned/g, 'map.setZoom(17); // Restrict to 17 as user mentioned');
fs.writeFileSync('src/components/driver/DriverTerminal.tsx', text);
