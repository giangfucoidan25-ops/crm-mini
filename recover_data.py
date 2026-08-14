import pandas as pd, json, re, os, math
from datetime import datetime

print('Loading base database.json.bak...')
db = json.load(open('database.json.bak', encoding='utf-8'))

def get_next_id(table):
    return max([x.get('id', 0) for x in db[table]] + [0]) + 1

seed_products = [
    { 'product_name': 'Fucoidan Nano 4500', 'product_category': 'fucoidan', 'price': 1850000, 'unit_name': 'Hộp', 'quantity_per_unit': 60, 'unit_type': 'viên', 'default_usage_per_day': 2 },
    { 'product_name': 'Nano Fucoidan', 'product_category': 'fucoidan', 'price': 1950000, 'unit_name': 'Hộp', 'quantity_per_unit': 60, 'unit_type': 'viên', 'default_usage_per_day': 2 },
    { 'product_name': 'Nutri Nano Fucoidan', 'product_category': 'fucoidan', 'price': 1250000, 'unit_name': 'Hộp', 'quantity_per_unit': 400, 'unit_type': 'gram', 'default_usage_per_day': 20 },
    { 'product_name': 'Đông trùng hạ thảo', 'product_category': 'other', 'price': 850000, 'unit_name': 'Hộp', 'quantity_per_unit': 30, 'unit_type': 'viên', 'default_usage_per_day': 1 },
    { 'product_name': 'Yến sào', 'product_category': 'other', 'price': 550000, 'unit_name': 'Hộp', 'quantity_per_unit': 6, 'unit_type': 'hũ', 'default_usage_per_day': 1 }
]
existing_products = {p.get('product_name'): p for p in db.get('products', [])}
db['products'] = []
for p in seed_products:
    if p['product_name'] in existing_products:
        p['id'] = existing_products[p['product_name']].get('id')
    else:
        p['id'] = get_next_id('products')
    db['products'].append(p)

files = [
    'Nhập liệu Quản lý Đơn Hàng.xlsx',
    'Nhập liệu Quản lý Đơn Hàng - Tháng 2.xlsx',
    'Nhập liệu Quản lý Đơn Hàng - Tháng 3.xlsx'
]

stats = {'new_customers': 0, 'new_orders': 0, 'care_logs': 0}

for file in files:
    print(f'Processing {file}...')
    try:
        df = pd.read_excel(file, skiprows=1)
        df = df.dropna(subset=[df.columns[1]])
    except Exception as e:
        print(f'Error reading {file}: {e}')
        continue

    for index, row in df.iterrows():
        try:
            name = str(row.iloc[1]).strip()
            if not name or name.lower() == 'nan':
                continue
                
            phone_raw = str(row.iloc[2]).strip()
            if phone_raw.lower() == 'nan': phone_raw = ''
            phone = ''.join(filter(str.isdigit, phone_raw))
            if phone and not phone.startswith('0'): phone = '0' + phone
            
            customer = next((c for c in db['customers'] if (c.get('phone') == phone and phone) or (c.get('full_name') == name and not phone)), None)
            
            if not customer:
                customer = {
                    'id': get_next_id('customers'),
                    'full_name': name,
                    'phone': phone,
                    'status': 'new',
                    'customer_source': 'facebook',
                    'created_at': datetime.now().isoformat() + 'Z',
                    'updated_at': datetime.now().isoformat() + 'Z',
                    'note': ''
                }
                db['customers'].append(customer)
                stats['new_customers'] += 1
                
            date_raw = row.iloc[0]
            order_date_str = ''
            if pd.notna(date_raw):
                if isinstance(date_raw, datetime): order_date_str = date_raw.strftime('%Y-%m-%d')
                else:
                    try: order_date_str = pd.to_datetime(date_raw, dayfirst=True).strftime('%Y-%m-%d')
                    except: pass
            
            product_name = str(row.iloc[3]).strip()
            if product_name.lower() == 'nan': product_name = 'Nutri Nano Fucoidan'
            if product_name.lower() == 'fu8': product_name = 'Fu 8'
            
            if not next((p for p in db['products'] if p.get('product_name') == product_name), None):
                db['products'].append({
                    'id': get_next_id('products'),
                    'product_name': product_name,
                    'price': 0,
                    'product_category': 'other'
                })
            
            total_amount_raw = row.iloc[5]
            total_amount = 0
            if pd.notna(total_amount_raw):
                try: total_amount = int(float(str(total_amount_raw).replace(',', '').replace(' ', '')))
                except: pass
                
            order_status = 'completed' if str(row.iloc[6]).strip().lower() == 'đã nhận' else 'pending'
            
            order = next((o for o in db['orders'] if o.get('customer_id') == customer['id'] and o.get('order_date') == order_date_str and o.get('product_name') == product_name and o.get('total_amount') == total_amount), None)
            if not order:
                order = {
                    'id': get_next_id('orders'),
                    'customer_id': customer['id'],
                    'order_date': order_date_str,
                    'product_name': product_name,
                    'total_amount': total_amount,
                    'order_status': order_status,
                    'created_at': datetime.now().isoformat() + 'Z'
                }
                db['orders'].append(order)
                stats['new_orders'] += 1
            
            for col_idx in range(7, 18):
                if col_idx >= len(row): break
                note_val = str(row.iloc[col_idx]).strip()
                if not note_val or note_val.lower() == 'nan' or note_val == '-': continue
                
                date_matches = list(re.finditer(r'\b(\d{1,2})\s*/\s*(\d{1,2})\b', note_val))
                if date_matches:
                    for i, match in enumerate(date_matches):
                        month, day = int(match.group(1)), int(match.group(2))
                        if day < 1 or day > 31 or month < 1 or month > 12: continue
                        care_date_str = f"2026-{month:02d}-{day:02d}"
                        
                        start_idx = match.start()
                        end_idx = date_matches[i+1].start() if i+1 < len(date_matches) else len(note_val)
                        content = note_val[start_idx:end_idx].strip()
                        
                        if not next((log for log in db['care_logs'] if log['customer_id'] == customer['id'] and log['care_date'] == care_date_str and log['note'] == content), None):
                            db['care_logs'].append({
                                'id': get_next_id('care_logs'),
                                'customer_id': customer['id'],
                                'care_date': care_date_str,
                                'care_type': 'Nhắn tin Zalo',
                                'note': content,
                                'created_at': datetime.now().isoformat() + 'Z'
                            })
                            stats['care_logs'] += 1
                else:
                    curr_note = customer.get('note', '')
                    if note_val not in curr_note:
                        customer['note'] = curr_note + '\n' + note_val if curr_note else note_val

        except Exception as e:
            print(f'Error processing row {index}: {e}')

for customer in db['customers']:
    cust_orders = [o for o in db['orders'] if o.get('customer_id') == customer['id']]
    completed_orders = [o for o in cust_orders if o.get('order_status') == 'completed']
    
    customer['total_revenue'] = sum([o.get('total_amount', 0) for o in completed_orders])
    customer['total_orders'] = len(cust_orders)
    
    if completed_orders:
        sorted_completed = sorted(completed_orders, key=lambda o: (o.get('order_date', ''), o.get('id', 0)), reverse=True)
        customer['last_completed_order_date'] = sorted_completed[0].get('order_date')
    
    care_logs = [log for log in db['care_logs'] if log['customer_id'] == customer['id']]
    if care_logs:
        sorted_logs = sorted(care_logs, key=lambda l: l['care_date'], reverse=True)
        customer['last_contact_date'] = sorted_logs[0]['care_date']

with open('database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print('Done! Stats:', stats)
