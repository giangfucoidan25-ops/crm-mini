import json

with open('database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Keys in database.json:", data.keys())
orders = data.get('orders', [])
print(f"Total orders: {len(orders)}")

for o in orders:
    if o.get('customer_id') == 27 or 'Lan Anh' in o.get('customer_name', ''):
        print(o)

with open('temp_struct.txt', 'w', encoding='utf-8') as out:
    out.write(f"Keys: {list(data.keys())}\n")
    out.write(f"Total orders: {len(orders)}\n")
    for o in orders:
        if o.get('customer_id') == 27 or 'Lan Anh' in str(o.get('customer_name', '')):
            out.write(f"{o}\n")
