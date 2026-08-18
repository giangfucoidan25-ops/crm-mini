import json
import urllib.request
import urllib.error
import sys

# 1. Cấu hình kết nối Supabase
SUPABASE_URL = "https://ltpjtweotwmrgbvyqrgz.supabase.co"
SUPABASE_KEY = "sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates, return=minimal"
}

# 2. Định nghĩa cấu trúc bảng đã tạo (Whitelist)
SCHEMA = {
    "customers": {"id", "full_name", "phone", "zalo_phone", "email", "address", "customer_source", "status", "tags", "note", "last_contact_date", "next_care_date", "care_cycle_days", "created_at", "updated_at", "total_revenue", "total_orders", "priority_score", "overdue_status", "transferred_status", "last_order_date", "last_product_used", "keyword_category", "last_completed_order_date", "getfly_url", "stopped_status", "estimated_product_end_date", "special_note", "product_expiries", "recall_status", "manual_stopped"},
    "products": {"id", "product_name", "product_category", "price", "unit_name", "quantity_per_unit", "unit_type", "default_usage_per_day", "inner_unit", "dosage_per_day", "usage_cycle_days", "reorder_reminder_days", "usage_instruction", "description", "note", "updated_at"},
    "orders": {"id", "customer_id", "product_id", "product_name", "order_date", "quantity", "unit_price", "discount", "total_amount", "order_status", "estimated_product_end_date", "cancel_reason", "note", "created_at", "updated_at"},
    "care_logs": {"id", "customer_id", "care_date", "care_type", "note", "created_at"},
    "message_templates": {"id", "template_name", "content", "created_at"},
    "appointments": {"id", "customer_id", "appointment_date", "note", "status", "created_at"}
}

def insert_in_batches(table_name, data_list, batch_size=100):
    if not data_list:
        print(f"Bảng {table_name} trống, bỏ qua.")
        return

    print(f"\nBắt đầu đẩy {len(data_list)} dòng lên bảng {table_name}...")
    
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    allowed_keys = SCHEMA.get(table_name, set())

    for i in range(0, len(data_list), batch_size):
        raw_batch = data_list[i:i + batch_size]
        
        import re
        
        # Chỉ giữ lại các trường có trong SQL schema
        batch = []
        for item in raw_batch:
            clean_item = {k: v for k, v in item.items() if k in allowed_keys}
            
            # Sửa các lỗi nhập ngày bị ngược (VD: 2025-23-08 -> 2025-08-23)
            for k, v in clean_item.items():
                if isinstance(v, str) and k.endswith("_date"):
                    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
                    if match:
                        y, m, d = match.groups()
                        if int(m) > 12 and int(d) <= 12:
                            clean_item[k] = f"{y}-{d}-{m}"
                            
            batch.append(clean_item)
        
        # Lấy tất cả các keys có trong batch này
        all_keys = set()
        for item in batch:
            all_keys.update(item.keys())
            
        # Đảm bảo mọi object đều có đủ các keys (nếu thiếu thì set là None)
        # Và xử lý chuỗi rỗng
        for item in batch:
            for k in all_keys:
                if k not in item or item[k] == "":
                    item[k] = None

        data_bytes = json.dumps(batch).encode('utf-8')
        
        req = urllib.request.Request(url, data=data_bytes, headers=HEADERS, method='POST')
        
        try:
            with urllib.request.urlopen(req) as response:
                if response.status not in (200, 201):
                    print(f"Lỗi HTTP {response.status}: {response.read()}")
                    sys.exit(1)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"Lỗi khi đẩy bảng {table_name} (dòng {i}): {e.code} - {error_body}")
            sys.exit(1)
        except Exception as e:
            print(f"Lỗi kết nối mạng: {e}")
            sys.exit(1)
            
        print(f"- Đã đẩy thành công từ dòng {i} đến {i + len(batch) - 1}")

    print(f"✅ Hoàn thành bảng {table_name}!")

def main():
    print("Đang đọc file database.json...")
    try:
        with open('database.json', 'r', encoding='utf-8') as f:
            db = json.load(f)
    except Exception as e:
        print(f"Không thể đọc file database.json: {e}")
        return

    print("--- BẮT ĐẦU CHUYỂN DỮ LIỆU LÊN SUPABASE ---")
    
    # Thứ tự đẩy rất quan trọng (bảng gốc trước, bảng phụ thuộc sau)
    insert_in_batches("customers", db.get("customers", []))
    insert_in_batches("products", db.get("products", []))
    insert_in_batches("orders", db.get("orders", []))
    insert_in_batches("care_logs", db.get("care_logs", []))
    insert_in_batches("appointments", db.get("appointments", []))
    insert_in_batches("message_templates", db.get("message_templates", []))

    print("\n🎉 CHÚC MỪNG! TOÀN BỘ DỮ LIỆU ĐÃ LÊN ĐÁM MÂY THÀNH CÔNG!")

if __name__ == "__main__":
    main()
