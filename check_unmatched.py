import pandas as pd
import json

def clean_phone(p):
    if pd.isna(p): return ""
    p_str = str(p).split('.')[0].strip().replace(" ", "").replace("-", "")
    if p_str.startswith("84"): p_str = "0" + p_str[2:]
    if len(p_str) > 0 and not p_str.startswith("0"): p_str = "0" + p_str
    return p_str

db = json.load(open('database.json', encoding='utf-8'))
customers = db.get('customers', [])
df = pd.read_excel('Nhap lieu quan ly don hang - thang 7.xlsx', header=2)

unmatched = []
for idx, row in df.iterrows():
    phone = clean_phone(row.get('số điện thoại', ''))
    if not phone: continue
    
    customer = next((c for c in customers if c.get('phone') == phone or c.get('zalo_phone') == phone), None)
    if not customer:
        name = row.get('Link ẩn, Họ tên và địa chỉ', '')
        unmatched.append(f"{phone} - {str(name)[:30]}...")

print(f"Unmatched count: {len(unmatched)}")
for u in unmatched[:10]:
    print(u)
