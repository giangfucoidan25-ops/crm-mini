import json
import re

text = """Hà Giang Fucoidan - 25/06/2026 16:40
dùng 3 tuần dùng ngày 4/viên, sau đó dùng ngày 6 viên. Chị dùng sau ăn 1 tiếng. ngủ đến 3 giờ sáng thức giấc. Nóng người. Đã tư vấn lại chị

Hà Giang Fucoidan - 22/06/2026 10:15
CNm

Hà Giang Fucoidan - 17/06/2026 16:43
CNM

Hà Giang Fucoidan - 11/06/2026 09:04
Chị đang uống sữa non thực vật. Chị muốn dùng bổ sung thêm. Chăm sóc cơ thể. Chắc có chăm thì nó cũng tốt hơn. Tiền thiếu thì nhờ con cái. Gửi combo cho chị chọn

Nguyễn Đoàn - 11/06/2026 08:56
kh để tt nutri a nhé

Hà Giang Fucoidan.

Hà Giang Fucoidan - 08/06/2026 09:38
Chị thấy sp funano chị tham khảo. Chị vẫn đi hơi nhão. Đã tư vấn lại chị. Gửi thông tin funano cho chị qua zalo

Nguyễn Đoàn - 08/06/2026 09:30
kh để tt fucoidan

Hà Giang Fucoidan.

Hà Giang Fucoidan - 30/05/2026 12:44
Chị làm giáo viên. U tuyến giáp lành tính. Ko mổ. Trc có dùng 1 đợt thuốc sau ko dùng nữa. Sk bình thường. Thi thoảng đau họng. Đã tư vấn chị fu8 và ancan. Chị chọn fu8.

Hà Giang Fucoidan - 30/05/2026 12:12
Cnm

Nguyễn Đoàn - 30/05/2026 12:09
kh để tt

Hà Giang Fucoidan.

Hà Giang Fucoidan - 17/11/2025 20:45
CNM

Hà Giang Fucoidan - 14/11/2025 20:23
CNM

Hà Giang Fucoidan - 13/11/2025 16:26
CNM

Hà Giang Fucoidan - 13/11/2025 11:15
CNM

Hà Giang Fucoidan - 13/11/2025 08:55
CNM

Nguyễn Đoàn - 13/11/2025 08:49
ancan Anh nhé

Nguyễn Đoàn - 13/11/2025 08:48
kh để tt

Hà Giang Fucoidan.

Hà Giang Fucoidan - 11/11/2025 20:35
cnm

Hà Giang Fucoidan - 09/11/2025 09:24
CNM

Hà Giang Fucoidan - 08/11/2025 20:47
CNM

Hà Giang Fucoidan - 08/11/2025 16:00
CNM

Hà Nguyệt - 08/11/2025 15:42
KH để lại tt

Hà Giang Fucoidan.

Hà Giang Fucoidan - 08/11/2025 11:06
Cô nghi K giáp mấy năm nay nhưng không mổ, chọn dùng dinh dưỡng, thuốc nam thay đổi chế độ ăn uống tập luyện duy trì sk. Có Bsi bị K giáp cũng ko mổ nên cô làm theo. Giới thiệu cô Fu8 nâng cấp. Gửi thông tin zalo cho cô

Lường Văn Cường - 08/11/2025 10:42
khách để lai tt nhé a @

Hà Giang Fucoidan.

Hà Giang Fucoidan - 06/12/2024 16:44
Có địa chỉ rồi thì triển thôi a nhỉ

Nguyễn Đoàn - 06/12/2024 16:40
Mạnh dạn gửi Cô đơn 49tr

Hà Giang Fucoidan - 06/12/2024 16:39
Cô bị k giáp, hàm lượng fucoinano như các cháu nói có chuẩn ko vì em cô cũng làm trong nghành này, gửi thêm thông tin qua zalo cho cô

Hà Giang Fucoidan - 06/12/2024 11:49
Ok a

Nguyễn Đoàn - 06/12/2024 11:41 (Đã chỉnh sửa)
kh để lại tt nutri nano e nhé

Nguyễn Quyết.

Nguyễn Đoàn - 06/12/2024 11:41
Bn 1 hộp

Hà Giang Fucoidan - 02/12/2024 08:21
Không nghe máy

Nguyễn Đoàn - 02/12/2024 08:08 (Đã chỉnh sửa)
kh để lại tt nutri nano em nhé

Nguyễn Quyết.

Trần Minh Tuấn - 22/10/2021 15:12
cnm

Trần Thị Liên - 12/08/2021 09:59
knm. nhắn zalo k trả lời

Trần Thị Liên - 05/08/2021 10:52
knm

Trần Thị Liên - 27/05/2021 11:13 (Đã chỉnh sửa)
knm

Trần Thị Liên - 08/05/2021 10:45
knm

Trần Thị Liên - 16/04/2021 16:21
knm

Nguyễn Huệ Chi - 13/04/2021 18:50 (Đã chỉnh sửa)
chị tư vấn thêm Ancan lúc 4 5h chiều nhé

Liên Nutriancan.

Trần Thị Liên - 22/03/2021 14:51
máy bận

Phạm Tố Uyên - 22/03/2021 14:44 (Đã chỉnh sửa)
e gọi lại cho khách nhé, khách đê lại số trên zalo

Liên Nutriancan.

Trần Thị Liên - 20/03/2021 09:52
k tuyến giáp. phát hiện 4 tháng kt 1 bên 0,44cm x 0,36cm 1 bên 0,36 x 0,91 đang uống thuốc nam.alphalipid. thấy kt u cũng giảm nhiều. chị lấy trước nutriancan. còn viên uống ancan thì từ từ c tìm hiểu thêm

Phạm Tố Uyên - 19/03/2021 20:41
Tạo mới khách hàng sắp xếp những ghi trú trên theo trình tự thời gian từ trên xuống. Trên là thời gian gần nhất.  Bỏ những nội dung GhimThíchTrả lời"""

