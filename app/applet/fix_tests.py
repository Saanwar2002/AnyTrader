with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'authenticatedContext' in line and 'admin' in line:
        print(f"Line {i+1}: {line.strip()}")
