const fs = require('fs');
const file = 'src/components/driver/DriverEarnings.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace hardcoded 0.88 with dynamic calculation
content = content.replace(/netFare = \(data\.finalFare - tip\) \* 0\.88 \+ tip;/g, 'netFare = (data.finalFare - tip) * (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0) + tip;');
content = content.replace(/netFare = data\.driverEarnings \|\| \(grossFare \* 0\.88\) \+ tip;/g, 'netFare = data.driverEarnings || (grossFare * (1 - fareConfig.commissionRate) - (fareConfig.fixedTripFee || 0)) + tip;');

// Update gross calculation using exact algebra
content = content.replace(/\(displayEarnings \/ \(1 - fareConfig\.commissionRate\)\)/g, '((displayEarnings + displayJobs * (fareConfig.fixedTripFee || 0)) / (1 - fareConfig.commissionRate))');

fs.writeFileSync(file, content);
console.log('Done!');
