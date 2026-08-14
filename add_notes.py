import sys, json, datetime
sys.stdout.reconfigure(encoding='utf-8')

with open('database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

c = next((x for x in db.get('customers', []) if 'Cao Thanh Nghi' in x['full_name']), None)

# First remove previously added logs for this customer that start with exactly those dates
care_logs = db.get('care_logs', [])
old_len = len(care_logs)

logs_to_add = [
    {'date': '2026-06-02', 'time': '16:45', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Vào hóa trị rồi vào sinh học 3-4 lần. Cô bị tác dụng phụ dùng ít, ko được 3 muỗng uống tí thôi. Vẫn còn 3-4 hộp. Đã tư vấn lại chú'},
    {'date': '2026-04-09', 'time': '14:47', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'CNM'},
    {'date': '2026-03-27', 'time': '15:58', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'CNM'},
    {'date': '2026-01-11', 'time': '17:29', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Ưu đãi giờ thế nào. Cô sk cũng ổn ổn rồi. Nhưng ăn kém do tác dụng phụ, ngủ thì vẫn được. Đang dùng thuốc sinh học duy trì. Đã được 4 lần còn 8 lần. Đã tư vấn lại chú, chú lấy 7t4'},
    {'date': '2026-01-11', 'time': '17:27', 'user': 'Bùi Tuấn', 'type': 'Trao đổi', 'note': 'kh để tt nutri\n@Hà Giang Fucoidan'},
    {'date': '2025-09-04', 'time': '21:04', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Cô vẫn dùng đang xạ trị, dùng kết hợp với lọ fucoidan màu xanh của Nhật. Chia sẻ với chú thông tin Fu8, gửi thông tin sp quy cách mới và Fu 8 qua zalo cho chú'},
    {'date': '2025-08-10', 'time': '15:24', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Cô vẫn dùng đều ngày 3 cốc, còn 2 hộp. Khi nào hết chú nhắn'},
    {'date': '2025-08-01', 'time': '22:19', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'CNM'},
    {'date': '2025-07-18', 'time': '15:05', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'Cô đang xạ trị lần 4, sức khỏe tốt hơn, ngày dùng 3 lần, còn 1 hộp. Gần hết chú báo.'},
    {'date': '2025-06-07', 'time': '11:14', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'ngày 2 lần, 2 muỗng. Hay bị nôn nên uống ko nhiều. Đang xạ trị. Còn 1/3 hộp'},
    {'date': '2025-05-17', 'time': '15:54', 'user': 'Hà Giang Fucoidan', 'type': 'Trao đổi', 'note': 'hỏi cho cô U buồng trứng. phát hiện mấy tháng, đang xạ trị. Ăn uống kém. Chú dùng thử nếu hợp sẽ dùng lâu dài'},
    {'date': '2025-05-17', 'time': '15:30', 'user': 'Lương Văn Cường', 'type': 'Trao đổi', 'note': 'Tạo mới khách hàng'}
]

# Wipe old logs for customer
care_logs = [l for l in care_logs if l.get('customer_id') != c['id']]
max_id = max([l.get('id', 0) for l in care_logs]) if care_logs else 0

for item in logs_to_add:
    max_id += 1
    # format note to include user and time so it shows nicely
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

# Update exported_at to force sync
db['exported_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

with open('database.json', 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print('Updated logs and exported_at')
