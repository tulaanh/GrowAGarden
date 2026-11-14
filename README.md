# Vườn Bài Tập

Ứng dụng học tập và game nông trại bằng Next.js, React, Tailwind CSS, Framer Motion và Supabase.

## Vòng chơi

Quản lý giao bài, người chơi nộp ảnh, quản lý duyệt để phát Đồng tri thức. Bài làm tốt có thể nhận một khoản thưởng thêm. Đồng tri thức dùng mua hạt và phân bón. Cây lớn theo thời gian; thu hoạch cho nông sản sưu tầm và XP, không tạo tiền.

- Hạt Thường: 10 Đồng tri thức, cấp 1; tỷ lệ ba nhóm cây Thường/Hiếm/Đặc biệt là 80/18/2%.
- Hạt Hiếm: 30 Đồng tri thức, cấp 2; tỷ lệ ba nhóm 40/50/10%.
- Hạt Đặc biệt: 60 Đồng tri thức, cấp 3; tỷ lệ ba nhóm 15/35/50%.
- Có 21 loại cây từ Cozy Tropical Farm Starter v0.2; mỗi cây có 3–5 mốc phát triển trong game, gồm trạng thái mới gieo hoặc cây con.
- Toàn bộ khu vườn có tối đa 16 vị trí, mỗi vị trí trồng 1 cây. Ban đầu mở sẵn 4 vị trí ở giữa; 12 vị trí còn lại có giá mở lần lượt 100, 200… 1.200 Đồng tri thức (tổng 7.800). Có thể chọn bất kỳ vị trí đang khóa; giá phụ thuộc số vị trí đã mở thêm.
- Giao diện giữ tỷ lệ trình duyệt cố định. Trong màn hình vườn, chụm hai ngón tay để thu phóng bản đồ từ 50% đến 160%; kéo chuột, kéo một ngón tay, cuộn chuột/bàn di chuột hoặc dùng phím mũi tên để di chuyển bản đồ.
- Cà rốt mặc định 30 phút/20 XP, Ngô 120 phút/60 XP, Xoài 360 phút/150 XP. Các cây khác xem trong cửa hàng và quản lý.
- Phân bón: 5 Đồng tri thức, giảm tối đa 30 phút.
- Sau mỗi 5–10 phút, cây cần tưới. Mỗi lượt bắt đầu với 1 phút để giải liên tiếp nhiều câu, mỗi câu chỉ được trả lời một lần; mỗi câu đúng nhận 10 XP và giảm tối đa 5 phút thời gian lớn, thời gian làm bài không tăng, trả lời sai kết thúc lượt.
- Mốc XP các cấp: 0, 100, 300, 600, 1000... Cấp tiếp theo cần thêm 100 nhân cấp hiện tại.

Hạt gacha được mua vào kho; khi gieo, máy chủ chọn và lưu loài cây, không đổi khi tải lại. Cửa hàng bán hạt gacha, phân bón và hạt riêng của các cây đã khám phá; Cà rốt và Lúa được mở sẵn. Giá/cấp của vật phẩm, thời gian/XP của cây chỉnh được trong mục Quản lý. Thời gian lớn mặc định có 21 mốc từ 30 phút đến 3 ngày, tăng theo nhóm cây. Cây đã gieo giữ thời gian và XP tại lúc gieo. Tắt một loài cây trong quản lý sẽ chia lại tỷ lệ giữa các cây còn lại; nếu không còn cây hợp lệ thì không thể mua hoặc gieo hạt gacha.

## Sử dụng

Đăng ký bằng email và mật khẩu, không cần xác nhận email. Tài khoản quản lý tulaanh0317@gmail.com đã được gắn quyền phía máy chủ. Vào Tài khoản → Quản lý nhiệm vụ & cửa hàng để tạo bản nháp, đăng bài, xem ảnh nộp, duyệt, trả bài hoặc thưởng thêm.

Mọi tài khoản mới khác là người chơi. Quyền quản lý nằm trong schema riêng, không dựa vào thông tin vai trò do trình duyệt gửi lên. Người chơi thấy các bài được đăng và lịch sử của mình; tệp bài nộp chỉ chủ bài và quản lý được mở. Mỗi tệp tối đa 10 MB; học sinh nộp tối đa 10 ảnh mỗi lần, giáo viên đính kèm tối đa 5 tệp cho đề bài. Camera mở toàn màn hình, hiển thị ảnh đã chụp và cho xóa ảnh để chụp lại trước khi nộp. Áp dụng migration `20261114141414_increase_homework_photo_limit.sql` trước khi dùng giới hạn 10 ảnh trên máy chủ.

Trong Quản lý → Cheat menu, admin có thể cộng Đồng tri thức, XP, thêm hạt/phân bón và làm chín cây của chính mình. Quyền được kiểm tra lại tại máy chủ; mỗi thao tác có mã yêu cầu chống ghi lặp và lịch sử trong schema riêng. Cộng tiền cũng ghi vào lịch sử ví. Giới hạn mỗi lần: 1.000.000 tiền hoặc XP, 9.999 vật phẩm. Làm chín cây vẫn cần thu hoạch để nhận XP và nông sản.

