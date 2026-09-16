with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    
    # We want to check if this line is the last line before a new `it`, `describe`, or `describe` close `  });`
    # and if the current `it` block is open.
    # Actually, let's just count open `it` blocks based on indentation.
    pass
