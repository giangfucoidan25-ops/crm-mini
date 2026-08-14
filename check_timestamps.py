import json
with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
    
print(f"root exported_at: {db.get('exported_at')}")
for s in db.get('settings', []):
    if s.get('key') == 'last_sync_timestamp':
        print(f"settings last_sync_timestamp: {s.get('value')}")
