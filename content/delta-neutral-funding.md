Mình không đoán giá. Phần lớn thời gian trên Hyperliquid, mình làm một việc: **ăn chênh lệch funding** giữa hai sàn, giữ vị thế trung lập.

Bài này là cách mình nghĩ về nó — cơ chế, cách đo, và những chỗ dễ sai.

## Cơ chế trong 3 dòng

- Perp có **funding**: funding dương thì long trả cho short, âm thì ngược lại.
- Cùng một tài sản, mỗi sàn một mức funding khác nhau.
- Mở **long ở sàn funding thấp, short ở sàn funding cao** với cùng khối lượng → giá đi đâu thì hai chân bù nhau, còn lại là phần chênh funding.

Trên HIP-3, mình theo dõi các cặp giữa các sàn builder như Trade[XYZ] và EntropyIO.

## Đo basis

Trước khi vào, mình nhìn chênh lệch giá giữa hai chân:

```
Basis = (giá chân short − giá chân long) / giá chân long × 100
```

Basis quan trọng vì lúc đóng lệnh, nếu basis đi ngược thì phần lỗ giá có thể ăn hết phần funding đã nhận.

## Trung lập giá ≠ hết rủi ro

Đây là chỗ nhiều anh em hiểu nhầm.

Delta-neutral **xoá rủi ro hướng giá**, nhưng **không xoá rủi ro thanh lý từng chân**. Mỗi sàn dùng margin riêng, độc lập. Giá chạy mạnh một chiều thì chân thua có thể bị thanh lý trước — trong khi chân thắng nằm ở sàn khác, không cứu được.

Nên: margin mỗi chân phải đủ dày, và phải theo dõi cả hai.

## 6 tiêu chí chọn cặp

Mình chỉ vào cặp qua được cả 6:

1. **Giá tham chiếu chung, công khai** cho cả hai chân.
2. **Backtest cho thấy basis có quay về trung bình** (mean-reversion).
3. **Thanh khoản hai chân tương đương** — không thì vào/ra bị trượt giá một bên.
4. **Luật settlement rõ ràng**, không phụ thuộc quyết định của người vận hành.
5. **Không có rủi ro pháp lý đang treo.**
6. **Deployer có lịch sử** đáng tin.

## Một ví dụ về chỗ sai

Có lần mình theo dõi một cặp chéo sàn mà oracle của một sàn **tự tham chiếu sổ lệnh của chính nó**, sàn còn lại không công bố cách tính oracle. Không có lực arbitrage nào kéo hai giá về gần nhau.

Kết quả: basis trôi từ **+0.57% lên +6.39%** và không quay lại. Funding ăn được bao nhiêu cũng không bù nổi.

Bài học: tiêu chí 1 và 2 không phải cho có.

## Mình làm thế nào

- **Nghiên cứu:** tự build tool quét funding spread, chỉ dùng dữ liệu miễn phí từ API công khai của Hyperliquid. Tool chỉ đọc — không bao giờ tự đặt lệnh.
- **Vào lệnh:** làm tay trên TreadFi.
- **Không:** tín hiệu, đoán đỉnh đáy, all-in một cặp.

Phần nghiên cứu sâu hơn — dashboard funding spread, phân tích từng dự án — mình để ở **[dnctrading.xyz](https://dnctrading.xyz)**.
