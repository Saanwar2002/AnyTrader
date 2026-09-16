import re
with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    content = f.read()

idx = content.find("Task 11 Invariant 1: Admin can persist canonical")
match = re.search(r'\n\s*it\([\'"`].*?[\'"`],\s*async\s*\(\)\s*=>\s*\{', content[:idx+200])
# Actually just search around idx
match = re.search(r'\n\s*it\([\'"`].*?[\'"`],\s*async\s*\(\)\s*=>\s*\{', content[idx-100:idx+200])
print(match)

if match:
    body_start = idx - 100 + match.end()
    depth = 1
    curr = body_start
    in_string = False
    string_char = None
    in_escape = False
    while curr < len(content) and depth > 0:
        c = content[curr]
        if in_escape:
            in_escape = False
        elif c == '\\':
            in_escape = True
        elif in_string:
            if c == string_char:
                in_string = False
        elif c in "'\"`":
            in_string = True
            string_char = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        curr += 1
    print("Body length:", curr - body_start)
    body_content = content[body_start:curr-1]
    print("Contains auth:", 'testEnv!.authenticatedContext' in body_content)
    print("Contains admin:", '{ admin: true }' in body_content)
    print("Contains assertFails:", 'assertFails' in body_content)
    print("Ends with:", body_content[-50:])
