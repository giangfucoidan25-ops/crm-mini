import pandas as pd
import json
import re
import os
import sys
from datetime import datetime, timedelta
from sync_stats import sync_all_stats

sys.stdout.reconfigure(encoding='utf-8')

db_path = 'database.json'
excel_path = 'Nhập liệu Quản lý Đơn Hàng - Tháng 3.xlsx'

with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)
initial_exported_at = db.get('exported_at')

# Load keywords from settings
settings = db.get('settings', [])
stop_kw = next((s.get('value', []) for s in settings if s.get('key') == 'stop_care_keywords'), [])
priority_kw = next((s.get('value', []) for s in settings if s.get('key') == 'priority_keywords'), [])
non_priority_kw = next((s.get('value', []) for s in settings if s.get('key') == 'non_priority_keywords'), [])
promos = next((s.get('value', {}) for s in settings if s.get('key') == 'promotions_config'), {})

def get_next_id(table):
    if not db.get(table): return 1
    return max([item['id'] for item in db[table]]) + 1

def care_log_exists(customer_id, date_str, note):
    for log in db.get('care_logs', []):
        if log.get('customer_id') == customer_id and log.get('care_date') == date_str and log.get('note') == note:
            return True
    return False

def calculate_quantity_and_end_date(amount, order_date_str, products):
    if not amount or amount <= 0:
        return 1, None
    
    qty = 1
    matched = False
    usage_cycle = 30
    
    for key, items in promos.items():
        if matched: break
        for item in items:
            if item.get('price') == amount:
                qty = item.get('buy', 0) + item.get('get', 0)
                if qty == 0: qty = 1
                matched = True
                prod_name_lower = key.lower().replace('_', ' ')
                for p in products:
                    p_name = p.get('product_name', '').lower()
                    if prod_name_lower in p_name or (key == 'ancan' and 'ancan' in p_name) or (key == 'fu8' and 'fu' in p_name):
                        usage_cycle = p.get('usage_cycle_days', 30)
                        break
                break
                
    if not matched:
        for p in products:
            p_price = p.get('price', 0)
            if p_price > 0 and amount == p_price:
                qty = 1
                usage_cycle = p.get('usage_cycle_days', 30)
                matched = True
                break
            elif p_price > 0 and amount % p_price == 0:
                qty = int(amount / p_price)
                usage_cycle = p.get('usage_cycle_days', 30)
                matched = True
                break
                
    try:
        dt = datetime.strptime(order_date_str, "%Y-%m-%d")
        end_date = (dt + timedelta(days=qty * usage_cycle)).strftime("%Y-%m-%d")
    except:
        end_date = None
        
    return qty, end_date

def analyze_keyword_intent(text):
    if not text: return "NONE"
    t = str(text).lower()
    for kw in stop_kw:
        if kw.lower() in t: return "STOPPED"
    for kw in priority_kw:
        if kw.lower() in t: return "PRIORITY"
    for kw in non_priority_kw:
        if kw.lower() in t: return "NON_PRIORITY"
    return "NONE"

def get_next_id(table):
    if not db.get(table): return 1
    return max([item['id'] for item in db[table]]) + 1

def clean_phone(phone_str):
    if pd.isna(phone_str) or not phone_str: return ""
    p = str(phone_str).strip()
    if p.endswith('.0'): p = p[:-2]
    return re.sub(r'\D', '', p)

df = pd.read_excel(excel_path, header=None)

# Find header
header_row_idx = None
for idx, row in df.iterrows():
    if row.notna().sum() > 3 and any("số điện thoại" in str(v).lower() for v in row):
        header_row_idx = idx
        break

if header_row_idx is None:
    print("❌ Error: Could not find header row.")
    sys.exit(1)

df_data = df.iloc[header_row_idx+1:]

stats = {'customers_created': 0, 'customers_updated': 0, 'orders_created': 0, 'care_logs_created': 0}

