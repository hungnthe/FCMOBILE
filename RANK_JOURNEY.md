# Hành trình thăng hạng

Menu **Ngôi đền huyền thoại → Hành trình thăng hạng** là hai mục cùng cấp. Dữ liệu sử dụng `player_id` có sẵn. `backend/data/players.json` chỉ lưu mã `rank`; `backend/data/player-rank-data.json` lưu cấu hình bậc, mốc thống kê, nhiệm vụ và lịch sử. Danh hiệu mùa giải cũ không tự chuyển thành bậc.

## Quyền quản trị

Ứng dụng trước đây không có đăng nhập. Cấu hình `RANK_ADMIN_KEY` bằng mật khẩu dài, riêng tư trước khi khởi động backend. Với chạy trực tiếp, đặt biến môi trường hoặc thêm vào tệp `backend/.env` (tệp này đã được gitignore). Với Docker Compose, đặt biến môi trường `RANK_ADMIN_KEY` cho Compose (hoặc trong tệp `.env` tại thư mục dự án) rồi tạo lại container backend. Không đưa mật khẩu vào mã nguồn hay commit. Nếu chưa cấu hình, backend từ chối mọi thao tác quản trị. Chỉ nhập mật khẩu trong giao diện tin cậy; khi truy cập qua mạng cần HTTPS và giới hạn truy cập máy chủ. Đây là một khóa quản trị dùng chung, không phải hệ thống tài khoản cá nhân.

Tại trang mới, chọn **Quản trị** và nhập mật khẩu; khóa chỉ giữ trong bộ nhớ trang. Chọn cầu thủ và dùng **Trao bậc** cho chặng kế tiếp. Nhiệm vụ là tùy chọn: có thể trao khi chưa thiết lập hoặc chưa hoàn thành; lịch sử lưu đúng trạng thái nhiệm vụ tại thời điểm trao. Các chặng sau có thể được thiết lập trước; mốc “từ đầu chặng” được ghi khi chặng bắt đầu. Khi chặng chưa bắt đầu, tiến độ theo mốc chưa được tính.

Backend chạy một tiến trình duy nhất đối với một thư mục dữ liệu. Không dùng nhiều tiến trình backend cùng ghi vào thư mục đó. Giao dịch trao bậc có nhật ký khôi phục; sau sự cố, backend tự khôi phục trước khi đọc lại dữ liệu. Sao lưu cùng lúc toàn bộ thư mục data khi ứng dụng đã dừng.

## API

- `GET /api/rank-journey` trả về bậc, thống kê hỗ trợ và hành trình của mọi cầu thủ.
- `POST /api/rank-journey/admin/check` kiểm tra khóa trong header `X-Rank-Admin-Key`.
- `PUT /api/rank-journey/players/:id/stages/:rank/missions` nhận `{ "missions": [...] }`. Mỗi nhiệm vụ có `id` (bỏ trống khi tạo), `name`, `description`, `type` (`manual` hoặc `stat`); nhiệm vụ thống kê thêm `stat`, `scope` (`career` hoặc `stage`), `target` (số nguyên dương).
- `PUT /api/rank-journey/players/:id/stages/:rank/missions/:mission/confirmation` nhận `{ "confirmed": true }` hoặc `false`.
- `POST /api/rank-journey/players/:id/promotions` nhận `{ "target": "professional" }` (hoặc mã bậc kế tiếp).

Ba thao tác ghi và kiểm tra quyền yêu cầu header quản trị. Backend chỉ cho phép trao bậc kế tiếp; nhiệm vụ không phải điều kiện bắt buộc. Tiến độ nhiệm vụ tại thời điểm trao được lưu trong lịch sử.
