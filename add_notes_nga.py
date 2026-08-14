import sys, json, datetime

sys.stdout.reconfigure(encoding='utf-8')

with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

c = next((x for x in db.get('customers', []) if '0362386874' in x.get('phone', '')), None)

if not c:
    print("Customer not found!")
    sys.exit(1)

care_logs = db.get('care_logs', [])

logs_to_add = [
    {'date': '2026-06-24', 'time': '12:00', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Hè sợ để lâu nó hỏng. Đã tư vấn lại cô. Cô lấy 6t3 + 1 đông trùng'},
    {'date': '2026-05-23', 'time': '10:56', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Máy bận'},
    {'date': '2026-04-07', 'time': '17:56', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Combo 4 hộp có tặng gì ko? Đã tư vấn lại chị, chị lấy 6t3'},
    {'date': '2026-03-27', 'time': '15:32', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Anh dùng còn 2 hộp. Hết chị đặt. Chị đang có khách'},
    {'date': '2026-01-21', 'time': '17:12', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Anh sức khỏe tốt, ngủ tốt, ăn tốt. Sang tháng 2 kiểm tra lại. Đã truyền 4 mũi. Uống thay ăn buổi sáng, chiều uống 2 giờ. Anh chịu khó thể dục. Sáng tôi uống chanh muối, nhưng anh không tin, nhưng tôi xay lá mơ tôi pha chanh muối gừng, ngày 2 quả dừa. Đã tư vấn lại chị. Gửi thêm thông tin hỗ trợ qua zalo cho chị'},
    {'date': '2025-12-16', 'time': '15:46', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Anh đã đi hóa trị về rồi. Tôi đang bận. Lúc khác gọi lại'},
    {'date': '2025-12-08', 'time': '16:14', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Anh dùng được. Ngày 2 cốc bữa sáng không ăn sáng. và giữa chiều ngủ dậy. Sk anh bình thường, mai đi hóa trị mũi 4.'},
    {'date': '2025-11-27', 'time': '17:22', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Anh từ hôm đi truyền về khỏi. Đang vui vẻ thì nghe nói thuốc chữa ung thư của Nga không dành cho người giai đoạn 1 là dỗi. Tư vấn chị lấy 4t2 đủ liệu trình. Chị đang có khách tí gọi lại'},
    {'date': '2025-11-19', 'time': '14:08', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Chị đang có khách nhé'},
    {'date': '2025-11-18', 'time': '15:27', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Chị hỏi Anh 65 tuổi, bị ung thư phổi giai đoạn 1, truyền 3 đợt rồi, 1 đợt tháng sau xong. Anh khỏe, ăn uống tốt. Chị đang dùng 4 hộp thực dưỡng fucoidan. Anh hút thuốc lào 50 năm. Chị cho anh dùng nước dừa, chanh gừng, muối. Chị không tin tây y, xác định sau đợt này cho anh dùng thuốc Nam. Đã gt chị nutri và Fu8. Gửi thông tin zalo cho chị, anh về chị nhắn'},
    {'date': '2025-11-18', 'time': '15:27', 'user': 'Khắc Nam', 'type': 'Trao đổi', 'note': 'a gọi khách hộ e'},
    {'date': '2025-11-18', 'time': '14:47', 'user': 'Khắc Nam', 'type': 'Trao đổi', 'note': 'Tạo mới khách hàng'}
]

# Wipe old logs for customer
care_logs = [l for l in care_logs if l.get('customer_id') != c['id']]
max_id = max([l.get('id', 0) for l in care_logs]) if care_logs else 0

for item in logs_to_add:
    max_id += 1
    full_note = f"[{item['time']}] {item['user']}: {item['note']}"
    care_logs.append({
        'id': max_id,
        'customer_id': c['id'],
        'care_date': item['date'],
        'care_type': item['type'],
        'note': full_note,
        'created_at': f"{item['date']}T{item['time']}:00.000Z"
    })

db['care_logs'] = care_logs

# Update last_contact_date if missing
c['last_contact_date'] = '2026-06-24'

db['exported_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

with open('database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print(f"Added {len(logs_to_add)} logs to customer ID {c['id']}")
