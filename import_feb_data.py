import pandas as pd
import json
import re
import os
import sys
from datetime import datetime, timedelta
from sync_stats import sync_all_stats

# Reconfigure stdout to use UTF-8 for console output on Windows
sys.stdout.reconfigure(encoding='utf-8')

# Paths
db_path = 'database.json'
excel_path = 'Nhập liệu Quản lý Đơn Hàng - Tháng 3.xlsx'
if len(sys.argv) > 1:
    excel_path = sys.argv[1]

if not os.path.exists(db_path):
    print(f"❌ Error: {db_path} not found.")
    sys.exit(1)

if not os.path.exists(excel_path):
    print(f"❌ Error: {excel_path} not found.")
    sys.exit(1)

# Load database
print("⏳ Loading database.json...")
with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)
initial_exported_at = db.get('exported_at')

# Load keywords from settings
settings = db.get('settings', [])
stop_kw = next((s.get('value', []) for s in settings if s.get('key') == 'stop_care_keywords'), [])
priority_kw = next((s.get('value', []) for s in settings if s.get('key') == 'priority_keywords'), [])
non_priority_kw = next((s.get('value', []) for s in settings if s.get('key') == 'non_priority_keywords'), [])
promos = next((s.get('value', {}) for s in settings if s.get('key') == 'promotions_config'), {})

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

# Determine product name hybrid logic
def determine_product_name(amount, original_text):
    if not amount or amount <= 0:
        return _finalize_name(original_text)
        
    try:
        # Load promos config from settings
        settings = db.get('settings', [])
        promos = {}
        for s in settings:
            if s.get('key') == 'promotions_config':
                promos = s.get('value', {})
                break
                
        # 1. Check promos
        for key, items in promos.items():
            for item in items:
                if item.get('price') == amount:
                    prod_name = key
                    if key == 'ancan': prod_name = 'Ancan'
                    if key == 'fu8': prod_name = 'Fu 8'
                    if key == 'fucoidan_nano': prod_name = 'Fucoidan Nano'
                    
                    promo_text = ''
                    buy = item.get('buy', 0)
                    get = item.get('get', 0)
                    if buy > 0 and get > 0: promo_text = f"Mua {buy} tặng {get}"
                    elif buy > 0 and get == 0: promo_text = f"Mua {buy} hộp"
                    
                    return f"{prod_name} - {promo_text}" if promo_text else prod_name

        # 2. Check base products
        for p in db.get('products', []):
            p_price = p.get('price', 0)
            if p_price > 0 and amount == p_price:
                return p.get('product_name')
            if p_price > 0 and amount % p_price == 0:
                return p.get('product_name')
    except Exception as e:
        print("Warning: " + str(e))
        
    return _finalize_name(original_text)

def _finalize_name(text):
    if not text:
        return "Chưa xác định"
    clean_text = str(text).strip()
    if clean_text == "" or clean_text.lower() == "nan":
        return "Chưa xác định"
    return clean_text

# Helper functions for IDs
def get_next_id(table):
    if not db.get(table):
        return 1
    return max([item['id'] for item in db[table]]) + 1

# Standardize phone numbers to digits only
def clean_phone(phone_str):
    if pd.isna(phone_str) or not phone_str:
        return ""
    p = str(phone_str).strip()
    if p.endswith('.0'):
        p = p[:-2]
    return re.sub(r'\D', '', p)

def clean_date(date_val):
    if isinstance(date_val, (pd.Timestamp, datetime)):
        return date_val.strftime("%Y-%m-%d")
    try:
        return pd.to_datetime(str(date_val)).strftime("%Y-%m-%d")
    except:
        return None

# Match two phone numbers based on cleaned parts (segment match to support dual phones)
def phones_match(p1, p2):
    cp1 = clean_phone(p1)
    cp2 = clean_phone(p2)
    if not cp1 or not cp2:
        return False
        
    def get_parts(cp):
        parts = []
        for i in range(0, len(cp), 10):
            part = cp[i:i+10]
            if len(part) >= 9:
                parts.append(part)
        if not parts:
            parts.append(cp)
        return parts

    parts1 = get_parts(cp1)
    parts2 = get_parts(cp2)
    for part1 in parts1:
        for part2 in parts2:
            if part1 in part2 or part2 in part1:
                return True
    return False

