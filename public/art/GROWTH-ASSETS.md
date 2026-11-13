# Bộ cây Cozy Tropical Farm

Game dùng 21 loại cây từ Cozy Tropical Farm Starter v0.2 do người dùng cung cấp. Bản web gồm 105 ảnh giai đoạn và 42 ảnh túi giống/nông sản, tối ưu thành WebP trong `public/art/farm/` (tổng khoảng 1,72 MB).

Gói gốc giữ nguyên trong `asset-sources/Farming-Game-Assets/`, ngoài thư mục public và không đưa vào repository xuất bản. Bộ cây cũ được giữ trong `asset-sources/previous-game-plants/`. Phông nền, đảo cỏ, bảng tên và ba ảnh hạt gacha tiếp tục dùng bộ minh họa cũ.

`scripts/prepare-farm-art.mjs` đọc manifest qua sáu phần của gói, xuất WebP rộng 256 px, giữ alpha và toàn bộ khung hình. `lib/farm-art.json` lưu tên gói, phiên bản, SHA-256 ảnh nguồn, cờ đất vẽ sẵn và thông số căn gốc. Chạy lại script chỉ khi cần tái xuất ảnh; không cần gói gốc để build bản đã có WebP.

Ảnh cây dùng khung 256×384, điểm neo gốc (0,5; 0,9375). 12 cây có mô đất vẽ sẵn nên không vẽ thêm lớp đất CSS phía sau. Chín cây còn lại dùng lớp đất của vườn. Kích thước hiển thị được cố định theo khung cây trưởng thành của từng loài để đổi giai đoạn không làm dịch gốc cây.

## Giai đoạn trong game

Mỗi cây có đủ năm ảnh nguồn. Game chọn các mốc khác nhau, gồm cả trạng thái mới gieo/cây con:

- Ba mốc: Cà rốt, Lúa, Hành tây, Xà lách (ảnh 1, 3, 5).
- Bốn mốc: Khoai tây, Bắp cải, Ngô, Cà chua, Cà tím, Dưa chuột, Ớt, Ớt chuông (ảnh 1, 2, 3, 5).
- Năm mốc: Bí ngô, Dâu tây, Khoai lang, Dứa, Dưa hấu, Đậu phộng, Xoài, Táo, Chuối.

Ảnh cuối chỉ hiện khi cây chín. Xoài, Táo, Chuối bắt đầu bằng cây con; cơ chế thu hoạch vẫn giải phóng ô đất như các cây khác.

## Gacha

| Hạt | Giá mặc định | Cấp mở khóa | Nhóm Thường (7 cây) | Nhóm Hiếm (8 cây) | Nhóm Đặc biệt (6 cây) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Thường | 10 | 1 | 80% | 18% | 2% |
| Hiếm | 30 | 2 | 40% | 50% | 10% |
| Đặc biệt | 60 | 3 | 15% | 35% | 50% |

Trong mỗi nhóm, các loài có trọng số bằng nhau. Khi quản lý tắt một loài, máy chủ chia lại tỷ lệ giữa các cây còn lại. Gacha vẫn chọn và lưu cây một lần khi gieo. Giá/cấp của hạt và thời gian/XP của cây sửa được trong quản lý.

## Chuyển dữ liệu

Hướng dương chuyển thành Ngô; Sen vàng chuyển thành Xoài. Kho hạt và bộ sưu tập được cộng dồn vào loài thay thế. Cây giữ nguyên ID, thời điểm gieo/chín, snapshot thời gian và XP. Ví và XP người chơi không đổi. Hai danh mục cũ chỉ giữ cho lịch sử quản trị, bị ẩn khỏi client và không còn gieo hoặc cấp qua cheat được.

Đây là bộ ảnh trạng thái tĩnh từ gói có công bố dùng AI. File điều khoản gốc là `LICENSE_DRAFT.txt`; giữ nguyên file đó trong gói nguồn để đối chiếu với bên phát hành. Không xuất bản gói nguồn, sprite sheet hoặc demo tải về.
