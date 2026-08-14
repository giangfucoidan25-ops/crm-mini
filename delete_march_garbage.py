import json

db = json.load(open('database.json', encoding='utf-8'))

# Identify garbage customers
garbage_ids = set()
for c in db.get('customers', []):
    if str(c.get('phone', '')).startswith('02026') or c.get('full_name') in ['An Can', 'Ancan', 'sót chưa lên eshop', 'Get', 'GET', 'E', 'G', 'Ancan - G']:
        garbage_ids.add(c['id'])

print(f"Found {len(garbage_ids)} garbage customers: {garbage_ids}")

# Delete from customers
original_cust_count = len(db.get('customers', []))
db['customers'] = [c for c in db.get('customers', []) if c['id'] not in garbage_ids]

# Delete from orders
original_order_count = len(db.get('orders', []))
db['orders'] = [o for o in db.get('orders', []) if o['customer_id'] not in garbage_ids]

# Delete from care_logs
original_care_count = len(db.get('care_logs', []))
db['care_logs'] = [l for l in db.get('care_logs', []) if l['customer_id'] not in garbage_ids]

print(f"Deleted {original_cust_count - len(db['customers'])} customers.")
print(f"Deleted {original_order_count - len(db['orders'])} orders.")
print(f"Deleted {original_care_count - len(db['care_logs'])} care logs.")

json.dump(db, open('database.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
print("database.json updated successfully.")
