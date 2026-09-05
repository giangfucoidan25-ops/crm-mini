import json
import datetime
import sys
import os

db_path = r'database.json'

# Step 1: Read and store initial exported_at
with open(db_path, 'r', encoding='utf-8') as f:
    db = json.load(f)

initial_exported_at = db.get('exported_at')

# Promo configs
promo_configs = {
    'nutri_nano': [
        { "price": 630000, "buy": 1, "get": 0 },
        { "price": 1260000, "buy": 2, "get": 0 },
        { "price": 1890000, "buy": 3, "get": 1 },
        { "price": 2520000, "buy": 4, "get": 2 },
        { "price": 3150000, "buy": 5, "get": 2 },
        { "price": 3780000, "buy": 6, "get": 3 },
        { "price": 4410000, "buy": 7, "get": 4 },
        { "price": 5040000, "buy": 8, "get": 5 },
        { "price": 7560000, "buy": 12, "get": 8 }
    ]
}

# Create dictionaries for products
products_dict = {p['id']: p for p in db.get('products', [])}

updated_orders = 0

for order in db.get('orders', []):
    if '2026-07' in order.get('order_date', '') or '2024-07' in order.get('order_date', ''):
        main_product_id = order.get('product_id')
        main_product = products_dict.get(main_product_id)
        if not main_product:
            continue
            
        total_amount = order.get('total_amount', 0)
        
        # Determine buy and get
        buy = 0
        get = 0
        unit_price = main_product.get('price', 0)
        
        if main_product_id == 1: # Nutri Nano
            for promo in promo_configs['nutri_nano']:
                if promo['price'] == total_amount:
                    buy = promo['buy']
                    get = promo['get']
                    break
            if buy == 0 and unit_price > 0:
                buy = total_amount // unit_price
        else:
            if unit_price > 0:
                buy = total_amount // unit_price
        
        # Reconstruct items array
        old_items = order.get('items', [])
        new_items = []
        
        # Keep other products
        for item in old_items:
            if item.get('product_id') != main_product_id:
                new_items.append(item)
                
        # Add main product buy
        if buy > 0:
            new_items.append({
                "product_id": main_product_id,
                "product_name": main_product.get('product_name'),
                "quantity": buy,
                "unit_price": unit_price,
                "is_gift": False
            })
            
        # Add main product gift
        if get > 0:
            new_items.append({
                "product_id": main_product_id,
                "product_name": main_product.get('product_name'),
                "quantity": get,
                "unit_price": 0,
                "is_gift": True
            })
            
        order['items'] = new_items
        
        # Update top level quantity
        order['quantity'] = buy + get
        
        # Update estimated_product_end_date
        order_date_str = order.get('order_date')
        if order_date_str:
            d = datetime.datetime.strptime(order_date_str, '%Y-%m-%d')
            cycle = main_product.get('usage_cycle_days', 30)
            end_date = d + datetime.timedelta(days=(buy + get) * cycle)
            order['estimated_product_end_date'] = end_date.strftime('%Y-%m-%d')
            
        updated_orders += 1

print(f"Fixed {updated_orders} July orders.")

# Sync stats
sys.path.append(os.getcwd())
try:
    from sync_stats import sync_all_stats
    sync_all_stats(db)
    print("Synced stats.")
except Exception as e:
    print(f"Could not sync stats: {e}")

# Check concurrency before save
with open(db_path, 'r', encoding='utf-8') as f:
    current_db = json.load(f)

if current_db.get('exported_at') != initial_exported_at:
    print("LỖI NGHIÊM TRỌNG: Dữ liệu đã thay đổi trên Web, vui lòng chạy lại script")
    sys.exit(1)

# Update exported_at
now_iso = datetime.datetime.utcnow().isoformat() + "Z"
db['exported_at'] = now_iso
if 'settings' in db:
    if isinstance(db['settings'], list):
        for s in db['settings']:
            if s.get('key') == 'last_sync_timestamp':
                s['value'] = now_iso
                break
    elif isinstance(db['settings'], dict):
        db['settings']['last_sync_timestamp'] = now_iso

with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print("Saved successfully.")
