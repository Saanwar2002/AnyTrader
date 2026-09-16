import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.strip() == "});" and i + 1 < len(lines) and lines[i+1].strip().startswith("describe('"):
        # This is expected to close the previous describe. Let's see if we have extra `});` or `});` before `it`
        pass
        
    if line.strip() == "});" and i + 1 < len(lines) and lines[i+1].strip().startswith("it('"):
        # Extraneous close before it?
        # Let's count open/close braces.
        pass
    out.append(line)
    i += 1
