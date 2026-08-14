import json
import os
from datetime import datetime
from sync_stats import sync_all_stats

db_path = r"g:\My Drive\Marketing team\crm-mini\database.json"

if not os.path.exists(db_path):
    print("Không tìm thấy file database.json")
    exit(1)

with open(db_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# === BẢO VỆ CHỐNG GHI ĐÈ ===
if "exported_at" not in data:
    data["exported_at"] = datetime.now().isoformat() + "Z"
old_exported_at = data["exported_at"]

# Đồng bộ stats bằng logic chuẩn
sync_all_stats(data)

# Cập nhật Timestamp
new_timestamp = datetime.now().isoformat() + "Z"
data["exported_at"] = new_timestamp

settings_updated = False
for s in data.setdefault("settings", []):
    if s.get("key") == "last_sync_timestamp":
        s["value"] = new_timestamp
        settings_updated = True
        break
if not settings_updated:
    data["settings"].append({"key": "last_sync_timestamp", "value": new_timestamp})

# === LƯU FILE CÓ CHECK XUNG ĐỘT ===
with open(db_path, "r", encoding="utf-8") as f:
    current_data = json.load(f)
    if current_data.get("exported_at") != old_exported_at:
        print("❌ LỖI XUNG ĐỘT DỮ LIỆU: File database.json đã bị thay đổi bởi một tiến trình khác.")
        print("Vui lòng chạy lại script.")
        exit(1)

with open(db_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã cập nhật thành công hạn dùng cho tất cả khách hàng trong database.json")
