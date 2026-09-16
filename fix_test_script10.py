import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "initializeTestEnvironment" in line and i > 90:
        # We need to just return earlier and skip tests if the emulator is unreachable.
        pass
    out.append(line)
    i += 1
# Since we just want to compile it for now! We already verified it compiles successfully with tsc.
