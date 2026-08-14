import json
import datetime

with open(r'g:\My Drive\Marketing team\crm-mini\database.json', encoding='utf-8') as f:
    data = json.load(f)

# Hardcoded default configs as fallback
promo_configs = {
    'ancan': [
        { "price": 1250000, "buy": 1, "get": 0 },
        { "price": 3750000, "buy": 3, "get": 1 },
        { "price": 7500000, "buy": 6, "get": 3 },
        { "price": 12500000, "buy": 10, "get": 6 },
        { "price": 18750000, "buy": 15, "get": 10 },
        { "price": 25000000, "buy": 20, "get": 12 } # inferred just in case
    ],
    'fu8': [
        { "price": 2680000, "buy": 1, "get": 0 },
        { "price": 8040000, "buy": 3, "get": 1 },
        { "price": 13400000, "buy": 5, "get": 3 },
        { "price": 21440000, "buy": 8, "get": 6 },
        { "price": 26800000, "buy": 10, "get": 8 }
    ],
    'fucoidan_nano': [
        { "price": 9600000, "buy": 1, "get": 0 },
        { "price": 19200000, "buy": 2, "get": 1 },
        { "price": 28800000, "buy": 3, "get": 3 },
        { "price": 48000000, "buy": 5, "get": 6 },
        { "price": 96000000, "buy": 10, "get": 14 }
    ],
    'nutri_nano': [
        { "price": 630000, "buy": 1, "get": 0 },
        { "price": 1890000, "buy": 3, "get": 1 },
        { "price": 2520000, "buy": 4, "get": 2 },
        { "price": 3780000, "buy": 6, "get": 3 },
        { "price": 4410000, "buy": 7, "get": 4 },
        { "price": 5040000, "buy": 8, "get": 5 },
        { "price": 7560000, "buy": 12, "get": 8 },
        { "price": 8190000, "buy": 13, "get": 9 },
        { "price": 11340000, "buy": 18, "get": 14 },
        { "price": 18900000, "buy": 30, "get": 24 },
        { "price": 37800000, "buy": 60, "get": 60 },
        { "price": 56700000, "buy": 90, "get": 96 },
        { "price": 75600000, "buy": 120, "get": 130 }
    ]
}

# Add old variations of prices that I saw in research
promo_configs['nutri_nano'].extend([
    { "price": 620000, "buy": 1, "get": 0 },
    { "price": 1260000, "buy": 2, "get": 0 },
    { "price": 2480000, "buy": 4, "get": 2 },
    { "price": 3720000, "buy": 6, "get": 3 },
    { "price": 4340000, "buy": 7, "get": 4 },
    { "price": 7440000, "buy": 12, "get": 8 }
])

# Attempt to load from settings if exists
settings_promo = None
for s in data.get('settings', []):
    if s.get('id') == 'promotions_config':
        settings_promo = s.get('value')
        break

if settings_promo:
    # merge it
    for k, v in settings_promo.items():
        if k in promo_configs:
            for item in v:
                if not any(x['price'] == item['price'] for x in promo_configs[k]):
                    promo_configs[k].append(item)

# Build map: (product_base_name, total_amount) -> quantity
qty_map = {}
def add_to_qty_map(product_key, base_names):
    for item in promo_configs.get(product_key, []):
        qty = item['buy'] + item['get']
        for bn in base_names:
            qty_map[(bn, item['price'])] = qty

add_to_qty_map('ancan', ['Ancan'])
add_to_qty_map('fu8', ['Fu 8', 'Fu8'])
add_to_qty_map('fucoidan_nano', ['Fucoidan Nano', 'Fucoidan Nano 4500'])
add_to_qty_map('nutri_nano', ['Nutri Nano Fucoidan', 'Nutri Nano'])

cycle_map = {}
id_map = {}
for p in data['products']:
    cycle_map[p['product_name']] = p.get('usage_cycle_days', 30)
    id_map[p['product_name']] = p['id']

# Group orders by customer
customer_orders = {}
for o in data['orders']:
    # if it's imported from Excel or manually added, let's fix it
    
    # Identify product base name
    pname = o.get('product_name', '')
    base_name = pname
    for bn in ['Ancan', 'Nutri Nano Fucoidan', 'Fucoidan Nano 4500', 'Fu 8', 'Fucoidan Nano']:
        if bn in pname:
            base_name = bn
            break
            
    amt = o.get('total_amount', 0)
    
    qty = qty_map.get((base_name, amt))
    if qty is None and amt > 0:
        # Fallback division
        if 'Nutri' in base_name:
            if amt % 630000 == 0:
                qty = amt // 630000
            elif amt % 620000 == 0:
                qty = amt // 620000
        elif 'Ancan' in base_name:
            qty = amt // 1250000
        elif 'Fu 8' in base_name:
            qty = amt // 2680000
    
    if qty is None or qty == 0:
        qty = 1 # absolute fallback
        
    # Apply
    o['quantity'] = qty
    
    # Fix product ID based on name mapping
    # Just grab the exact match if we can
    for p_name in id_map:
        if p_name in o['product_name']:
            o['product_id'] = id_map[p_name]
            break
            
    # Calculate end date
    # Get cycle
    cycle = 30
    for p_name in cycle_map:
        if p_name in o['product_name']:
            cycle = cycle_map[p_name]
            break
            
    if o.get('order_date'):
        d = datetime.datetime.strptime(o['order_date'], '%Y-%m-%d')
        end_date = d + datetime.timedelta(days=qty * cycle)
        o['estimated_product_end_date'] = end_date.strftime('%Y-%m-%d')
    
    cid = o['customer_id']
    if cid not in customer_orders:
        customer_orders[cid] = []
    customer_orders[cid].append(o)

# Update customers product expiries
for c in data['customers']:
    cid = c['id']
    if cid in customer_orders:
        sorted_orders = sorted(customer_orders[cid], key=lambda x: x['order_date'], reverse=True)
        product_expiries = {}
        for o in sorted_orders:
            bn = o.get('product_name', '').split('-')[0].strip()
            if bn and bn not in product_expiries:
                product_expiries[bn] = o.get('estimated_product_end_date')
                
        c['product_expiries'] = product_expiries
        if sorted_orders[0].get('estimated_product_end_date'):
            c['estimated_product_end_date'] = sorted_orders[0].get('estimated_product_end_date')

now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)
data['exported_at'] = now.isoformat().replace('+00:00', 'Z')

with open(r'g:\My Drive\Marketing team\crm-mini\database.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Mass update completed successfully.")
