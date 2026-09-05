import json
from datetime import datetime

with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

# Find promotions config
promotions = None
if isinstance(db.get('settings'), list):
    for s in db['settings']:
        if s['key'] == 'promotions_config':
            promotions = s['value']
            break
elif isinstance(db.get('settings'), dict):
    promotions = db['settings'].get('promotions_config')

print("Promotions Config:")
print(json.dumps(promotions, indent=2, ensure_ascii=False))

# Look for July orders
print("\n--- July Orders ---")
july_orders = []
for order in db.get('orders', []):
    order_date = order.get('order_date', '')
    # Check if order_date is in July 2024 or whatever year it is
    if order_date.startswith('2024-07') or '/07/' in order_date:
        july_orders.append(order)

print(f"Total July orders found: {len(july_orders)}")
for o in july_orders[:5]:
    print(json.dumps(o, indent=2, ensure_ascii=False))