# Find customer in database by phone or name
def find_customer(excel_phone, excel_name):
    # 1. Match by phone first (if available)
    excel_phone_cleaned = clean_phone(excel_phone)
    if excel_phone_cleaned:
        for c in db['customers']:
            db_phone = c.get('phone', '')
            db_zalo = c.get('zalo_phone', '')
            if (db_phone and phones_match(excel_phone_cleaned, db_phone)) or \
               (db_zalo and phones_match(excel_phone_cleaned, db_zalo)):
                return c

    # 2. Match by name (case-insensitive)
    if excel_name:
        clean_excel_name = excel_name.lower().strip()
        for c in db['customers']:
            if c.get('full_name', '').lower().strip() == clean_excel_name:
                return c
    return None

# Find or map product in database
def find_product(excel_product_name):
    ep_lower = str(excel_product_name).lower().strip()
    if not ep_lower or ep_lower == 'nan':
        for p in db['products']:
            if p['id'] == 2 or p['product_name'].lower() == 'sản phẩm khác':
                return p
        return db['products'][0] if db['products'] else None

    # Try exact match
    for p in db['products']:
        if p['product_name'].lower().strip() == ep_lower:
            return p

    # Try fuzzy matches for common products
    if 'ancan' in ep_lower or 'anccan' in ep_lower:
        for p in db['products']:
            if 'ancan' in p['product_name'].lower():
                return p

    if 'fucoidan' in ep_lower:
        # Check if there is an exact or containing match in db
        for p in db['products']:
            if p['product_name'].lower() == ep_lower:
                return p

    # Try containing match
    for p in db['products']:
        db_name_lower = p['product_name'].lower().strip()
        if db_name_lower in ep_lower or ep_lower in db_name_lower:
            return p
            
    return None

# Check if an order already exists
def order_exists(customer_id, product_id, order_date, total_amount):
    for o in db['orders']:
        if o.get('customer_id') == customer_id and \
           o.get('product_id') == product_id and \
           o.get('order_date') == order_date and \
           abs(o.get('total_amount', 0) - total_amount) < 0.01:
            return True
    return False

# Check if a care log already exists
def care_log_exists(customer_id, care_date, note):
    for log in db['care_logs']:
        if log.get('customer_id') == customer_id and \
           log.get('care_date') == care_date and \
           log.get('note', '').strip() == note.strip():
            return True
    return False

# Load Excel
print(f"⏳ Reading Excel file: {excel_path}...")
df = pd.read_excel(excel_path, header=None)

# Find the header row and map columns
header_row_idx = None
col_map = {}

for idx, row in df.iterrows():
    row_lower = [str(x).lower().strip() for x in row.values]
    
    # Try to find standard columns in this row
    found_cols = 0
    temp_map = {}
    for c_idx, val in enumerate(row_lower):
        if 'sản phẩm' in val and 'tên' not in val: # Tên sản phẩm or Sản phẩm
            temp_map['product'] = c_idx
        elif 'tên sản phẩm' in val:
            temp_map['product'] = c_idx
        elif 'ngày' in val and 'đặt' in val:
            temp_map['date'] = c_idx
        elif 'điện thoại' in val:
            temp_map['phone'] = c_idx
        elif 'họ tên' in val or 'địa chỉ' in val:
            temp_map['name_addr'] = c_idx
        elif 'tình trạng' in val:
            temp_map['status'] = c_idx
        elif 'tổng tiền' in val:
            temp_map['amount'] = c_idx
        elif 'ghi chú' in val:
            if 'note' not in temp_map:
                temp_map['note'] = []
            temp_map['note'].append(c_idx)
            
    # If we found at least phone and name, it's the header row
    if 'phone' in temp_map and 'name_addr' in temp_map:
        header_row_idx = idx
        col_map = temp_map
        break

if header_row_idx is None:
    print("❌ Error: Could not find header row.")
    sys.exit(1)

print(f"Found header at row {header_row_idx}. Column map: {col_map}")
df_data = df.iloc[header_row_idx+1:]

# Statistics
stats = {
    'customers_checked': 0,
    'customers_created': 0,
    'customers_updated': 0,
    'products_created': 0,
    'orders_created': 0,
    'orders_skipped': 0,
    'care_logs_created': 0,
    'care_logs_skipped': 0
}

