import requests
import json

URL = "https://ltpjtweotwmrgbvyqrgz.supabase.co/rest/v1"
HEADERS = {
    "apikey": "sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR",
    "Authorization": "Bearer sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR"
}

for table in ['customers', 'orders', 'products', 'care_logs']:
    resp = requests.get(f"{URL}/{table}?limit=1", headers=HEADERS)
    print(f"--- {table} ---")
    print(resp.text)