for idx, row in df_data.iterrows():
    # Cols: 2=Product, 3=Date, 4=Phone, 5=Name_Addr, 6=Status, 7=Amount
    product_raw = str(row[2]).strip()
    if product_raw.lower() == 'fu8':
        product_raw = 'Fu 8'
    date_raw = row[3]
    phone_raw = str(row[4]).strip()
    name_addr_raw = str(row[5]).strip()
    status_raw = str(row[6]).strip().lower()
    amount_raw = str(row[7]).replace(',', '').replace('.', '').strip()
    notes_list = [str(v).strip() for v in row[8:] if pd.notna(v) and str(v).strip() != '']
    
    if (pd.isna(row[4]) or not phone_raw or phone_raw.lower() == 'nan') and (pd.isna(row[5]) or not name_addr_raw or name_addr_raw.lower() == 'nan'):
        continue

    # Name Address
    raw_name_addr_clean = re.sub(r'^KH\d+\s*-\s*', '', name_addr_raw, flags=re.IGNORECASE).strip()
    paren_matches = re.findall(r'\(([^)]+)\)', raw_name_addr_clean)
    shipping_note = ""
    for pm in paren_matches:
        pm_lower = pm.lower()
        if any(kw in pm_lower for kw in ['sđt', 'điện thoại', 'nhận', 'giao', 'ship', 'phone', 'đt']) or re.search(r'\d{6,}', pm):
            raw_name_addr_clean = raw_name_addr_clean.replace(f"({pm})", "").strip()
            raw_name_addr_clean = re.sub(r'\s+', ' ', raw_name_addr_clean)
            shipping_note = pm

    name = raw_name_addr_clean
    address = ""
    keywords = r'\s(số nhà|số|thôn|ấp|ngõ|đường|xóm|khu|cty|công ty|phòng|tổ|xã|phường|quận|huyện|tỉnh|tp|thành phố|thị trấn|chợ|chung cư|nhà thuốc|lô|căn hộ|kiốt|ngách|hẻm|tòa nhà|tháp|block|tầng|bệnh viện|nội trú|\w*\d\w*)\b'
    match = re.search(keywords, raw_name_addr_clean, flags=re.IGNORECASE)
    if match:
        idx_split = match.start()
        name = raw_name_addr_clean[:idx_split].strip()
        address = raw_name_addr_clean[idx_split:].strip()
        
    name = re.sub(r'[,.\-\s]+$', '', name).strip()
    if shipping_note:
        address = f"({shipping_note}) {address}" if address else f"({shipping_note})"

    phone = clean_phone(phone_raw)
    if not phone or phone.lower() == 'nan': phone = ""
    if name.lower() in ['kh', 'khách', 'khách hàng', 'nan', 'none']:
        name = f"Khách hàng {phone}" if phone else "Khách hàng Chưa tên"

    # Find customer
    customer = next((c for c in db['customers'] if (c['phone'] == phone and phone) or (c['zalo_phone'] == phone and phone)), None)
    if not customer and name and name != "Khách hàng Chưa tên":
        customer = next((c for c in db['customers'] if c['full_name'].lower() == name.lower()), None)
        
    init_status = "purchased"
    if "chốt" in status_raw: init_status = "repurchased"
    elif "hủy" in status_raw or "hoàn" in status_raw or "không nhận" in status_raw: init_status = "cancelled"
    
    if not customer:
        customer = {
            "id": get_next_id('customers'), "full_name": name, "phone": phone, "zalo_phone": phone, "email": "",
            "address": address, "customer_source": "other", "status": init_status, "tags": "", "note": "",
            "last_contact_date": None, "next_care_date": None, "care_cycle_days": 30,
            "created_at": datetime.now().isoformat() + "Z", "updated_at": datetime.now().isoformat() + "Z",
            "total_revenue": 0, "total_orders": 0, "priority_score": 0, "overdue_status": False,
            "transferred_status": False, "stopped_status": False, "last_order_date": None, "last_product_used": None,
            "keyword_category": "NONE"
        }
        db['customers'].append(customer)
        stats['customers_created'] += 1
    else:
        if not customer.get('address') and address: customer['address'] = address
        if not customer.get('phone') and phone: customer['phone'] = phone
        if not customer.get('zalo_phone') and phone: customer['zalo_phone'] = phone
        if "chốt" in status_raw and customer.get('status') != "repurchased": customer['status'] = "repurchased"

    product = next((p for p in db['products'] if p['product_name'].lower() == product_raw.lower()), None)
    if not product:
        product = {"id": get_next_id('products'), "product_name": product_raw, "product_category": "other", "price": 0, "active_status": True}
        db['products'].append(product)

    # Order date
    if pd.isna(date_raw): order_date_str = datetime.now().strftime("%Y-%m-%d")
    else:
        try:
            if isinstance(date_raw, pd.Timestamp) or isinstance(date_raw, datetime): order_date_str = date_raw.strftime("%Y-%m-%d")
            else: order_date_str = str(date_raw).split(" ")[0].strip()
        except Exception: order_date_str = datetime.now().strftime("%Y-%m-%d")

    # Amount
    try:
        amount = float(amount_raw)
        if 0 < amount < 10000: amount = amount * 1000
    except ValueError: amount = 0
    
    order_status = "completed"
    if "chốt" in status_raw: order_status = "completed"
    elif "hủy" in status_raw or "hoàn" in status_raw or "không nhận" in status_raw: order_status = "cancelled"

    order = next((o for o in db['orders'] if o['customer_id'] == customer['id'] and o['order_date'] == order_date_str and o['total_amount'] == amount), None)
    if not order:
        qty, end_date = calculate_quantity_and_end_date(amount, order_date_str, db.get('products', []))
        
        order = {
            "id": get_next_id('orders'), "customer_id": customer['id'], "product_id": product['id'], "product_name": product['product_name'],
            "order_date": order_date_str, "quantity": qty, "unit_price": amount / qty if qty > 0 else amount, "discount": 0, "total_amount": amount,
            "order_status": order_status, "estimated_product_end_date": end_date, "cancel_reason": "", "note": "",
            "created_at": datetime.now().isoformat() + "Z", "updated_at": datetime.now().isoformat() + "Z"
        }
        db['orders'].append(order)
        
        if order_status == "completed" and end_date:
            if not customer.get("estimated_product_end_date") or end_date > customer["estimated_product_end_date"]:
                customer["estimated_product_end_date"] = end_date
                
        stats['orders_created'] += 1

    # Care logs
    for note in notes_list:
        if "cskh" in note.lower() or "đã tư" in note.lower() or re.match(r'^\d{1,2}/\d{1,2}', note):
            care_date_str = order_date_str
            date_match = re.search(r'\b(\d{1,2})\s*/\s*(\d{1,2})\b', note)
            if date_match:
                day = int(date_match.group(1))
                month = int(date_match.group(2))
                if 1 <= day <= 31 and 1 <= month <= 12:
                    care_date_str = f"2026-{month:02d}-{day:02d}"

            if not care_log_exists(customer['id'], care_date_str, note):
                log = {
                    "id": get_next_id('care_logs'), "customer_id": customer['id'], "care_date": care_date_str,
                    "care_type": "call", "note": note, "follow_up_date": None, "created_at": datetime.now().isoformat() + "Z"
                }
                db['care_logs'].append(log)
                stats['care_logs_created'] += 1
        else:
            if customer.get('note'):
                if note not in customer['note']:
                    customer['note'] += f"\n{note}"
            else:
                customer['note'] = note

    # Automatically scan for keywords and update status
    full_text = str(customer.get('note', ''))
    for log in db['care_logs']:
        if log.get('customer_id') == customer['id']:
            full_text += " " + str(log.get('note', ''))
            
    intent = analyze_keyword_intent(full_text)
    if intent != "NONE":
        customer["keyword_category"] = intent
        if intent == "STOPPED":
            customer["stopped_status"] = True

sync_all_stats(db)

# Kiểm tra Concurrency
import sys
with open(db_path, 'r', encoding='utf-8') as f:
    current_db = json.load(f)
    if current_db.get('exported_at') != initial_exported_at:
        print("\n❌ LỖI NGHIÊM TRỌNG: Dữ liệu database.json đã bị thay đổi bởi quá trình khác (Web/JS) trong lúc script đang chạy!")
        print("❌ Hủy bỏ lệnh lưu để tránh ghi đè mất dữ liệu. Vui lòng chạy lại script!")
        sys.exit(1)

# Cập nhật Timestamp để JS nhận diện có dữ liệu mới
sync_timestamp = datetime.utcnow().isoformat() + "Z"
db['exported_at'] = sync_timestamp

settings_updated = False
for s in db.setdefault('settings', []):
    if s.get('key') == 'last_sync_timestamp':
        s['value'] = sync_timestamp
        settings_updated = True
        break
if not settings_updated:
    db['settings'].append({'key': 'last_sync_timestamp', 'value': sync_timestamp})

json.dump(db, open('database.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=4)
print("Import complete:", stats)
