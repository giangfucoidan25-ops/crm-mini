import pandas as pd
import json
import datetime
import sys
import os
import re

db_path = r'database.json'

try:
    with open(db_path, 'r', encoding='utf-8') as f:
        db = json.load(f)
except Exception as e:
    print(f"Lỗi đọc database.json: {e}")
    sys.exit(1)

initial_exported_at = db.get('exported_at')

promo_configs = {
    'nutri_nano': [
        { "price": 630000, "buy": 1, "get": 0 },
        { "price": 1260000, "buy": 2, "get": 0 },
        { "price": 1890000, "buy": 3, "get": 1 },
        { "price": 2520000, "buy": 4, "get": 2 },
        { "price": 3150000, "buy": 5, "get": 2 },
        { "price": 3780000, "buy": 6, "get": 3 },
        { "price": 4410000, "buy": 7, "get": 4 },
        { "price": 5040000, "buy": 8, "get": 5 },
        { "price": 7560000, "buy": 12, "get": 8 }
    ]
}

def clean_phone(p):
    if pd.isna(p): return ""
    p_str = str(p).split('.')[0].strip().replace(" ", "").replace("-", "")
    if p_str.startswith("84"): p_str = "0" + p_str[2:]
    if len(p_str) > 0 and not p_str.startswith("0"): p_str = "0" + p_str
    return p_str

products_dict = {p['id']: p for p in db.get('products', [])}
nutri_product = next((p for p in db.get('products', []) if 'nutri' in p.get('product_name', '').lower()), None)
if not nutri_product:
    print("Không tìm thấy sản phẩm Nutri Nano")
    sys.exit(1)

def get_next_id(table):
    if not db.get(table):
        return 1
    return max([item['id'] for item in db[table]]) + 1

try:
    df = pd.read_excel('Nhap lieu quan ly don hang - thang 7.xlsx', header=2)
except Exception as e:
    print(f"Lỗi đọc Excel: {e}")
    sys.exit(1)

matched_count = 0
added_orders = 0
updated_orders = 0
added_logs = 0

customers = db.get('customers', [])
orders = db.get('orders', [])
care_logs = db.get('care_logs', [])

