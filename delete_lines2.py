import sys
lines_to_delete = [1448, 1453, 1559, 2119, 2124, 2535, 2540, 2693, 2756, 2800, 2853, 2923, 2977, 3029, 3117, 3189, 3302, 3439, 3821, 3826, 4360, 4365, 5570, 5575, 5592, 5604, 5614, 5684, 5726, 5764, 5804, 5843, 5893, 5984, 6046, 6071, 6072, 6073]

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = [l.strip('\n') for l in f.readlines()]

out = []
for i, line in enumerate(lines):
    if i + 1 not in lines_to_delete:
        out.append(line)

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write('\n'.join(out))
