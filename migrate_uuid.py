import json
import uuid
import os

DB_PATH = r"g:\My Drive\Code app\dev_projects\crm-mini\database.json"
OUT_PATH = r"g:\My Drive\Code app\dev_projects\crm-mini\database_v2.json"

def migrate():
    print("Bắt đầu chuyển đổi ID sang UUID...")
    with open(DB_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Dictionary lưu trữ map từ ID cũ (int) sang UUID mới (string)
    mappings = {
        'customers': {},
        'products': {},
        'orders': {},
        'care_logs': {},
        'message_templates': {},
        'appointments': {},
        'ai_sessions': {},
        'ai_analysis_history': {},
        'backup_logs': {}
    }

    # 1. Tạo UUID mới cho tất cả các bảng
    for table_name in mappings.keys():
        if table_name in data:
            for item in data[table_name]:
                old_id = item.get('id')
                if old_id is not None:
                    new_uuid = str(uuid.uuid4())
                    mappings[table_name][old_id] = new_uuid
                    item['id'] = new_uuid

    # 2. Cập nhật các khóa ngoại (Foreign Keys)
    # 2.1 Bảng orders
    if 'orders' in data:
        for order in data['orders']:
            old_cust_id = order.get('customer_id')
            if old_cust_id in mappings['customers']:
                order['customer_id'] = mappings['customers'][old_cust_id]
                
            old_prod_id = order.get('product_id')
            if old_prod_id in mappings['products']:
                order['product_id'] = mappings['products'][old_prod_id]

    # 2.2 Bảng care_logs
    if 'care_logs' in data:
        for log in data['care_logs']:
            old_cust_id = log.get('customer_id')
            if old_cust_id in mappings['customers']:
                log['customer_id'] = mappings['customers'][old_cust_id]

    # 2.3 Bảng appointments
    if 'appointments' in data:
        for appt in data['appointments']:
            old_cust_id = appt.get('customer_id')
            if old_cust_id in mappings['customers']:
                appt['customer_id'] = mappings['customers'][old_cust_id]

    # Lưu file mới
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Chuyển đổi thành công! Đã lưu file mới tại: {OUT_PATH}")

if __name__ == '__main__':
    migrate()
