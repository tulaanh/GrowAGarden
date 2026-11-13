# Vườn Bài Tập

Ứng dụng học tập và game nông trại bằng Next.js, React, Tailwind CSS, Framer Motion và Supabase.

## Vòng chơi

Quản lý giao bài, người chơi nộp ảnh, quản lý duyệt để phát Đồng tri thức. Bài làm tốt có thể nhận một khoản thưởng thêm. Đồng tri thức dùng mua hạt và phân bón. Cây lớn theo thời gian; thu hoạch cho nông sản sưu tầm và XP, không tạo tiền.

- Hạt Thường: 10 Đồng tri thức, cấp 1; tỷ lệ ba nhóm cây Thường/Hiếm/Đặc biệt là 80/18/2%.
- Hạt Hiếm: 30 Đồng tri thức, cấp 2; tỷ lệ ba nhóm 40/50/10%.
- Hạt Đặc biệt: 60 Đồng tri thức, cấp 3; tỷ lệ ba nhóm 15/35/50%.
- Có 21 loại cây từ Cozy Tropical Farm Starter v0.2; mỗi cây có 3–5 mốc phát triển trong game, gồm trạng thái mới gieo hoặc cây con.
- Toàn bộ khu vườn có tối đa 16 vị trí, mỗi vị trí trồng 1 cây. Ban đầu mở sẵn 4 vị trí ở giữa; 12 vị trí còn lại có giá mở lần lượt 100, 200… 1.200 Đồng tri thức (tổng 7.800). Có thể chọn bất kỳ vị trí đang khóa; giá phụ thuộc số vị trí đã mở thêm.
- Giao diện giữ tỷ lệ trình duyệt cố định. Trong màn hình vườn, dùng nút + và − để thu phóng bản đồ từ 80% đến 160%; kéo chuột, kéo một ngón tay, cuộn chuột/bàn di chuột hoặc dùng phím mũi tên để di chuyển bản đồ.
- Cà rốt mặc định 30 phút/20 XP, Ngô 120 phút/60 XP, Xoài 360 phút/150 XP. Các cây khác xem trong cửa hàng và quản lý.
- Phân bón: 5 Đồng tri thức, giảm tối đa 30 phút.
- Mốc XP các cấp: 0, 100, 300, 600, 1000... Cấp tiếp theo cần thêm 100 nhân cấp hiện tại.

Hạt gacha được mua vào kho; khi gieo, máy chủ chọn và lưu loài cây, không đổi khi tải lại. Hạt riêng của cây có từ bản trước vẫn dùng được; cửa hàng chỉ bán hạt gacha và phân bón. Giá/cấp của vật phẩm, thời gian/XP của cây chỉnh được trong mục Quản lý. Cây đã gieo giữ thời gian và XP tại lúc gieo. Tắt một loài cây trong quản lý sẽ chia lại tỷ lệ giữa các cây còn lại; nếu không còn cây hợp lệ thì không thể mua hoặc gieo hạt gacha.

## Sử dụng

Đăng ký bằng email và mật khẩu, không cần xác nhận email. Tài khoản quản lý tulaanh0317@gmail.com đã được gắn quyền phía máy chủ. Vào Tài khoản → Quản lý nhiệm vụ & cửa hàng để tạo bản nháp, đăng bài, xem ảnh nộp, duyệt, trả bài hoặc thưởng thêm.

Mọi tài khoản mới khác là người chơi. Quyền quản lý nằm trong schema riêng, không dựa vào thông tin vai trò do trình duyệt gửi lên. Người chơi thấy các bài được đăng và lịch sử của mình; tệp bài nộp chỉ chủ bài và quản lý được mở. Mỗi tệp tối đa 10 MB; mỗi lần đính kèm tối đa 5 tệp.

Trong Quản lý → Cheat menu, admin có thể cộng Đồng tri thức, XP, thêm hạt/phân bón và làm chín cây của chính mình. Quyền được kiểm tra lại tại máy chủ; mỗi thao tác có mã yêu cầu chống ghi lặp và lịch sử trong schema riêng. Cộng tiền cũng ghi vào lịch sử ví. Giới hạn mỗi lần: 1.000.000 tiền hoặc XP, 9.999 vật phẩm. Làm chín cây vẫn cần thu hoạch để nhận XP và nông sản.

Trạng thái mới được tải lại sau mỗi thao tác, khi quay lại cửa sổ và mỗi 30 giây khi trang đang mở.

## Chạy và triển khai

Yêu cầu Node.js 20.9 trở lên. Chạy `npm ci` rồi `npm run dev`. `npm test` kiểm tra XP và tính tăng trưởng; `npm run build` tạo bản static trong `out/`.

`.env.production` chỉ chứa URL và publishable key được dùng công khai ở trình duyệt. Không đưa service-role key hoặc khóa quản trị vào client. Để dùng dự án khác, tạo `.env.local` từ `.env.example`.

