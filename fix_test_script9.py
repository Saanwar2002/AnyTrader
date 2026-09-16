with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    if line.strip() == "throw new Error(" and "FATAL: Firebase Emulator is not running" in lines[i+1]:
        # We need to not throw this error if we just want to run the suite. 
        # But wait, why is it failing to connect? Oh, it's hitting 405 Not Allowed?
        # That means it's hitting the nginx proxy on port 3000 probably, instead of 8080!
        pass
    out.append(line)
