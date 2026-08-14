import json
from datetime import datetime
import os

with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
    
customers = db.get('customers', [])
today = '2026-08-12'

def parse_date(d_str):
    if not d_str: return None
    try:
        return datetime.strptime(d_str[:10], '%Y-%m-%d')
    except:
        return None

today_dt = parse_date(today)

care_today = [c for c in customers if c.get('next_care_date') and c.get('next_care_date') <= today and not c.get('stopped_status')]

def get_priority_reason(c):
    reasons = []
    
    # 1. VIP
    if c.get('tags') and 'VIP' in c.get('tags'):
        reasons.append('Khách VIP')
        
    # 2. Chờ chốt
    if c.get('status') == 'waiting_close':
        reasons.append('Khách đang chờ chốt')
        
    # 3. Đã hết sản phẩm / Sắp hết sản phẩm
    if c.get('estimated_product_end_date'):
        end_date = parse_date(c['estimated_product_end_date'])
        if end_date:
            days_diff = (end_date - today_dt).days
            if days_diff < 0:
                reasons.append(f'Đã hết sản phẩm ({-days_diff} ngày)')
            elif 0 <= days_diff <= 14:
                reasons.append(f'Sắp hết sản phẩm (còn {days_diff} ngày)')
                
    # 4. Quá hạn 30 ngày
    if c.get('overdue_status'):
        next_care = parse_date(c.get('next_care_date'))
        if next_care and (today_dt - next_care).days >= 30:
            reasons.append('Quá hạn chăm sóc > 30 ngày')
            
    # 5. Doanh số cao (>10 triệu)
    if c.get('total_revenue', 0) >= 10000000:
        rev_m = c['total_revenue'] / 1000000
        reasons.append(f'Doanh số cao ({rev_m:.1f}M)')
        
    if not reasons:
        reasons.append('Đến lịch chăm sóc định kỳ')
        
    # Assign score for sorting
    score = 0
    if 'Đã hết sản phẩm' in str(reasons): score += 100
    if 'Sắp hết sản phẩm' in str(reasons): score += 90
    if 'Khách đang chờ chốt' in str(reasons): score += 80
    if 'Khách VIP' in str(reasons): score += 70
    if 'Quá hạn chăm sóc > 30 ngày' in str(reasons): score += 60
    if 'Doanh số cao' in str(reasons): score += 50
    if 'Đến lịch' in str(reasons): score += 10
    
    return ', '.join(reasons), score

prioritized = []
for c in care_today:
    reason, score = get_priority_reason(c)
    prioritized.append({'customer': c, 'reason': reason, 'score': score})

prioritized.sort(key=lambda x: x['score'], reverse=True)

md = []
md.append('# Phân Tích CRM - Danh Sách Cần Chăm Sóc Ưu Tiên\n\n')
md.append(f'**Ngày phân tích:** {today}\n')
md.append(f'**Tổng số khách hàng đến hạn/quá hạn:** {len(care_today)}\n\n')

md.append('## 1. Khách Hàng Ưu Tiên Cao Nhất (Đã/Sắp Hết Sản Phẩm)\n')
for p in [p for p in prioritized if 'hết sản phẩm' in p['reason']]:
    c = p['customer']
    name = c['full_name']
    phone = c['phone']
    reason = p['reason']
    sp = c.get('last_product_used') or 'Sản phẩm'
    md.append(f'### {name} - {phone}\n')
    md.append(f'- **Lý do:** {reason}\n')
    md.append(f'- **Hành động:** Gọi điện hoặc nhắn tin hỏi thăm tình hình sử dụng, nhắc nhở tái đặt hàng.\n')
    md.append(f'- **Mẫu Zalo:** "Dạ em chào {name}, em thấy mình dùng {sp} chắc sắp hết rồi. Dạo này sức khỏe của mình tiến triển tốt không ạ? Em gửi thêm 1 liệu trình nữa để mình dùng liên tục cho hiệu quả nha."\n\n')

md.append('## 2. Khách Đang Chờ Chốt\n')
for p in [p for p in prioritized if 'chờ chốt' in p['reason'] and 'hết sản phẩm' not in p['reason']]:
    c = p['customer']
    name = c['full_name']
    phone = c['phone']
    reason = p['reason']
    md.append(f'### {name} - {phone}\n')
    md.append(f'- **Lý do:** {reason}\n')
    md.append(f'- **Hành động:** Nhắn tin chia sẻ thêm feedback, chương trình khuyến mãi để chốt đơn.\n')
    md.append(f'- **Mẫu Zalo:** "Dạ {name} ơi, hiện tại bên em đang có ưu đãi đặc biệt. Mình còn băn khoăn gì về sản phẩm không ạ để em hỗ trợ mình nhận ưu đãi tốt nhất nhé!"\n\n')

md.append('## 3. Khách Hàng VIP & Doanh Số Cao\n')
for p in [p for p in prioritized if ('VIP' in p['reason'] or 'Doanh số cao' in p['reason']) and 'hết sản phẩm' not in p['reason'] and 'chờ chốt' not in p['reason']]:
    c = p['customer']
    name = c['full_name']
    phone = c['phone']
    reason = p['reason']
    md.append(f'### {name} - {phone}\n')
    md.append(f'- **Lý do:** {reason}\n')
    md.append(f'- **Hành động:** Chăm sóc ân cần, cá nhân hóa. Tặng quà tri ân hoặc hỏi thăm sức khỏe định kỳ.\n')
    md.append(f'- **Mẫu Zalo:** "Dạ em chào {name}, dạo này sức khỏe gia đình mình thế nào ạ? Công ty em luôn trân trọng và biết ơn sự tin tưởng của mình thời gian qua."\n\n')

md.append('## 4. Khách Quá Hạn Chăm Sóc (> 30 ngày)\n')
for p in [p for p in prioritized if 'Quá hạn' in p['reason'] and 'hết sản phẩm' not in p['reason'] and 'chờ chốt' not in p['reason'] and 'VIP' not in p['reason'] and 'Doanh số cao' not in p['reason']]:
    c = p['customer']
    name = c['full_name']
    phone = c['phone']
    reason = p['reason']
    md.append(f'### {name} - {phone}\n')
    md.append(f'- **Lý do:** {reason}\n')
    md.append(f'- **Hành động:** Gửi tin nhắn khơi gợi lại sự tương tác nhẹ nhàng.\n')
    md.append(f'- **Mẫu Zalo:** "Dạ chào {name}, em là chuyên viên tư vấn trước đây có hỗ trợ mình. Hôm nay em nhắn tin hỏi thăm chút xem tình hình sức khỏe mình hiện tại đã tốt hơn chưa ạ?"\n\n')

artifact_path = r'C:\Users\PC\.gemini\antigravity-ide\brain\d6b94d9b-1919-4a68-a5e9-1eac41bd4e34\crm_analysis.md'
with open(artifact_path, 'w', encoding='utf-8') as f:
    f.write(''.join(md))

print(f'Report generated at {artifact_path}')