Thiết lập dự án Supabase mới bằng cách áp dụng `supabase/migration.sql`, sau đó `supabase/economy-v2.sql`. Cấp quyền quản lý cho UUID tài khoản đã xác định bằng thao tác quản trị; không tự gán quyền theo email nhập từ trang đăng ký. Dự án hiện tại đã được áp dụng các thay đổi này.

Áp dụng thêm `supabase/admin-cheats.sql` để bật Cheat menu. `tests/admin-cheats.sql` kiểm tra phân quyền, chống cộng lặp, tiền/XP/vật phẩm và làm chín cây trong giao dịch rollback.

Sau đó áp dụng `supabase/migrations/20261112132736_gacha_growth_stages.sql` để thêm hạt gacha, bảng trọng số chỉ đọc và snapshot thời gian lớn. Migration này giữ nguyên ví, kho hạt, cây và bộ sưu tập hiện có. Dự án đang chạy đã được cập nhật.

Áp dụng tiếp `supabase/migrations/20261112164437_tropical_crop_assets.sql` để chuyển sang 21 loài mới. Hướng dương được đổi thành Ngô, Sen vàng thành Xoài; số dư, XP, tổng kho/bộ sưu tập và snapshot cây được kiểm tra giữ nguyên trong cùng giao dịch. Loài cũ bị ẩn bằng RLS và chặn tái cấp/gieo. Dự án đang chạy đã áp dụng migration.

Các RPC công khai kiểm tra người dùng và gọi triển khai giao dịch trong `garden_private`. Ví được khóa trước khi cập nhật số dư; thưởng và mua hàng có ràng buộc chống ghi trùng. Cây chín được xác định theo thời gian máy chủ, không cần cron.

Sau hai migration `20261113110115_expand_grass_planting.sql` và `20261113154419_finite_garden_unlocks.sql`, áp dụng `supabase/migrations/20261113155941_sixteen_planting_slots.sql` để giới hạn toàn bộ vườn ở 16 cây, mỗi vị trí một cây. Dự án đang chạy đã được cập nhật. Cây có sẵn vẫn được chăm sóc và thu hoạch; nếu vị trí chưa mở thì cần trả phí trước khi trồng lại. Giá mở vị trí, số dư, quyền sở hữu và chống trừ tiền lặp đều được kiểm tra phía máy chủ. `tests/grass-planting.sql` kiểm tra giới hạn 16 cây, giá tăng dần, kho hạt, thu hoạch cây cũ, lịch sử ví và RLS trong giao dịch rollback.

## Minh họa và kiểm chứng

Ảnh cây dùng gói Cozy Tropical Farm do chủ ứng dụng cung cấp: `public/art/farm/plants/<loài>/` chứa ảnh giai đoạn, `public/art/farm/items/` chứa túi giống và nông sản. Có 147 WebP (khoảng 1,72 MB). Metadata, nguồn và điểm neo ở `lib/farm-art.json`; hướng dẫn ở `public/art/GROWTH-ASSETS.md`. Gói tải về được giữ ngoài public tại `asset-sources/Farming-Game-Assets/`; ảnh cây cũ lưu ở `asset-sources/previous-game-plants/`. Có thể tái xuất bằng `node scripts/prepare-farm-art.mjs`. Nền dùng ảnh `public/art/farm/items/plot_grass.png`; bảng tên và hạt gacha giữ bộ minh họa imagegen trước đây. Chữ, nút và số liệu vẫn là HTML thật.

`tests/economy.sql` kiểm tra chuỗi nộp/trả/nộp lại/duyệt, thưởng một lần, cấp độ mua hàng, bón phân, thu hoạch và giữ snapshot XP. Toàn bộ fixture chạy trong giao dịch rollback. Kiểm tra HTTP trực tiếp bằng ba tài khoản tạm đã xác nhận RLS, Storage riêng tư và xử lý yêu cầu mua/trồng/thu hoạch đồng thời; các tài khoản và dữ liệu thử được dọn sau kiểm tra.

Việc kiểm tra giao diện cuối cùng do chủ ứng dụng thực hiện theo yêu cầu trong phiên làm việc.

`tests/gacha.sql` kiểm tra gacha cho đủ 21 loài, kết quả cố định, snapshot thời gian/XP, cây bị tắt, phân bón gần lúc chín, thu hoạch và cách ly dữ liệu giữa hai tài khoản. `tests/tropical-crops.sql` kiểm tra cây cũ đã được chuyển, RLS ẩn loài cũ, chặn API cũ và chuỗi cheat/gieo/thu hoạch đủ 21 nông sản. Các fixture rollback, không để lại tiền hoặc tài khoản thử. `npm test` kiểm tra đường dẫn ảnh, 3–5 mốc phát triển, tỷ lệ và metadata của bộ mới.
