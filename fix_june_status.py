import json
import sys
from datetime import datetime
from sync_stats import sync_all_stats

def run():
    with open('database.json', 'r', encoding='utf-8') as f:
        db = json.load(f)
    
    count = 0
    # The user said "các đơn hàng tháng 6 vừa cập nhật"
    # So we look for orders with created_at in 2026-08 (just updated) 
    # OR order_date in 2026-06
    for order in db.get('orders', []):
        created_at = order.get('created_at', '')
        order_date = order.get('order_date', '')
        status = order.get('order_status', '')
        
        is_recent_import = '2026-08' in created_at
        is_june = '2026-06' in order_date
        
        if (is_recent_import or is_june) and status not in ['completed', 'cancelled']:
            order['order_status'] = 'completed'
            count += 1
            print(f"Fixed order {order.get('id')} - date: {order_date} - from {status} to completed")
            
    if count > 0:
        print(f"Updating stats for {count} orders...")
        sync_all_stats(db)
        
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
        print("Done! Fixed", count, "orders.")
    else:
        print("No orders needed fixing.")

if __name__ == '__main__':
    run()
