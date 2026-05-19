import fs from 'fs';

let content = fs.readFileSync('src/components/JobDetails.tsx', 'utf8');

const startMarker = '{/* Milestones & Escrow Section */}';
const endMarker = '                              </div>\\n                            </div>';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex) + endMarker.length - 1 + 29; // approximate to include the closing spaces

// Actually, let's use exact line numbers if we can. Or regex.
// Wait, I can match everything between `{/* Milestones & Escrow Section */}` and `                            </div>\n                          </div>\n                    )}`.
// Actually, they are inside `quote.status === "accepted" && (`.

const matchStrStart = `                            {/* Milestones & Escrow Section */}`;
const matchStrEnd = `                              </div>\n                            </div>`;

const exactStart = content.indexOf(matchStrStart);
const exactEndToken = `                            </div>\n                          </div>\n                    )}`;
const exactEnd = content.indexOf(exactEndToken, exactStart) - 1; // get the newline

if (exactStart === -1 || exactEnd === -1) {
    console.error("Match failing:", exactStart, exactEnd);
    process.exit(1);
}

const escrowBlock = content.substring(exactStart, exactEnd);

// Remove the escrowBlock from its current position
content = content.replace(escrowBlock, `\n`);

// Now insert it AFTER the two-column row.
// It ends with:
//                         {quote.status.replace('_', ' ')}
//                       </span>
//                     )}
//                   </div>
//                 </div>
const targetPoint = `                </div>\n\n                {(((isHomeowner`;
if (!content.includes(targetPoint)) {
    console.log("target point not found");
    const targetPoint2 = `                </div>\n\n                {isHomeowner && (quote.status`;
    if (!content.includes(targetPoint2)) {
         console.log("second target point not found too");
         process.exit(1);
    }
}

// We also need to conditionally render it only if status is accepted
const fullEscrowBlock = `                {quote.status === "accepted" && (\n                  <div className="w-full">\n${escrowBlock.replace(/^                            /gm, '                  ')}\n                  </div>\n                )}\n\n`;

content = content.replace(`                </div>\n\n                {(((isHomeowner`, `                </div>\n\n` + fullEscrowBlock + `                {(((isHomeowner`);
fs.writeFileSync('src/components/JobDetails.tsx', content);
console.log("done");
