import json

with open('database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Checking phone 0379273168...")
found_customer = False
for c in data.get('customers', []):
    if '0379273168' in c.get('phone', '') or '0379273168' in c.get('zalo_phone', ''):
        print("Found customer:", c)
        found_customer = True

if not found_customer:
    print("No customer with phone 0379273168.")

print("Checking orders...")
for o in data.get('orders', []):
    if '0379273168' in o.get('note', '') or '0379273168' in str(o):
        print("Found in order:", o)
