import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://ltpjtweotwmrgbvyqrgz.supabase.co"
SUPABASE_KEY = "sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR"

def upload_table(table_name, data):
    if not data:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    # Supabase REST cho phép insert mảng
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        urllib.request.urlopen(req)
        print(f"✅ Đã tải lên thành công {len(data)} bản ghi vào bảng '{table_name}'")
    except urllib.error.HTTPError as e:
        print(f"❌ Lỗi tải lên bảng '{table_name}': {e.code} {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"❌ Lỗi: {e}")

def main():
    print("Đang đọc file database_v2.json...")
    try:
        with open("database_v2.json", "r", encoding="utf-8") as f:
            db = json.load(f)
    except Exception as e:
        print(f"Không thể đọc file: {e}")
        return

    tables = ["customers", "products", "orders", "care_logs", "appointments", "message_templates"]
    
    for table in tables:
        if table in db and db[table]:
            # Xóa các cột có dấu chấm (thường do lỗi Dexie sinh ra) hoặc ngày tháng rỗng
            clean_data = []
            for row in db[table]:
                clean_row = {}
                for k, v in row.items():
                    if "." in k: continue
                    if v == "" or v == "NaN":
                        clean_row[k] = None
                    else:
                        clean_row[k] = v
                clean_data.append(clean_row)
                
            upload_table(table, clean_data)
        else:
            print(f"⚠️ Bảng '{table}' trống hoặc không tồn tại.")
            
    print("🎉 Hoàn tất khôi phục dữ liệu lên Supabase!")

if __name__ == "__main__":
    main()