Dữ liệu được giữ trong bộ nhớ của phiên đăng nhập trong 60 giây để chuyển tab hiển thị ngay. Sau thao tác, dữ liệu liên quan đang dùng được tải lại; dữ liệu ở màn hình đóng được đánh dấu để tải khi mở. Khi trang hiển thị, mỗi 15 giây kiểm tra và chỉ tải dữ liệu đang dùng đã cũ; quay lại cửa sổ cũng áp dụng quy tắc này. Nút thử lại luôn buộc tải mới. Danh sách giữ bộ lọc và các trang đã mở khi chuyển tab; bộ nhớ được xóa khi đổi tài khoản hoặc tải lại trang. Nhiệm vụ, bài duyệt, lịch sử ví và lịch sử nộp bài có nút Xem thêm; ảnh và nhận xét chỉ tải khi mở chi tiết.

## Chạy và triển khai

Yêu cầu Node.js 20.9 trở lên. Chạy `npm ci` rồi `npm run dev`. `npm test` chạy kiểm tra frontend và các migration/fixture SQL trên PostgreSQL cục bộ trong bộ nhớ; `npm run build` tạo bản static trong `out/`.

`.env.production` chỉ chứa URL và publishable key được dùng công khai ở trình duyệt. Không đưa service-role key hoặc khóa quản trị vào client. Để dùng dự án khác, tạo `.env.local` từ `.env.example`.

Thiết lập dự án Supabase mới bằng cách áp dụng `supabase/migration.sql`, sau đó `supabase/economy-v2.sql`. Cấp quyền quản lý cho UUID tài khoản đã xác định bằng thao tác quản trị; không tự gán quyền theo email nhập từ trang đăng ký. Dự án hiện tại đã được áp dụng các thay đổi này.

Áp dụng thêm `supabase/admin-cheats.sql` để bật Cheat menu. `tests/admin-cheats.sql` kiểm tra phân quyền, chống cộng lặp, tiền/XP/vật phẩm và làm chín cây trong giao dịch rollback.

Sau đó áp dụng `supabase/migrations/20261112132736_gacha_growth_stages.sql` để thêm hạt gacha, bảng trọng số chỉ đọc và snapshot thời gian lớn. Migration này giữ nguyên ví, kho hạt, cây và bộ sưu tập hiện có. Dự án đang chạy đã được cập nhật.

Áp dụng tiếp `supabase/migrations/20261112164437_tropical_crop_assets.sql` để chuyển sang 21 loài mới. Hướng dương được đổi thành Ngô, Sen vàng thành Xoài; số dư, XP, tổng kho/bộ sưu tập và snapshot cây được kiểm tra giữ nguyên trong cùng giao dịch. Loài cũ bị ẩn bằng RLS và chặn tái cấp/gieo. Dự án đang chạy đã áp dụng migration.

Các RPC công khai kiểm tra người dùng và gọi triển khai giao dịch trong `garden_private`. Ví được khóa trước khi cập nhật số dư; thưởng và mua hàng có ràng buộc chống ghi trùng. Cây chín được xác định theo thời gian máy chủ, không cần cron.

Sau hai migration `20261113110115_expand_grass_planting.sql` và `20261113154419_finite_garden_unlocks.sql`, áp dụng `supabase/migrations/20261113155941_sixteen_planting_slots.sql` để giới hạn toàn bộ vườn ở 16 cây, mỗi vị trí một cây. Dự án đang chạy đã được cập nhật. Cây có sẵn vẫn được chăm sóc và thu hoạch; nếu vị trí chưa mở thì cần trả phí trước khi trồng lại. Giá mở vị trí, số dư, quyền sở hữu và chống trừ tiền lặp đều được kiểm tra phía máy chủ. `tests/grass-planting.sql` kiểm tra giới hạn 16 cây, giá tăng dần, kho hạt, thu hoạch cây cũ, lịch sử ví và RLS trong giao dịch rollback.

Áp dụng tiếp `supabase/migrations/20261113164956_direct_seed_purchases.sql`, `20261113165508_seed_discovery_unlocks.sql` và `20261114051020_scoped_game_reads.sql` theo thứ tự. Migration cuối thêm RPC đọc cây đã khám phá, RPC phân trang nhiệm vụ, index và policy hồ sơ tương đương. **Triển khai migration trước phiên bản frontend này**; client cũ tiếp tục dùng được sau migration.

Để bật tưới cây và ngân hàng câu hỏi, áp dụng tiếp `supabase/migrations/20261114090820_watering_math.sql` rồi `supabase/migrations/20261114091957_grade12_watering.sql` trước khi triển khai frontend tương ứng. Người quản lý vào Quản lý → Ngân hàng câu hỏi để tải tệp JSON và xem mẫu. Ngân hàng ban đầu trống. Áp dụng thêm `supabase/migrations/20261114102633_one_minute_watering.sql` trước khi triển khai giao diện mới. Áp dụng tiếp các migration `20261114102951_watering_server_clock.sql`, `20261114103125_watering_quiz_bonus_time.sql` và `20261114104039_end_watering_on_wrong_answer.sql`. Lượt tưới đang mở giữ câu hỏi và hạn chót khi mở lại; hết giờ hoặc chọn tưới xong sẽ kết thúc lượt.

