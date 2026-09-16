const fs = require('fs');
const ts = require('typescript');

const sourceCode = fs.readFileSync('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'utf8');
const sourceFile = ts.createSourceFile(
  'tests/unit/firebaseEmulatorIntelligenceV81.test.ts',
  sourceCode,
  ts.ScriptTarget.Latest,
  true
);

function countBraces(node) {
  let count = 0;
  if (ts.isBlock(node)) count++;
  // We can just rely on tsc or esbuild output. 
  // It says "Unexpected end of file". We need more closing braces.
}
