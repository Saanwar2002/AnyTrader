with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    content = f.read()

stack = []
lines = content.split('\n')
for line_no, line in enumerate(lines, 1):
    for char_idx, char in enumerate(line):
        if char == '{':
            stack.append((line_no, char_idx))
        elif char == '}':
            if not stack:
                print(f"Extra closing brace at line {line_no}, col {char_idx}")
            else:
                stack.pop()

print(f"Remaining open braces: {len(stack)}")
for item in stack[-5:]:
    print(f"Unclosed opening brace at line {item[0]}, col {item[1]}")
