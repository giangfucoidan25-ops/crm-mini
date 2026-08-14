import sys
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

df2 = pd.read_excel('Nhập liệu Quản lý Đơn Hàng - Tháng 2.xlsx', header=None)
df3 = pd.read_excel('Nhập liệu Quản lý Đơn Hàng - Tháng 3.xlsx', header=None)

def get_header(df):
    for idx, row in df.iterrows():
        if any('ngày tháng' in str(v).lower() for v in row):
            return row.tolist()
    return []

h2 = get_header(df2)
h3 = get_header(df3)

print("Tháng 2 Header:")
for i, v in enumerate(h2[:10]):
    print(f"Col {i}: {v}")

print("\nTháng 3 Header:")
for i, v in enumerate(h3[:10]):
    print(f"Col {i}: {v}")
