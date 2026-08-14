import sys
with open('import_excel.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("'Nhập liệu Quản lý Đơn Hàng.xlsx'", "'Nhập liệu Quản lý Đơn Hàng - Tháng 6.xlsx'")

with open('import_june_data.py', 'w', encoding='utf-8') as f:
    f.write(content)
