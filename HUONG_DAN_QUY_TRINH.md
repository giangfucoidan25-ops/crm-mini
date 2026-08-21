# QUY TRÌNH LÀM VIỆC & ĐỒNG BỘ CỦA CRM MINI

Tài liệu này ghi chú lại luồng làm việc chuẩn của CRM Mini để đảm bảo an toàn dữ liệu và code khi phát triển.

## 1. Luồng của DỮ LIỆU (Data Khách hàng, Đơn hàng, Ghi chú...)
Đây là dữ liệu sinh ra khi bạn hoặc nhân viên thao tác trên ứng dụng (thêm khách hàng, nhập ghi chú...).

- **Nơi lưu trữ:** Cấu trúc Database (Supabase) & IndexedDB (trình duyệt).
- **Luồng hoạt động:** 
  1. Khi bạn nhập dữ liệu trên link Vercel (hoặc Localhost) và bấm "Lưu".
  2. Dữ liệu được lưu ngay lập tức vào Local DB (IndexedDB) của trình duyệt.
  3. Hệ thống (thông qua Dexie Hooks trong `database.js`) sẽ ngầm **tự động** gọi hàm `SupabaseSync.push()` bắn dữ liệu thẳng lên Supabase.
  4. Bạn sẽ thấy biểu tượng đám mây chuyển sang "☁️ Đang lưu..." và sau đó là "☁️ Đã lưu mây".
- **Lưu ý quan trọng:** 
  - KHÔNG cần thao tác đồng bộ thủ công. Mọi thứ diễn ra tự động 100%.
  - Dữ liệu (Data) **TUYỆT ĐỐI KHÔNG** được lưu vào Github.
  - Google Drive Sync hiện tại không còn cần thiết vì Supabase đã đảm nhận việc sao lưu và đồng bộ real-time.

---

## 2. Luồng của MÃ NGUỒN & TÍNH NĂNG (Code Web App)
Đây là khi bạn muốn phát triển tính năng mới, sửa giao diện, hoặc đổi cấu trúc database.

- **Nơi lưu trữ:** Github (chứa code) & Vercel (chạy code thành Web).
- **Luồng hoạt động:**
  1. **Làm việc ở Localhost:** Bạn sửa file `.js`, `.css`, `.html` trên máy tính và kiểm tra kết quả tại `http://localhost:8080`.
  2. **Đẩy Code lên Github:** Khi tính năng mới chạy ổn định, bạn dùng phần mềm Git (như Github Desktop) để `commit` và `push` code lên kho lưu trữ (Repository) trên Github.
  3. **Tự động Deploy:** Vercel đang được liên kết với Github của bạn. Mỗi khi có code mới đẩy lên Github, Vercel sẽ nhận tín hiệu và **tự động** cập nhật lại trang web live (`crm-mini-sale.vercel.app`).

---

## 3. Cập nhật Cấu trúc Database (Schema)
Nếu trong lúc làm tính năng mới ở bước 2, bạn có tạo thêm bảng (Table) hoặc thêm cột mới trong cơ sở dữ liệu:
- Bạn viết các lệnh SQL vào file (ví dụ: `schema_update_v2.sql`).
- Bạn copy nội dung file SQL đó, truy cập vào bảng điều khiển (Dashboard) của **Supabase**.
- Mở mục **SQL Editor**, dán đoạn code vào và chạy (Run) để cập nhật cấu trúc bảng thủ công. Việc này đảm bảo tính chính xác và an toàn cấu trúc của dữ liệu thực tế.
