import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line == "    });" and i + 1 < len(lines) and lines[i+1].strip().startswith("it('"):
        # We inserted a `    });` incorrectly before an `it(` which breaks the scoping for `testEnv` and closes `describe` too early?
        # Actually `testEnv` is declared at the top of the outermost `describe`.
        pass
    
    if "adminCtx1" in line:
        line = line.replace("adminCtx1", "adminCtx")
    
    if "testEnv" in line and "is not defined" in line:
        # this shouldn't happen, we're fixing the code
        pass

    out.append(line)
    i += 1

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