# Process each row
for idx, row in df_data.iterrows():
    def get_val(key):
        if key in col_map:
            # Handle list for 'note'
            if key == 'note':
                res = []
                for n_idx in col_map['note']:
                    if n_idx < len(row):
                        val = str(row[n_idx]).strip()
                        if val and val.lower() != 'nan': res.append(val)
                return " | ".join(res)
            # Handle standard single index
            idx_val = col_map[key]
            if idx_val < len(row):
                return str(row[idx_val]).strip()
        return ""

    phone_raw = get_val('phone')
    raw_name_addr = get_val('name_addr')
    
    if (not phone_raw or phone_raw.lower() == 'nan') and (not raw_name_addr or raw_name_addr.lower() == 'nan'):
        continue

    # Extract name and address
    raw_name_addr_clean = re.sub(r'^KH\d+\s*-\s*', '', raw_name_addr, flags=re.IGNORECASE).strip()
    paren_matches = re.findall(r'\(([^)]+)\)', raw_name_addr_clean)
    shipping_note = ""
    for pm in paren_matches:
        if any(kw in pm.lower() for kw in ['sđt', 'điện thoại', 'nhận', 'giao', 'ship', 'phone', 'đt']):
            raw_name_addr_clean = raw_name_addr_clean.replace(f"({pm})", "").strip()
            shipping_note = pm

    name = raw_name_addr_clean
    address = ""
    keywords = (r'\s(số nhà|số|thôn|ấp|ngõ|đường|xóm|khu|cty|công ty|phòng|tổ|xã|phường|quận|huyện|tỉnh|tp|thành phố|thị trấn|chợ|chung cư|nhà thuốc|lô|căn hộ|kiốt|ngách|hẻm|tòa nhà|tháp|block|tầng|bệnh viện|nội trú|\w*\d\w*)\b')
    match = re.search(keywords, raw_name_addr_clean, flags=re.IGNORECASE)
    if match:
        idx_split = match.start()
        name = raw_name_addr_clean[:idx_split].strip()
        address = raw_name_addr_clean[idx_split:].strip()
        
    name = re.sub(r'[,.\-\s]+$', '', name).strip()
    if shipping_note: address = f"({shipping_note}) {address}" if address else f"({shipping_note})"

    phone = clean_phone(phone_raw)
    if name.lower() in ['kh', 'khách', 'khách hàng']:
        name = f"Khách hàng {phone}" if phone else "Khách hàng Chưa tên"

    customer = find_customer(phone, name)
    stats['customers_checked'] += 1
    
    status_raw = get_val('status').lower()
    init_status = "repurchased" if "chốt" in status_raw else ("cancelled" if any(x in status_raw for x in ["hủy", "hoàn", "không nhận"]) else "purchased")
        
    if not customer:
        customer = {
            "id": get_next_id('customers'), "full_name": name, "phone": phone, "zalo_phone": phone, "email": "",
            "address": address, "customer_source": "other", "status": init_status, "tags": "", "note": "",
            "last_contact_date": None, "next_care_date": None, "care_cycle_days": 30,
            "created_at": datetime.now().isoformat() + "Z", "updated_at": datetime.now().isoformat() + "Z",
            "total_revenue": 0, "total_orders": 0, "priority_score": 0, "overdue_status": False,
            "transferred_status": False, "stopped_status": False, "keyword_category": "NONE", "last_order_date": None, "last_product_used": None,
        }
        db['customers'].append(customer)
        stats['customers_created'] += 1
    else:
        if not customer.get('address') and address: customer['address'] = address
        if "chốt" in status_raw and customer.get('status') != "repurchased": customer['status'] = "repurchased"

    # Process Order
    amount_raw = get_val('amount')
    amount = 0
    if amount_raw and amount_raw.lower() != 'nan':
        amt_clean = re.sub(r'[^\d]', '', amount_raw)
        if amt_clean:
            amount = float(amt_clean)
            if 0 < amount < 10000: amount *= 1000

    order_date = clean_date(get_val('date')) or datetime.now().strftime('%Y-%m-%d')
    order_date_str = order_date

    product_name_excel = get_val('product')
    if str(product_name_excel).lower().strip() == 'fu8':
        product_name_excel = 'Fu 8'
    product = find_product(product_name_excel)
    if not product:
        product_name_db = product_name_excel if product_name_excel and product_name_excel.lower() != 'nan' else "Sản phẩm chưa rõ"
        product = {
            "id": get_next_id('products'),
            "product_name": product_name_db,
            "product_category": "other",
            "price": 0,
            "active_status": True,
            "created_at": datetime.now().isoformat() + "Z"
        }
        db['products'].append(product)
        stats['products_created'] += 1
        print(f"📦 Created new product in database: {product_name_db}")

    # Determine final product name using Hybrid Logic
    final_product_name = determine_product_name(amount, product_name_excel)

    # Parse Order Status
    order_status = "completed"
    if "nhận" in status_raw or "đã giao" in status_raw or "chốt" in status_raw:
        order_status = "completed"
    elif "hủy" in status_raw or "hoàn" in status_raw or "không nhận" in status_raw:
        order_status = "cancelled"

    # Add Order if not exists
    if not order_exists(customer['id'], product['id'], order_date_str, amount):
        qty, end_date = calculate_quantity_and_end_date(amount, order_date_str, db.get('products', []))
        
        order = {
            "id": get_next_id('orders'),
            "customer_id": customer["id"],
            "product_id": product["id"],
            "product_name": final_product_name,
            "order_date": order_date_str,
            "quantity": qty,
            "unit_price": amount / qty if qty > 0 else amount,
            "discount": 0,
            "total_amount": amount,
            "order_status": order_status,
            "estimated_product_end_date": end_date,
            "cancel_reason": "",
            "note": "Imported from Feb Excel Sheet",
            "created_at": datetime.now().isoformat() + "Z",
            "updated_at": datetime.now().isoformat() + "Z"
        }
        db['orders'].append(order)
        
        if order_status == "completed" and end_date:
            if not customer.get("estimated_product_end_date") or end_date > customer["estimated_product_end_date"]:
                customer["estimated_product_end_date"] = end_date

        stats['orders_created'] += 1
    else:
        stats['orders_skipped'] += 1

    # Extract Care Logs (columns 8 to 16)
    for col_idx in range(7, 18):
        if col_idx >= len(row):
            break
        note_val = str(row[col_idx]).strip()
        if not note_val or note_val.lower() == 'nan' or note_val == '-':
            continue

        # Look for date patterns like DD/MM
        date_matches = list(re.finditer(r'\b(\d{1,2})\s*/\s*(\d{1,2})\b', note_val))
        
        if date_matches:
            for i, match in enumerate(date_matches):
                day = int(match.group(1))
                month = int(match.group(2))
                
                if day < 1 or day > 31 or month < 1 or month > 12:
                    continue
                    
                year = 2026
                care_date_str = f"{year}-{month:02d}-{day:02d}"
                
                start_idx = match.start()
                end_idx = date_matches[i+1].start() if i+1 < len(date_matches) else len(note_val)
                content = note_val[start_idx:end_idx].strip()
                
                # Check for duplicates
                if not care_log_exists(customer['id'], care_date_str, content):
                    care_log = {
                        "id": get_next_id('care_logs'),
                        "customer_id": customer["id"],
                        "care_date": care_date_str,
                        "care_type": "Nhắn tin Zalo",
                        "note": content,
                        "created_at": datetime.now().isoformat() + "Z"
                    }
                    db['care_logs'].append(care_log)
                    stats['care_logs_created'] += 1
                else:
                    stats['care_logs_skipped'] += 1
        else:
            # If no date pattern, append to customer's general profile note if not already there
            if customer.get('note'):
                if note_val not in customer['note']:
                    customer['note'] += f"\n{note_val}"
            else:
                customer['note'] = note_val

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
    customer['updated_at'] = datetime.now().isoformat() + "Z"

