const fs = require('fs');
const file = 'src/components/driver/DriverEarnings.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/netFare = \(data\.finalFare - tip\) \* 0\.88 \+ tip;/g, 'netFare = (data.finalFare - tip) * (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0) + tip;');
content = content.replace(/netFare = data\.driverEarnings \|\| \(grossFare \* 0\.88\) \+ tip;/g, 'netFare = data.driverEarnings || (grossFare * (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0)) + tip;');
content = content.replace(/\(displayEarnings \/ \(1 - fareConfig\.commissionRate\)\)/g, '((displayEarnings + tip + (fareConfig.fixedTripFee || 0) * (displayEarnings ? 0 : 0)) / (1 - fareConfig.commissionRate)) /* simplified gross */');
fs.writeFileSync(file, content);
console.log('Done!');
