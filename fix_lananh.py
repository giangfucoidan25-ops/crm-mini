import json
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')

db_path = 'database.json'

with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)

# Find old customer 27
c27 = next((c for c in db['customers'] if c['id'] == 27), None)

# Clean up c27's note
if c27:
    note27 = c27.get('note', '')
    note_to_remove = "Nó nhạt, anh mới dùng buổi sáng nay. Đã tư vấn lại chị cách sử dụng."
    if note_to_remove in note27:
        c27['note'] = note27.replace(note_to_remove, "").strip()
        c27['note'] = '\n'.join([line for line in c27['note'].split('\n') if line.strip()])

# Check if new customer already exists
c_new = next((c for c in db['customers'] if '0379273168' in c.get('phone', '')), None)
if not c_new:
    new_id = max([c['id'] for c in db['customers']]) + 1
    c_new = {
        "id": new_id,
        "full_name": "Lan Anh",
        "phone": "0379273168",
        "zalo_phone": "0379273168",
        "email": "",
        "address": "Lô 18, Định Công, Hoàng Mai, Hà Nội (Cổng B, TRường THPT May Academy )",
        "customer_source": "other",
        "status": "purchased",
        "tags": "",
        "note": "Nó nhạt, anh mới dùng buổi sáng nay. Đã tư vấn lại chị cách sử dụng.",
        "last_contact_date": None,
        "next_care_date": None,
        "care_cycle_days": 30,
        "created_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "updated_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "total_revenue": 0,
        "total_orders": 0,
        "priority_score": 0,
        "overdue_status": False,
        "transferred_status": False,
        "stopped_status": False,
        "last_order_date": None,
        "last_product_used": None,
        "keyword_category": "NONE"
    }
    db['customers'].append(c_new)

# Find the wrong order 168
order168 = next((o for o in db['orders'] if o['id'] == 168 and o['customer_id'] == 27), None)
if order168:
    order168['customer_id'] = c_new['id']
    order168['order_date'] = '2026-05-04' # Fix order date
    order168['note'] = '' # Clean up wrong note

# Recalculate stats for c27 and c_new
from sync_stats import sync_all_stats
sync_all_stats(db)

# Update exported_at to trigger UI reload
new_ts = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
db['exported_at'] = new_ts
for s in db.get('settings', []):
    if s.get('key') == 'last_sync_timestamp':
        s['value'] = db['exported_at']

with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=4)

print("Fixed Lan Anh 0379273168!")