sync_all_stats(db)

# Update synchronization timestamp
sync_timestamp = datetime.utcnow().isoformat() + "Z"
db['exported_at'] = sync_timestamp

# Update last_sync_timestamp in settings
settings_updated = False
for s in db.get('settings', []):
    if s.get('key') == 'last_sync_timestamp':
        s['value'] = sync_timestamp
        settings_updated = True
        break

if not settings_updated:
    db.setdefault('settings', []).append({
        'key': 'last_sync_timestamp',
        'value': sync_timestamp
    })

# Kiểm tra Concurrency
with open(db_path, 'r', encoding='utf-8') as f:
    current_db = json.load(f)
    if current_db.get('exported_at') != initial_exported_at:
        print("\n❌ LỖI NGHIÊM TRỌNG: Dữ liệu database.json đã bị thay đổi bởi quá trình khác (Web/JS) trong lúc script đang chạy!")
        print("❌ Hủy bỏ lệnh lưu để tránh ghi đè mất dữ liệu. Vui lòng chạy lại script!")
        sys.exit(1)

# Save database
print("⏳ Writing updated data to database.json...")
with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=4)

print("\n============ IMPORT COMPLETED ============")
print(f"Customers checked: {stats['customers_checked']}")
print(f"New customers created: {stats['customers_created']}")
print(f"Existing customers updated: {stats['customers_updated']}")
print(f"New products created: {stats['products_created']}")
print(f"New orders created: {stats['orders_created']} (Skipped {stats['orders_skipped']} duplicates)")
print(f"New care logs created: {stats['care_logs_created']} (Skipped {stats['care_logs_skipped']} duplicates)")
print("==========================================")
