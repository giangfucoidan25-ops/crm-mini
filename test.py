import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for c in data.get('customers', []):
    name = c.get('full_name', '')
    if 'Vân' in name:
        print(f'Customer: {name}, ID: {c.get("id")}')
        for o in data.get('orders', []):
            if o.get('customer_id') == c.get('id'):
                print(f'  Order: ID={o.get("id")}, product_name={o.get("product_name")}, product_id={o.get("product_id")}, items={o.get("items")}')