Câu hỏi và lựa chọn hỗ trợ LaTeX trong `$...$`, `$$...$$`, `\(...\)` hoặc `\[...\]`. Trong chuỗi JSON, mỗi dấu `\` của LaTeX phải được viết thành `\\`. Xem tệp `examples/toan-12.json` để biết ví dụ có phân số và căn bậc hai. Câu cũ không có dấu phân cách vẫn được hiển thị như văn bản. Đáp án ngắn vẫn được so sánh dưới dạng văn bản.

## Minh họa và kiểm chứng

### Lưới cảnh quan khu vườn

Một ô đất chuẩn có hình chiếu isometric 192 × 96 px ở mức thu phóng 100%, được khai báo duy nhất bằng `SLOT_WIDTH` và `SLOT_HEIGHT` trong `lib/garden-map.ts`. Luống trồng, lối đi và viền cỏ dùng cùng lưới `gardenGridPosition(column, row)`. Lối đi bao quanh rộng một ô, viền cỏ rộng một ô; mỗi đoạn hàng rào theo đúng một cạnh ô, chừa cổng rộng hai ô. Toàn bộ cảnh nằm trong cùng một lớp di chuyển và thu phóng 50–160%.

Màu cỏ xanh, đất nâu và lối đi màu cát tiếp nối bộ cây Cozy Tropical Farm hiện có. Phần đất trống, đất có cây và trạng thái thu hoạch giữ nguyên ảnh, kích thước và nhãn của giao diện ban đầu; dùng lại `soil_unworked`, `soil_tilled` hoặc đất tích hợp trong ảnh cây. Nhãn khóa ghi chi phí thật. Các chi tiết cảnh quan tĩnh để thao tác trồng cây là điểm tập trung. Dùng phím Home để đưa góc nhìn về giữa; dùng Tab để chọn ô ngoài khung nhìn sẽ đưa ô đó về giữa.

### Bộ ảnh

Ảnh cây dùng gói Cozy Tropical Farm do chủ ứng dụng cung cấp: `public/art/farm/plants/<loài>/` chứa ảnh giai đoạn, `public/art/farm/items/` chứa túi giống và nông sản. Có 147 WebP (khoảng 1,72 MB). Metadata, nguồn và điểm neo ở `lib/farm-art.json`; hướng dẫn ở `public/art/GROWTH-ASSETS.md`. Gói tải về được giữ ngoài public tại `asset-sources/Farming-Game-Assets/`; ảnh cây cũ lưu ở `asset-sources/previous-game-plants/`. Có thể tái xuất bằng `node scripts/prepare-farm-art.mjs`. Nền dùng ảnh `public/art/farm/items/plot_grass.png`; bảng tên và hạt gacha giữ bộ minh họa imagegen trước đây. Chữ, nút và số liệu vẫn là HTML thật.

`tests/economy.sql` kiểm tra chuỗi nộp/trả/nộp lại/duyệt, thưởng một lần, cấp độ mua hàng, bón phân, thu hoạch và giữ snapshot XP. Toàn bộ fixture chạy trong giao dịch rollback. Kiểm tra HTTP trực tiếp bằng ba tài khoản tạm đã xác nhận RLS, Storage riêng tư và xử lý yêu cầu mua/trồng/thu hoạch đồng thời; các tài khoản và dữ liệu thử được dọn sau kiểm tra.

Việc kiểm tra giao diện cuối cùng do chủ ứng dụng thực hiện theo yêu cầu trong phiên làm việc.

`tests/gacha.sql` kiểm tra gacha cho đủ 21 loài, kết quả cố định, snapshot thời gian/XP, cây bị tắt, phân bón gần lúc chín, thu hoạch và cách ly dữ liệu giữa hai tài khoản. `tests/tropical-crops.sql` kiểm tra cây cũ đã được chuyển, RLS ẩn loài cũ, chặn API cũ và chuỗi cheat/gieo/thu hoạch đủ 21 nông sản. Các fixture rollback, không để lại tiền hoặc tài khoản thử. `npm test` kiểm tra đường dẫn ảnh, 3–5 mốc phát triển, tỷ lệ và metadata của bộ mới.

Cửa hàng có hai mục Mua và Bán. Bán nông sản trừ kho và cộng VNĐ (tiền game, biểu tượng $), tách biệt Đồng tri thức. Mỗi lượt bán tối đa 99 sản phẩm; giá và giao dịch được kiểm tra tại máy chủ, gửi lại cùng mã yêu cầu không cộng tiền lặp. Áp dụng migration `20261114134530_produce_sales.sql` trước frontend này. `tests/produce-sales.sql` kiểm tra tiền, tồn kho, giá, quyền và chống bán lặp.
