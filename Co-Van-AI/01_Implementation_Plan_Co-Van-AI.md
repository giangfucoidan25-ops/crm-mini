# Kế Hoạch Triển Khai: Tính năng "Cố vấn AI" (Ngành TPCN)

Tính năng "Cố vấn AI" đóng vai trò là Giám đốc kinh doanh TPCN 16 năm kinh nghiệm, phân tích tổng thể các chỉ số theo bộ lọc thời gian và đưa ra đề xuất chiến lược động (Dynamic Suggestions).

**Model sử dụng:** Claude Opus 4.6 & Gemini Pro

---

## 1. Luồng hoạt động (User Flow & Technical Flow)

### 1.1 UI/UX Flow (Giải pháp Hybrid)
1. Trên giao diện Dashboard biểu đồ, xuất hiện **1 nút duy nhất** nổi bật ở góc trên (VD: "✨ Cố vấn AI").
2. User thao tác chọn **Bộ lọc thời gian** (VD: 1 tuần trước). Biểu đồ load xong data của 1 tuần.
3. User click nút "✨ Cố vấn AI".
4. UI hiển thị trạng thái Loading (Skeleton loader hoặc hiệu ứng lấp lánh "AI đang phân tích chiến lược tuần qua...").
5. Mở ra một **Side-panel (trượt từ phải sang)**.
6. Nội dung hiển thị bao gồm: 
   - Bài tư vấn tổng quan (chia theo đoạn, dùng icon, in đậm dễ nhìn).
   - Dưới cùng là 3 **Nút gợi ý (Dynamic Chips)** được AI tự động sinh ra dựa trên chính dữ liệu khoảng thời gian đó để user click hỏi tiếp.

### 1.2 Technical Flow
1. **Frontend Gom Data:** Trích xuất các số liệu tổng quan trên biểu đồ trong khoảng thời gian đã lọc, đóng gói thành 1 chuỗi JSON (Payload) thật gọn nhẹ. 
2. **Backend Nối Prompt:** Backend nhận Payload, ghép với **System Prompt** (mặc định), và truyền thêm biến `time_range` (khoảng thời gian) rồi gửi cho AI API. Lệnh bắt buộc AI trả về định dạng chuẩn JSON.
3. **AI Xử lý:** Trả về kết quả chuỗi JSON gồm 2 trường: `consulting_text` và `suggested_questions`.
4. **Frontend Render:** Đọc JSON, in trường `consulting_text` ra màn hình, và vẽ 3 nút bấm từ mảng `suggested_questions`.

---

## 2. Cấu Trúc Dữ Liệu Chuyển Giao (Data Contract)

### Dữ liệu Frontend gửi Backend (Input Payload mẫu)
```json
{
  "time_range": "01/10/2026 - 07/10/2026 (1 Tuần)",
  "metrics": {
    "revenue": "500,000,000 VND",
    "revenue_growth": "-5%",
    "traffic": 15000,
    "traffic_growth": "+10%",
    "conversion_rate": "1.2%",
    "conversion_growth": "-2%",
    "returning_customer_rate": "10%"
  },
  "top_products": [
    {"name": "Collagen X3", "sales": 150, "trend": "up"},
    {"name": "Trà giảm cân Xanh", "sales": 20, "trend": "down_severely"}
  ]
}
```

### Dữ liệu AI trả về Frontend (Expected JSON Output)
```json
{
  "consulting_text": "### 📊 Đánh giá chiến lược tuần qua (01/10 - 07/10)...\n\n1. **Vấn đề cốt lõi:** Lượng truy cập tăng nhưng tỷ lệ chốt đơn giảm mạnh, chứng tỏ kịch bản telesale đang có vấn đề hoặc khách mang tâm lý 'tham khảo'...\n\n2. **Giải pháp thực thi ngay:**\n- Up-sale liệu trình 3 tháng với quà tặng mồi...\n...",
  "suggested_questions": [
    "Tạo kịch bản Telesale xử lý từ chối cho khách chê giá đắt",
    "Gợi ý chương trình KM đẩy tồn kho Trà giảm cân",
    "Làm sao tăng tỷ lệ khách cũ mua lại Collagen X3?"
  ]
}
```

---

## 3. System Prompt (Nhúng tại Backend)

Đây là đoạn Prompt "Đẳng cấp chuyên gia TPCN", Dev nhét vào biến `system_message`.

```text
Bạn là một Giám đốc Kinh doanh và Chuyên gia Sales Thực Phẩm Chức Năng (TPCN) với 16 năm kinh nghiệm thực chiến. Bạn am hiểu sâu sắc tâm lý khách hàng ngành TPCN: cần xây dựng niềm tin dài hạn, cực kỳ nhạy cảm về giá, cần liệu trình dài ngày để thấy hiệu quả, và đặc tính quản lý sản phẩm có hạn sử dụng (date).

Nhiệm vụ của bạn là phân tích số liệu kinh doanh trong khoảng thời gian [TIME_RANGE] và đưa ra tư vấn chiến lược nhằm thúc đẩy doanh số. 

Dữ liệu đầu vào:
[METRICS_JSON]

Hãy tuân thủ các nguyên tắc tư vấn sau:
1. Đọc bao quát bức tranh (Holistic): Không chỉ nhìn 1 số. Phải liên kết Traffic, Tỷ lệ chuyển đổi (CR) và Tỷ lệ khách cũ (Retention) để bắt đúng "bệnh".
2. Khuyến nghị mang tính thực chiến ngành TPCN: Đừng khuyên chung chung. Hãy nói về chiến thuật up-sale (bán chéo/combo liệu trình 3-6 tháng), xử lý hàng cận date, chiến lược tặng sample dùng thử, kịch bản telesale bám đuổi, và kịch bản CSKH cũ đúng thời điểm họ vừa dùng hết 1 lọ.
3. Giọng điệu (Tone): Sắc bén, thực tế, quyết đoán, mang lại sự tin cậy tuyệt đối. Dùng định dạng Markdown (in đậm, bullet points) để bài tư vấn dễ đọc lướt.

RẤT QUAN TRỌNG: Bạn BẮT BUỘC phải trả về kết quả dưới dạng cấu trúc JSON hợp lệ với 2 key sau:
- "consulting_text": Nội dung bài phân tích và giải pháp (Sử dụng Markdown, emoji phù hợp, chia đoạn ngắn gọn).
- "suggested_questions": Mảng chứa ĐÚNG 3 câu hỏi gợi ý cực kỳ sắc bén (độ dài mỗi câu < 15 chữ) để người dùng đào sâu vào những chỉ số đang có vấn đề hoặc cần khai thác thêm từ dữ liệu trên.

Chỉ xuất định dạng JSON, không có bất kỳ văn bản nào nằm ngoài JSON.
```

---

## 4. Verification Plan
1. Dev thiết lập API call với System Prompt trên.
2. Thử nghiệm truyền một Payload "giả" (Ví dụ: Doanh thu giảm, Khách mới tăng, Khách cũ giảm).
3. Xác minh AI trả về đúng chuẩn JSON và 3 câu hỏi gợi ý phản ánh đúng tình trạng "Khách cũ giảm".
