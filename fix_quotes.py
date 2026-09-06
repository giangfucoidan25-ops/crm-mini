import os
import re

folder = 'modules'
for filename in os.listdir(folder):
    if not filename.endswith('.js'): continue
    filepath = os.path.join(folder, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = re.sub(r'\((\$\{[a-zA-Z0-9_]+\.id\})\)', r'(\'\1\')', content)
    new_content = re.sub(r'\((\$\{[a-zA-Z0-9_]+\.id\}),\s*', r'(\'\1\', ', new_content)
    new_content = re.sub(r',\s*(\$\{[a-zA-Z0-9_]+\.id\})\)', r', \'\1\')', new_content)
    new_content = re.sub(r',\s*(\$\{[a-zA-Z0-9_]+\.id\}),\s*', r', \'\1\', ', new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed {filename}')
