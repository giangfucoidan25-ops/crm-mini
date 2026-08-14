import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
for p in db.get('products', []):
    print(f'- {p.get("product_name")}: cycle={p.get("usage_cycle_days")}')
for c in db.get('customers', []):
    if c.get('full_name') == 'Mai Hoang':
        print(f'Found customer: {c.get("full_name")}')
        print(f'  last_product_used: {c.get("last_product_used")}')
        print(f'  custom_cycle_days: {c.get("custom_cycle_days")}')
