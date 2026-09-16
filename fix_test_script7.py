import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
brace_level = 0
for i, line in enumerate(lines):
    stripped = line.strip()
    
    # We see brace level hits 0 frequently. 
    # That means we have extraneous `});` or `    });` scattered.
    if stripped == "});" and brace_level == 0:
        continue
    
    brace_level += line.count('{') - line.count('}')
    out.append(line)

# Also let's just grep for extraneous `});` that was added recently? No, let's look at the pattern.
# We had `});` before many `it(` or `describe(`
