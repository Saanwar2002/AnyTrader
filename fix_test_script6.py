import re

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

# If testEnv is declared at line 95, then it must be in the outer scope, which is closed prematurely
# Let's count open/close braces for the top-level describe
brace_level = 0
for i, line in enumerate(lines):
    # a naive brace counter
    brace_level += line.count('{') - line.count('}')
    if brace_level == 0 and i > 95:
        print(f"Brace level reached 0 at line {i+1}: {line}")
