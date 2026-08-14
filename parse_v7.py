import json
import re

text = """Hà Giang Fucoidan - 18/06/2026 15:26
Chị đang bận lúc khác nhé

Hà Giang Fucoidan - 11/05/2026 10:05
Giao thành công . Đã gửi hướng dẫn sử dụng qua zalo

Hà Giang Fucoidan - 09/05/2026 13:51
Chị phổi vẫn hơi khó thở. Chị hỏi lại thông tin sản phẩm và chương trình ưu đãi. Đã gt chị chương trình ưu đãi, tư vấn chị dùng dài hạn nên lấy 13t9. Chị muốn tặng thêm 1 1 hộp đường mía. Đã tư vấn lại chị. Vậy chị mua thêm 1 hộp đường mía hà thủ ô gửi kèm cho chị

Hà Giang Fucoidan - 08/05/2026 08:47
Chị xử lý xong rồi nhưng giờ đang đi xe máy trên đường. Để lúc khác

Hà Giang Fucoidan - 07/05/2026 10:31 (Đã chỉnh sửa)
Chị tìm ko thấy số của em. Chị đặt nhầm bên khác. Đặt xong mới nhớ ra zalo Hà Giang. Đã tư vấn lại chị. Chờ chị xử lý bên kia đã

Hà Giang Fucoidan - 07/05/2026 09:51
Chị đang đi chùa lát gọi lại

Nguyễn Đoàn - 07/05/2026 09:27
kh để tt

Hà Giang Fucoidan.

Hà Giang Fucoidan - 03/04/2026 16:39 (Đã chỉnh sửa)
Ngày 2 cốc, sáng uống 1 cốc tam thất đi tập thể dục về uống thực dưỡng sau đó đói đói lại ăn 1 cái gì đó. Chiều sau ăn. Chị sau mổ đang cần phục hồi. Uống ngon. Mua trộm ông chồng, uông biết uống ông nói mua linh tinh trên mạng

Hà Giang Fucoidan - 21/03/2026 17:11
Chị chưa dùng bao giờ lấy 2t1 dùng thử thôi. Đã tư vấn lại chị. Chị lấy 6t3

Hà Giang Fucoidan - 21/03/2026 15:21
Đang đi xe máy nhé. Tối gọi lại

Hà Giang Fucoidan - 20/03/2026 15:39
Bác Hà đi có việc rồi ạ. Lát chú gọi lại

Hà Giang Fucoidan - 19/03/2026 14:07
chị 56 tuổi, ung thư phổi, bị mổ 3 tháng, cắt bỏ. Bs bảo truyền hóa chất hỗ trợ chị sợ yếu ko truyền. Về nhà uống lá linh tinh hoa đu đủ. Ăn được, ngủ kém. Không ăn nhiều. Chị Ăn chay. Gửi thông tin zalo chị tìm hiểu thêm

Hà Giang Fucoidan - 19/03/2026 13:35
Đúng rồi nhưng cô đang bận. 1 tiếng nữa gọi lại nhé

Quang Đức - 19/03/2026 12:05
a gọi kh nhé

Hà Giang Fucoidan.

Quang Đức - 19/03/2026 11:43
Tạo mới khách hàng."""

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

with open('v7.json', 'w', encoding='utf-8') as f:
    json.dump(parsed_logs, f, ensure_ascii=False, indent=2)
