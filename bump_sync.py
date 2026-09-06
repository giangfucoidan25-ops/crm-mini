import re
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()
content = re.sub(r'supabase-sync\.js\?v=[0-9\.]+', 'supabase-sync.js?v=3.4', content)
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Bumped version')
