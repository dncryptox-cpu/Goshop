Cùng một mã, hai sàn trả phí funding hai mức khác nhau.

Mình không đoán giá lên hay xuống. Mình sống ở khoảng chênh đó.

Đọc mất khoảng 4 phút.

## Funding là gì, trong 3 câu

Lệnh perp (hợp đồng không kỳ hạn) có một khoản phí trả qua lại mỗi giờ, gọi là **funding**.

Funding dương thì bên mua trả bên bán. Âm thì ngược lại.

Mỗi sàn tự tính mức funding của mình, nên cùng một mã có thể chênh nhau.

## Cách làm

Mở **lệnh mua ở sàn funding thấp**, **lệnh bán ở sàn funding cao**, cùng khối lượng.

Giá lên thì lệnh mua lãi, lệnh bán lỗ, bù nhau. Giá xuống cũng vậy.

Thứ còn lại sau khi hai lệnh bù nhau: phần chênh phí funding.

Mình đang làm việc này trên Hyperliquid HIP-3, giữa hai sàn xyz và io.

## Đo độ lệch giá trước khi vào

Hai sàn hiếm khi cùng một giá. Mình đo độ lệch:

```
Lệch giá (%) = (giá ở sàn bán − giá ở sàn mua) / giá ở sàn mua × 100
```

Con số này quan trọng hơn bạn nghĩ.

Lúc đóng lệnh, nếu độ lệch đi ngược mình, phần lỗ giá có thể nuốt hết phí funding đã nhận.

## Không đoán giá, nhưng vẫn mất tiền được

Hai lệnh bù nhau về giá. **Nhưng mỗi lệnh nằm ở một sàn, ký quỹ riêng.**

Giá chạy mạnh một chiều, lệnh thua có thể bị thanh lý trước. Lệnh thắng nằm ở sàn kia, không cứu được.

Nên mỗi lệnh phải đủ ký quỹ, và phải theo dõi cả hai.

<a id="6-tieu-chi"></a>

## 6 câu hỏi trước khi vào một cặp

Trượt một câu là mình bỏ, kể cả khi funding đang rất đẹp.

1. Hai sàn có **cùng một giá tham chiếu công khai** không?
2. Dữ liệu cũ có cho thấy **độ lệch giá quay về** không?
3. **Thanh khoản hai bên có tương đương** không? Không thì vào ra bị trượt giá một phía.
4. **Luật chốt giá có rõ** không, hay phụ thuộc người vận hành sàn quyết?
5. Có **rủi ro pháp lý** nào đang treo không?
6. **Người dựng sàn** có lịch sử đáng tin không?

## Lần mình sai

Mã ANTH, chéo hai sàn khác.

Một sàn **tự lấy giá từ sổ lệnh của chính nó**. Sàn kia không công bố cách tính giá. Không có ai kéo hai giá về gần nhau.

Độ lệch trôi từ **0,57% lên 6,39%**. Không quay lại.

Phí funding nhận được bao nhiêu cũng không bù nổi. Câu 1 và câu 2 ở trên có từ lần đó.

## Mình làm bằng gì

- **Tìm cặp:** tool tự build, chỉ đọc dữ liệu từ API công khai của Hyperliquid. Tool không bao giờ tự đặt lệnh.
- **Vào lệnh:** làm tay trên TreadFi, chia nhỏ lệnh theo thời gian để đỡ trượt giá.
- **Không làm:** theo tín hiệu, dồn hết vốn vào một cặp.

Muốn xem các cặp đang chênh bao nhiêu: **[Funding HIP-3 lúc này →](/tai-nguyen/funding/)**
