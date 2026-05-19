const fs = require('fs');
const file = 'src/components/driver/DriverTerminal.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\(1 - fareConfig\.commissionRate\);/g, '(1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0);');
content = content.replace(/const commission =\s*baseJobFare \* fareConfig\.commissionRate;/g, 'const commission = baseJobFare * fareConfig.commissionRate + (fareConfig.fixedTripFee || 0);');
fs.writeFileSync(file, content);
console.log('Done!');
