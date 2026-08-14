import json
import io

with open('database.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with io.open('temp_lananh.txt', 'w', encoding='utf-8') as out:
    for c in data.get('customers', []):
        if 'Lan Anh' in c.get('full_name', ''):
            out.write(f"ID: {c.get('id')}\n")
            out.write(f"Name: {c.get('full_name')}\n")
            out.write(f"Phone: {c.get('phone')}\n")
            
            # print orders
            orders = c.get('orders', [])
            for o in orders:
                out.write(f"  Order ID: {o.get('id', 'N/A')}, Date: {o.get('order_date')}, Total: {o.get('total')}\n")
            out.write("---\n")
