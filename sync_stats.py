import re
from datetime import datetime, timedelta

def add_days(date_str, days):
    if not date_str: return None
    try:
        dt = datetime.strptime(str(date_str)[:10], "%Y-%m-%d")
        return (dt + timedelta(days=days)).strftime("%Y-%m-%d")
    except Exception:
        return None

def get_next_care_milestone(last_order_date, last_contact_date, care_config):
    if not last_order_date:
        return None
        
    m1 = care_config.get('m1', 1)
    m2 = care_config.get('m2', 7)
    m3 = care_config.get('m3', 22)
    cycle = care_config.get('cycle', 30)
        
    last_order_date = str(last_order_date)[:10]
    t1 = add_days(last_order_date, m1)
    t2 = add_days(last_order_date, m2)
    t3 = add_days(last_order_date, m3)
    
    last_c = str(last_contact_date)[:10] if last_contact_date else ""
    order_d = last_order_date
    
    def is_achieved(target_date):
        if not target_date: return False
        if not last_c: return False
        if last_c <= order_d and target_date > order_d: return False
        window_start = add_days(target_date, -3)
        return last_c >= window_start
        
    if not is_achieved(t1): return t1
    if not is_achieved(t2): return t2
    if not is_achieved(t3): return t3
    
    target = add_days(t3, cycle)
    k = 1
    while is_achieved(target) and k < 100:
        k += 1
        target = add_days(t3, k * cycle)
        
    return target

def sync_customer_stats(customer_id, db):
    orders = [o for o in db.get('orders', []) if o.get('customer_id') == customer_id]
    
    def order_sort_key(o):
        return (o.get('order_date', ''), o.get('id', 0))
    
    valid_orders = sorted([o for o in orders if o.get('order_status') != 'cancelled'], key=order_sort_key, reverse=True)
    
    total_orders = len(orders)
    total_revenue = sum(o.get('total_amount', 0) for o in orders if o.get('order_status') == 'completed')
    
    last_order_date = None
    last_product_used = None
    estimated_product_end_date = None
    product_expiries = {}
    last_completed_order_date = None
    
    if valid_orders:
        last_order_date = valid_orders[0].get('order_date')
        last_product_used = valid_orders[0].get('product_name')
        estimated_product_end_date = valid_orders[0].get('estimated_product_end_date')
        
        for o in valid_orders:
            end_date = o.get('estimated_product_end_date')
            p_name = o.get('product_name')
            if end_date and p_name:
                base_name = p_name.split('-')[0].strip()
                if base_name not in product_expiries:
                    product_expiries[base_name] = end_date
                    
    completed_orders = [o for o in valid_orders if o.get('order_status') == 'completed']
    if completed_orders:
        last_completed_order_date = completed_orders[0].get('order_date')
        
    # Get customer
    customer = next((c for c in db.get('customers', []) if c.get('id') == customer_id), None)
    if not customer:
        return
        
    new_status = customer.get('status', 'new')
    completed_count = len(completed_orders)
    if completed_count >= 2:
        if new_status in ['new', 'contacted', 'consulting', 'waiting_close', 'purchased', '']:
            new_status = 'repurchased'
    elif completed_count == 1:
        if new_status in ['new', 'contacted', 'consulting', 'waiting_close', 'repurchased', '']:
            new_status = 'purchased'
    elif completed_count == 0:
        if new_status in ['purchased', 'repurchased']:
            new_status = 'waiting_close'
            
    care_logs = [log for log in db.get('care_logs', []) if log.get('customer_id') == customer_id]
    max_contact_date = last_order_date
    for log in care_logs:
        note = log.get('note', '')
        if re.search(r'\b(cnm|knm|chưa nghe máy|không nghe máy)\b', note, re.IGNORECASE):
            continue
        d = log.get('care_date') or str(log.get('created_at', ''))[:10]
        if d and (not max_contact_date or d > max_contact_date):
            max_contact_date = d
            
    last_contact_date = max_contact_date
    
    # Care config
    settings = db.get('settings', [])
    def get_setting(key, default_val):
        s = next((x for x in settings if x.get('key') == key), None)
        if s is not None and s.get('value') is not None:
            try: return int(s.get('value'))
            except: return default_val
        return default_val
        
    care_config = {
        'm1': get_setting('care_milestone_1', 1),
        'm2': get_setting('care_milestone_2', 7),
        'm3': get_setting('care_milestone_3', 22),
        'cycle': get_setting('care_cycle_days', 30)
    }
    
    next_care_date = None
    if last_completed_order_date:
        next_care_date = get_next_care_milestone(last_completed_order_date, last_contact_date, care_config)
        if not next_care_date:
            next_care_date = add_days(last_completed_order_date, care_config['cycle'])
    else:
        # No completed order, use unpurchased cycle (7 days from last contact)
        if last_contact_date:
            next_care_date = add_days(last_contact_date, 7)
            
    overdue_status = False
    today_str = datetime.now().strftime("%Y-%m-%d")
    if next_care_date and next_care_date < today_str:
        overdue_status = True

    final_end_date = estimated_product_end_date
    if customer.get('estimated_product_end_date') and estimated_product_end_date:
        if customer['estimated_product_end_date'] > estimated_product_end_date:
            final_end_date = customer['estimated_product_end_date']
    elif not valid_orders:
        final_end_date = None

    update_data = {
        'total_orders': total_orders,
        'total_revenue': total_revenue,
        'last_order_date': last_order_date,
        'last_product_used': last_product_used,
        'estimated_product_end_date': final_end_date,
        'product_expiries': product_expiries if product_expiries else None,
        'last_completed_order_date': last_completed_order_date,
        'status': new_status,
        'last_contact_date': max_contact_date
    }

    customer.update(update_data)
        
    customer['next_care_date'] = next_care_date
    customer['overdue_status'] = overdue_status
    
    # If customer has a STOPPED intent, they are not overdue
    if customer.get('keyword_category') == 'STOPPED' or customer.get('stopped_status') == True:
        customer['overdue_status'] = False

def sync_all_stats(db):
    print("⏳ Running Sync All Stats for Customers...")
    customers = db.get('customers', [])
    for c in customers:
        sync_customer_stats(c['id'], db)
    print("✅ Sync All Stats Completed.")
