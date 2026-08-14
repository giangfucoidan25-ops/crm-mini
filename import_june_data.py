import pandas as pd
import json
import re
import math
from datetime import datetime, timedelta
from sync_stats import sync_all_stats

# Load db
with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
initial_exported_at = db.get('exported_at')

# Helper functions for IDs
def get_next_id(table):
    if not db.get(table):
        return 1
    return max([item['id'] for item in db[table]]) + 1

def care_log_exists(customer_id, date_str, note):
    for log in db.get('care_logs', []):
        if log.get('customer_id') == customer_id and log.get('care_date') == date_str and log.get('note') == note:
            return True
    return False

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


# Load Excel
df = pd.read_excel('Nhập liệu Quản lý Đơn Hàng - Tháng 6.xlsx', header=None)
df = df.dropna(how='all')

# Finding the header row
header_row_idx = None
for idx, row in df.iterrows():
    if "số điện thoại" in str(row[4]).lower() or "họ tên" in str(row[5]).lower():
        header_row_idx = idx
        break

if header_row_idx is not None:
    df = df.iloc[header_row_idx+1:]

# Process rows
for idx, row in df.iterrows():
    if len(row) < 8:
        continue
        
    phone = str(row[4]).strip()
    if pd.isna(row[4]) or not phone or phone.lower() == 'nan':
        continue
    
    # Clean phone (remove trailing .0 if any)
    if phone.endswith('.0'):
        phone = phone[:-2]
    phone = re.sub(r'\D', '', phone) # Only keep digits
    
    raw_name_addr = str(row[5]).strip()
    # Loại bỏ tiền tố KHxxx - 
    raw_name_addr = re.sub(r'^KH\d+\s*-\s*', '', raw_name_addr, flags=re.IGNORECASE).strip()
    
    # Tách Tên và Địa chỉ bằng các keyword
    name = raw_name_addr
    address = ""
    match = re.search(r'\s(số nhà|thôn|ấp|ngõ|đường|xóm|khu|cty|công ty|phòng|tổ|xã|phường|quận|huyện|tỉnh|tp|thành phố|thị trấn|chợ)\b', raw_name_addr, flags=re.IGNORECASE)
    if match:
        idx_split = match.start()
        name = raw_name_addr[:idx_split].strip()
        address = raw_name_addr[idx_split:].strip()

    # Find customer
    customer = None
    for c in db['customers']:
        if c.get('phone') == phone or c.get('zalo_phone') == phone:
            customer = c
            break
    
    status_raw = str(row[6]).strip().lower()
    
    if not customer:
        customer = {
            "id": get_next_id('customers'),
            "full_name": name,
            "phone": phone,
            "zalo_phone": phone,
            "email": "",
            "address": address,
            "customer_source": "other",
            "status": "repurchased" if "chốt" in status_raw else "purchased",
            "tags": "",
            "note": "",
            "last_contact_date": None,
            "next_care_date": None,
            "care_cycle_days": 30,
            "created_at": datetime.now().isoformat() + "Z",
            "updated_at": datetime.now().isoformat() + "Z",
            "total_revenue": 0,
            "total_orders": 0,
            "priority_score": 0,
            "overdue_status": False,
            "transferred_status": False,
            "stopped_status": False,
            "keyword_category": "NONE",
            "last_order_date": None,
            "last_product_used": None
        }
        db['customers'].append(customer)
    else:
        if "chốt" in status_raw:
            customer["status"] = "repurchased"
            
    # Product
    product_name = str(row[2]).strip()
    if product_name.lower() == 'fu8':
        product_name = 'Fu 8'
    if pd.isna(row[2]) or product_name.lower() == 'nan' or not product_name:
        product_name = "Sản phẩm khác"
        
    product = None
    for p in db['products']:
        if p.get('product_name', '').lower() == product_name.lower():
            product = p
            break
            
    if not product:
        product = {
            "id": get_next_id('products'),
            "product_name": product_name,
            "product_category": "other",
            "price": 0,
            "active_status": True,
            "created_at": datetime.now().isoformat() + "Z"
        }
        db['products'].append(product)
        
    # Order Date
    order_date = row[3]
    if pd.isna(order_date):
        order_date_str = datetime.now().strftime("%Y-%m-%d")
    else:
        try:
            if isinstance(order_date, pd.Timestamp) or isinstance(order_date, datetime):
                order_date_str = order_date.strftime("%Y-%m-%d")
            else:
                order_date_str = str(order_date).split(" ")[0]
        except:
            order_date_str = datetime.now().strftime("%Y-%m-%d")
            
    # Amount
    amount_raw = str(row[7]).replace(',', '').replace('.', '').strip()
    try:
        amount = float(amount_raw)
        # Nếu nhỏ hơn 10.000 thì nhân với 1.000
        if amount > 0 and amount < 10000:
            amount = amount * 1000
    except:
        amount = 0
        
    # Status
    order_status = "completed"
    if "nhận" in status_raw or "đã giao" in status_raw or "chốt" in status_raw:
        order_status = "completed"
    elif "hủy" in status_raw or "hoàn" in status_raw or "không nhận" in status_raw:
        order_status = "cancelled"
        
    qty, end_date = calculate_quantity_and_end_date(amount, order_date_str, db.get('products', []))
    
    order = {
        "id": get_next_id('orders'),
        "customer_id": customer["id"],
        "product_id": product["id"],
        "product_name": product["product_name"],
        "order_date": order_date_str,
        "quantity": qty,
        "unit_price": amount / qty if qty > 0 else amount,
        "discount": 0,
        "total_amount": amount,
        "order_status": order_status,
        "estimated_product_end_date": end_date,
        "cancel_reason": "",
        "note": "",
        "created_at": datetime.now().isoformat() + "Z",
        "updated_at": datetime.now().isoformat() + "Z"
    }
    db['orders'].append(order)
    
    # Update customer stats
    if order_status == "completed":
        customer["total_revenue"] += amount
        customer["total_orders"] += 1
        
    if not customer.get("last_order_date") or order_date_str > customer["last_order_date"]:
        customer["last_order_date"] = order_date_str
        customer["last_product_used"] = product["product_name"]
        
    # Update customer's overall estimated end date if this order extends it
    if order_status == "completed" and end_date:
        if not customer.get("estimated_product_end_date") or end_date > customer["estimated_product_end_date"]:
            customer["estimated_product_end_date"] = end_date


    # Care Logs (columns 8 to 16)
    for col_idx in range(8, 17):
        if col_idx >= len(row):
            break
        note_val = str(row[col_idx]).strip()
        if not note_val or note_val.lower() == 'nan':
            continue
            
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
                
                if not customer.get("last_contact_date") or care_date_str > customer["last_contact_date"]:
                    customer["last_contact_date"] = care_date_str
        else:
            if customer.get("note"):
                customer["note"] += "\n" + note_val
            else:
                customer["note"] = note_val

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
with open('database.json', 'r', encoding='utf-8') as f:
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

with open('database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=4)
    
print(f"✅ HOÀN TẤT NHẬP LIỆU!")
print(f"Tổng Khách hàng: {len(db['customers'])}")
print(f"Tổng Đơn hàng: {len(db['orders'])}")
print(f"Tổng Lịch sử chăm sóc (Care Logs): {len(db['care_logs'])}")
