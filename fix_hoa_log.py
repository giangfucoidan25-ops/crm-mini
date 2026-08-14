import json
from datetime import datetime

def run():
    with open('database.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
        
    logs = db.get('care_logs', [])
    
    # Logs to delete: 547, 548, 549, 550, 557, 558
    to_delete = {547, 548, 549, 550, 557, 558}
    
    # Filter out the logs
    new_logs = [log for log in logs if log.get('id') not in to_delete]
    
    # Add consolidated log
    new_log = {
        "id": max([l['id'] for l in db['care_logs']]) + 1,
        "customer_id": 157,
        "care_date": "2026-07-01",
        "care_type": "Gọi điện",
        "note": "Cô còn 1 hộp, dùng hạn chế vì hết tài khoản. Đã tư vấn lại chương trình ưu đãi. Cô quan tâm 6t3 + viên nang sâm (đã gửi hình ảnh Zalo). Hẹn gọi lại vì nhà cô ăn cơm muộn. Đăng ký cho cô 6t3 (CNM), đã lên đơn nhưng cô băn khoăn muốn rút xuống 4t2.\n[Hệ thống: Khách còn 1 hộp (tính từ 01/07/2026) -> Lùi hạn đến 31/07/2026]",
        "created_at": "2026-07-01T14:14:00.000Z"
    }
    new_logs.append(new_log)
    
    db['care_logs'] = new_logs
    
    # Update timestamp
    sync_timestamp = datetime.utcnow().isoformat() + "Z"
    db['exported_at'] = sync_timestamp
    for s in db.get('settings', []):
        if s.get('key') == 'last_sync_timestamp':
            s['value'] = sync_timestamp
            break
            
    with open('database.json', 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=4)
        
    print("Fixed logs for Lê Thị Hoa (Customer 157).")

if __name__ == '__main__':
    run()
