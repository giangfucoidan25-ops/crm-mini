# Walkthrough: Hoàn thiện giải pháp "Cố vấn AI"

## Tổng quan những gì đã triển khai

Tính năng "Cố vấn AI" đã được triển khai thành công lên ứng dụng CRM-Mini. Hệ thống hiện tại đã tích hợp khả năng tổng hợp dữ liệu KPI từ màn hình Dashboard, giao tiếp với Gemini API thông qua System Prompt chuẩn của "Giám đốc Kinh doanh thực chiến", và hiển thị kết quả bằng một Side-panel sang trọng.

### 1. Các file đã thay đổi

- **`modules/co-van-ai.js` (MỚI)**:
  - Khai báo biến `CoVanAiModule` chịu trách nhiệm toàn bộ logic xử lý cho tính năng Cố vấn AI.
  - Hàm `buildPayload`: Gom dữ liệu từ các thống kê (stats) của Dashboard như doanh thu, đơn hàng, tỷ lệ chuyển đổi, tỷ lệ mua lại, số liệu chăm sóc và top 5 sản phẩm.
  - Hàm `getSystemPrompt`: Chứa Prompt đóng vai Giám đốc kinh doanh TPCN thực chiến với 16 năm kinh nghiệm, đảm bảo tính thực tế trong từng lời khuyên. Bắt buộc Gemini trả về JSON.
  - Hàm `callGeminiAPI`: Tái sử dụng Gemini API key từ cấu hình `database.json`, gọi API với `responseMimeType: "application/json"`.
  - Các hàm render giao diện (Loading, Bài viết dạng Markdown, Nút gợi ý Dynamic Chips).
  - Hàm `askFollowUp`: Xử lý khi người dùng bấm vào một trong 3 câu hỏi đào sâu. Lưu trữ ngữ cảnh (Conversation History) để AI hiểu mạch hội thoại.

- **`index.html`**:
  - Thêm HTML cho nút bấm `btn-covan-ai` vào trong `page-header-right` của Dashboard.
  - Thêm cấu trúc HTML mặc định cho khung giao diện Side-panel (Slide từ phải sang).
  - Khai báo nhúng `<script src="modules/co-van-ai.js"></script>`.

- **`style.css`**:
  - Viết mới toàn bộ CSS cho nút "✨ Cố vấn AI" (hiệu ứng gradient shift, nổi bật so với các nút khác).
  - CSS cho Side-panel (animation slide in/out, overlay làm mờ nền).
  - CSS cho Skeleton Loader đẹp mắt mô phỏng thời gian chờ AI xử lý.
  - Thiết kế các câu hỏi gợi ý "Dynamic Chips" dạng nút bấm bo góc với hiệu ứng hover.

- **`app.js`**:
  - Đăng ký chạy `CoVanAiModule.initEvents()` trong chu trình khởi tạo chính của app (hàm `init()`), đảm bảo các sự kiện click, nút đóng mở được gắn đúng.

### 2. Cách hoạt động (User Flow)

1. **Truy cập Dashboard**: Người dùng vào phần "Tổng quan hoạt động".
2. **Kích hoạt**: Người dùng ấn vào nút "✨ Cố vấn AI" ở góc phải phía trên.
3. **Thu thập dữ liệu ngầm**: Hệ thống sẽ tự động gọi hàm thu thập toàn bộ dữ liệu KPI theo *thời gian thực* tương ứng với khoảng thời gian người dùng đang chọn trên Dashboard (vd: Tuần này, Tháng này...).
4. **Phân tích (Loading Phase)**: Side-panel mở ra với thanh Skeleton chạy hiệu ứng ánh sáng. Ngầm bên dưới, nó gói gọn số liệu gửi lên máy chủ Google (Gemini).
5. **Hiển thị Kết quả**: 
   - Phần phân tích chính (Tư vấn chiến thuật) được trình bày mạch lạc, chia đoạn, in đậm, và có bullet points.
   - Bên dưới là 3 gợi ý đào sâu (Dynamic Questions) do AI tự đề xuất dựa trên những điểm yếu/điểm nổi bật từ dữ liệu.
6. **Tương tác Đào sâu**: Người dùng click vào một câu gợi ý, câu hỏi sẽ bay lên trên, Side-panel hiện Loading ngắn và xuất ra câu trả lời phân tích chi tiết.

### 3. Hướng dẫn Kiểm thử

- Chắc chắn rằng đã điền **Gemini API Key** hợp lệ trong tab **Cài đặt**.
- Vào tab **Tổng quan**.
- Chỉnh khoảng thời gian tùy ý (Ví dụ: Tháng này hoặc tùy chọn).
- Click "✨ Cố vấn AI".
- Đọc bài tư vấn và thử click vào các lựa chọn đào sâu ở dưới cùng.

### 4. Kết quả & Lưu ý
- API Key hiện tại được gọi thẳng từ client lên Google API. (Theo đúng pattern đang dùng tại `customers.js`). Điều này giúp dễ deploy vì đây là một local app, không cần setup phức tạp ở backend.
- Lỗi quá tải (Rate limit) nếu có sẽ được render ra khung Error thông báo rõ ràng để người dùng thử lại.

---
*Mọi thay đổi đã được áp dụng và sẵn sàng sử dụng.*