logs = re.split(r'\n(?=[A-ZÀ-Ỹa-zà-ỹ\s]+ - \d{2}/\d{2}/\d{4})', text)

parsed_logs = []
for log in logs:
    log = log.strip()
    if not log: continue
    if 'Bỏ những nội dung GhimThíchTrả lời' in log:
        continue
    match = re.search(r'^([A-ZÀ-Ỹa-zà-ỹ\s]+) - (\d{2})/(\d{2})/(\d{4})', log)
    if match:
        author = match.group(1).strip()
        day = match.group(2)
        month = match.group(3)
        year = match.group(4)
        date = f"{year}-{month}-{day}"
        parsed_logs.append({
            "date": date,
            "note": log
        })

with open('v3.json', 'w', encoding='utf-8') as f:
    json.dump(parsed_logs, f, ensure_ascii=False, indent=2)

js_content = '''                    const hhExcelFixedV5 = localStorage.getItem('hh_excel_fixed_v5');
                    if (!hhExcelFixedV5) {
                        let hhCustomer = await DB.db.customers.where('phone').equals('0984757580').first();
                        if (hhCustomer) {
                            const logs = await DB.db.care_logs.where('customer_id').equals(hhCustomer.id).toArray();
                            for (let log of logs) { await DB.db.care_logs.delete(log.id); }
                            const newLogs = ''' + json.dumps(parsed_logs, ensure_ascii=False, indent=4) + ''';
                            for (let item of newLogs) {
                                await DB.db.care_logs.add({
                                    customer_id: hhCustomer.id,
                                    care_date: item.date,
                                    care_type: "Khác",
                                    note: item.note,
                                    created_at: new Date().toISOString()
                                });
                            }
                        }
                        localStorage.setItem('hh_excel_fixed_v5', 'done');
                        console.log('Fixed Hương Hoàng logs directly (V5)');
                    }'''

with open('v4_block.js', 'w', encoding='utf-8') as f:
    f.write(js_content)


