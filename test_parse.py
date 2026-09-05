import pandas as pd
df = pd.read_excel('Nhap lieu quan ly don hang - thang 7.xlsx', header=None)
df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
print(df.head(2).to_string())