for idx, row in df.iterrows():
    phone = clean_phone(row.get('số điện thoại', ''))
    if not phone: continue
    
    customer = next((c for c in customers if c.get('phone') == phone or c.get('zalo_phone') == phone), None)
    if not customer: continue
    
    matched_count += 1
    
    date_val = row.get('Ngày đặt hàng')
    if pd.isna(date_val): continue
    
    try:
        if isinstance(date_val, datetime.datetime):
            order_date_str = date_val.strftime('%Y-%m-%d')
        else:
            order_date_str = str(date_val).split(' ')[0]
            datetime.datetime.strptime(order_date_str, '%Y-%m-%d')
    except Exception:
        continue

    amount_val = row.get('Tổng tiền')
    if pd.isna(amount_val): amount_val = 0
    try:
        amount = int(str(amount_val).replace(',', '').replace('.', '').strip())
    except:
        amount = 0

    if amount > 0:
        buy = 0
        get = 0
        unit_price = nutri_product.get('price', 0)
        
        for promo in promo_configs['nutri_nano']:
            if promo['price'] == amount:
                buy = promo['buy']
                get = promo['get']
                break
        
        if buy == 0 and unit_price > 0:
            buy = amount // unit_price
            
        qty = buy + get
        if qty == 0: qty = 1
        
        cycle = nutri_product.get('usage_cycle_days', 30)
        end_date = datetime.datetime.strptime(order_date_str, '%Y-%m-%d') + datetime.timedelta(days=qty * cycle)
        end_date_str = end_date.strftime('%Y-%m-%d')
        
        items = []
        if buy > 0:
            items.append({
                "product_id": nutri_product['id'],
                "product_name": nutri_product['product_name'],
                "quantity": buy,
                "unit_price": unit_price,
                "is_gift": False
            })
        if get > 0:
            items.append({
                "product_id": nutri_product['id'],
                "product_name": nutri_product['product_name'],
                "quantity": get,
                "unit_price": 0,
                "is_gift": True
            })
            
        status_val = str(row.get('Tình trạng', '')).strip().lower()
        order_status = 'COMPLETED' if 'nhận' in status_val else 'DELIVERED'

        # Tìm đơn hàng bị trùng để cập nhật
        existing_order = None
        for o in orders:
            if o.get('customer_id') == customer['id'] and o.get('order_date') == order_date_str:
                existing_order = o
                break
        
        if existing_order:
            # Cập nhật đơn hàng
            existing_order['quantity'] = qty
            existing_order['total_amount'] = amount
            existing_order['items'] = items
            existing_order['order_status'] = order_status
            existing_order['estimated_product_end_date'] = end_date_str
            updated_orders += 1
        else:
            new_order = {
                "id": get_next_id('orders'),
                "customer_id": customer['id'],
                "product_id": nutri_product['id'],
                "product_name": nutri_product['product_name'],
                "order_date": order_date_str,
                "quantity": qty,
                "unit_price": unit_price,
                "discount": 0,
                "total_amount": amount,
                "order_status": order_status,
                "estimated_product_end_date": end_date_str,
                "note": "Imported from Excel",
                "items": items,
                "created_at": datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z'),
                "updated_at": datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
            }
            db.setdefault('orders', []).append(new_order)
            added_orders += 1
            
        if not customer.get('last_order_date') or customer['last_order_date'] < order_date_str:
            customer['last_order_date'] = order_date_str
            customer['last_product_used'] = nutri_product['product_name']
            customer['estimated_product_end_date'] = end_date_str
            if order_status == 'COMPLETED':
                customer['last_completed_order_date'] = order_date_str

    # Ghi chú
    note_cols = [c for c in df.columns if 'Unnamed' in str(c) or 'Ghi chú' in str(c)]
    for col in note_cols:
        note_val = row.get(col)
        if pd.isna(note_val) or str(note_val).strip() == '':
            continue
        note_str = str(note_val).strip()
        
        m = re.search(r'\b(\d{1,2})\s*/\s*(\d{1,2})\b', note_str)
        if m:
            day = int(m.group(1))
            month = int(m.group(2))
            
            if 1 <= month <= 12 and 1 <= day <= 31:
                year = 2026
                date_log_str = f"{year}-{month:02d}-{day:02d}"
                
                is_dup_log = False
                for lg in care_logs:
                    if lg.get('customer_id') == customer['id'] and lg.get('care_date') == date_log_str and lg.get('note') == note_str:
                        is_dup_log = True
                        break
                
                if not is_dup_log:
                    new_log = {
                        "id": get_next_id('care_logs'),
                        "customer_id": customer['id'],
                        "care_date": date_log_str,
                        "care_type": "Telesale",
                        "note": note_str,
                        "created_at": datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
                    }
                    db.setdefault('care_logs', []).append(new_log)
                    added_logs += 1

print(f"Matched Customers: {matched_count}")
print(f"Added Orders: {added_orders}")
print(f"Updated Orders: {updated_orders}")
print(f"Added Care Logs: {added_logs}")

try:
    sys.path.append(os.getcwd())
    from sync_stats import sync_all_stats
    sync_all_stats(db)
    print("Đã quét và cập nhật lại điểm số (sync_stats).")
except Exception as e:
    print(f"Không thể chạy sync_stats: {e}")

with open(db_path, 'r', encoding='utf-8') as f:
    current_db = json.load(f)

if current_db.get('exported_at') != initial_exported_at:
    print("LỖI NGHIÊM TRỌNG: Dữ liệu đã thay đổi trên Web, vui lòng xuất lại database.json")
    sys.exit(1)

now_iso = datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
db['exported_at'] = now_iso
if 'settings' in db:
    for s in db['settings']:
        if s.get('key') == 'last_sync_timestamp':
            s['value'] = now_iso
            break

with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print("Đã hoàn thành và lưu database.json.")
