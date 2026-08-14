import pandas as pd
import glob
files = glob.glob('Nh*.xlsx')
with open('out.txt', 'w', encoding='utf-8') as f:
    for file in files:
        df = pd.read_excel(file, header=None)
        for row in df.itertuples():
            if '0357847334' in str(row) or '0937305383' in str(row) or '0904143336' in str(row) or 'Lê Hiệp' in str(row):
                f.write(f"{file}: {row}\n")
