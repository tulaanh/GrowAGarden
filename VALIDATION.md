# Kiểm chứng bản nhiệm vụ và cửa hàng

- PASS: `npm test` kiểm tra mốc XP, cấp độ và tính tăng trưởng theo thời gian.
- PASS: `tests/economy.sql` kiểm tra nộp, trả bài, nộp lại, duyệt, thưởng thêm sau duyệt, chống thưởng lặp, thiếu tiền, khóa theo cấp, bón phân, chống thu hoạch sớm/lặp và snapshot XP. Fixture rollback.
- PASS: Kiểm tra HTTP với tài khoản quản lý và hai người chơi tạm: bài nháp được cách ly, người chơi không có quyền quản lý, ảnh riêng tư chỉ chủ bài và quản lý mở được.
- PASS: Các yêu cầu mua, gieo và thu hoạch đồng thời không gây chi vượt số dư, chiếm trùng ô hoặc nhận trùng phần thưởng.
- PASS: Dọn bài tập, ảnh, phiên đăng nhập và ba tài khoản QA sau kiểm tra. Tài khoản quản lý thật được giữ nguyên.
- PASS: Bộ minh họa được tạo riêng bằng imagegen, lưu trong dự án; nút, chữ, số dư và trạng thái là HTML có hành vi thật. Prompt ở `public/art/prompts.md`.
- PASS: `tests/admin-cheats.sql` kiểm tra tài khoản thường/khách bị từ chối, chống cộng lặp, nhật ký tiền, XP, vật phẩm, làm chín và thu hoạch sau cheat. Toàn bộ dữ liệu kiểm thử rollback.
- PASS: Vai trò anon/authenticated không có quyền đọc hoặc sửa bảng quyền quản lý; lịch sử cheat không có quyền đọc trực tiếp từ client. Bảng audit riêng tư chủ ý không có RLS policy cho client.
- PASS (12/11/2026): `npm test` có 5 kiểm tra cho XP, tiến độ với snapshot thời gian, các giai đoạn riêng của 3 cây, đủ 18 ảnh WebP và tỷ lệ khi tắt cây.
- PASS (12/11/2026): `tests/gacha.sql` kiểm tra cả 3 loại hạt; chặn mua hạt riêng, khóa cấp, mua lặp, gieo trùng ô, hết hạt, pool rỗng, kết quả cố định, snapshot thời gian/XP, hạt cũ, bón phân gần lúc chín, chống thu hoạch lặp và RLS giữa hai người chơi. Dữ liệu rollback; không còn tài khoản fixture sau kiểm tra.
- PASS (12/11/2026): Chạy lại `tests/economy.sql` với hạt gacha và `tests/admin-cheats.sql`. Kiểm tra quyền xác nhận client không sửa được trọng số hoặc chèn cây, khách không gọi được RPC gieo.
- PASS (12/11/2026): Rà soát mã giữ hướng hoạt hình theo ảnh đã duyệt, ảnh tách lớp và nút/chữ thật; bảng tỷ lệ dùng details/summary native, chuyển giai đoạn dùng useReducedMotion. Không kiểm tra trực quan giao diện theo yêu cầu của chủ ứng dụng.

Chủ ứng dụng yêu cầu tự kiểm tra giao diện; không chạy thêm kiểm tra giao diện sau yêu cầu đó. Đợt kiểm tra trước đã xem bố cục 360, 390, 768 và 1280 pixel. Các chỉnh sửa nhỏ cuối cùng vẫn cần chủ ứng dụng thử trên thiết bị của mình.

## Bộ cây Cozy Tropical Farm (12/11/2026)

- PASS: 147 WebP rộng 256 px, đúng tỷ lệ 2:3 hoặc 1:1, có alpha trong suốt; tổng 1.717.812 byte. 21 loài có đủ năm ảnh nguồn, túi giống và nông sản.
- PASS: `npm test` có 6 kiểm tra, gồm đủ 21 loài, 3–5 mốc riêng, chỉ hiện ảnh chín khi đủ thời gian, tỷ lệ gacha và đường dẫn/metadata.
- PASS: `tests/economy.sql`, `tests/gacha.sql`, `tests/admin-cheats.sql`, `tests/tropical-crops.sql` chạy trên Supabase và rollback. Đã gieo/thu hoạch đủ 21 loài qua gacha và qua kho admin; chặn loài cũ, thu hoạch lặp, gieo trùng và đọc chéo vườn.
- PASS: Migration khóa dữ liệu trong lúc chuyển và so sánh hồ sơ, snapshot cây, tổng kho và bộ sưu tập trước/sau trong cùng giao dịch; không đổi ví hoặc XP. Hướng dương thành Ngô, Sen vàng thành Xoài.
- PASS: Rà soát mã giữ nét hoạt hình của gói được chọn, ảnh đặt đúng tỷ lệ và điểm neo cố định, chỉ ẩn đất CSS khi sprite có đất sẵn. Dùng nút/dialog/details native và giữ useReducedMotion. Gói nguồn cùng bộ cây cũ được lưu ngoài thư mục xuất bản.
- Không chạy kiểm tra trực quan hoặc click giao diện theo yêu cầu của chủ ứng dụng; chưa có kết luận về bố cục sau thay ảnh trên thiết bị thật.
