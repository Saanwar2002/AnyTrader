with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    lines = f.readlines()

stack = []
for idx, line in enumerate(lines):
    in_string = False
    in_comment = False
    string_char = ''
    i = 0
    while i < len(line):
        char = line[i]
        if in_comment:
            if char == '*' and i + 1 < len(line) and line[i+1] == '/':
                in_comment = False
                i += 2
                continue
        elif char == '/' and i + 1 < len(line) and line[i+1] == '/':
            break # rest of line is comment
        elif char == '/' and i + 1 < len(line) and line[i+1] == '*':
            in_comment = True
            i += 2
            continue
        elif in_string:
            if char == '\\':
                i += 2
                continue
            if char == string_char:
                in_string = False
        elif char in ['"', "'", '`']:
            in_string = True
            string_char = char
        elif char == '{':
            stack.append((idx + 1, line.strip()))
        elif char == '}':
            if stack:
                stack.pop()
        i += 1

print('Unclosed braces count:', len(stack))
for line_num, content in stack[-10:]:
    print(f"Line {line_num}: {content}")
