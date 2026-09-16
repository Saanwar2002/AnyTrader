const fs = require('fs');
const ts = require('typescript');

const sourceCode = fs.readFileSync('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'utf8');
const sourceFile = ts.createSourceFile(
  'tests/unit/firebaseEmulatorIntelligenceV81.test.ts',
  sourceCode,
  ts.ScriptTarget.Latest,
  true
);

function visit(node, depth) {
  if (ts.isVariableDeclaration(node) && node.name.text === 'testEnv') {
      console.log('testEnv declared at line', sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
  }
  ts.forEachChild(node, child => visit(child, depth + 1));
}

visit(sourceFile, 0);
