import pandas as pd
import glob

excel_files = glob.glob("Nhập liệu Quản lý Đơn Hàng*.xlsx")
with open("excel_lananh.txt", "w", encoding="utf-8") as out:
    for file in excel_files:
        out.write(f"--- File: {file} ---\n")
        try:
            df = pd.read_excel(file)
            mask = df.astype(str).apply(lambda x: x.str.contains('Lan Anh|0379273168|0913490138', case=False, na=False)).any(axis=1)
            results = df[mask]
            if not results.empty:
                for idx, row in results.iterrows():
                    out.write(f"Row {idx}: {row.to_dict()}\n")
            else:
                out.write("Not found.\n")
        except Exception as e:
            out.write(f"Error reading file: {e}\n")
