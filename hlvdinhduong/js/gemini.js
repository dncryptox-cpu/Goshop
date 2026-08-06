/**
 * Gemini AI Parser Client for HLV Dinh Dưỡng
 * Bóc tách text hoặc ảnh bữa ăn/bài tập thành JSON có cấu trúc.
 * Tự động áp dụng quy tắc tính khẩu phần chuẩn & món ăn chính Việt Nam (400 - 700 kcal).
 */

class GeminiParser {
  constructor() {
    this.storageKeyModel = 'hlv_gemini_model';
    this.defaultModel = 'gemini-3.6-flash'; // GA model 08/2026
  }

  getModel() {
    return localStorage.getItem(this.storageKeyModel) || this.defaultModel;
  }

  setModel(modelName) {
    if (modelName) {
      localStorage.setItem(this.storageKeyModel, modelName.trim());
    }
  }

  getApiKey() {
    return localStorage.getItem('hlv_gemini_api_key') || '';
  }

  setApiKey(key) {
    localStorage.setItem('hlv_gemini_api_key', key.trim());
  }

  /**
   * Chẩn đoán và log chi tiết lỗi API
   */
  async handleApiError(response, modelName) {
    const status = response.status;
    let errBody = {};
    try {
      errBody = await response.json();
    } catch(e) {}

    const rawMessage = errBody.error?.message || response.statusText || 'Unknown API Error';
    console.error(`[Gemini API Error] Status: ${status} | Model: ${modelName} | Message: ${rawMessage}`, errBody);

    if (status === 404) {
      throw new Error(`[Lỗi 404] Model '${modelName}' không tồn tại hoặc đã bị Google khai tử (shutdown). Vui lòng vào Cài đặt (⚙️) đổi tên model sang 'gemini-3.6-flash' hoặc 'gemini-2.5-flash'. (Chi tiết: ${rawMessage})`);
    } else if (status === 403) {
      throw new Error(`[Lỗi 403] Gemini API Key bị từ chối hoặc bị hạn chế quyền. Vui lòng kiểm tra lại API Key trong Cài đặt (⚙️). (Chi tiết: ${rawMessage})`);
    } else if (status === 429) {
      throw new Error(`[Lỗi 429] Đã vượt quá giới hạn lượt gọi (Quota limit) của Gemini API. Vui lòng đợi ít phút rồi thử lại. (Chi tiết: ${rawMessage})`);
    } else {
      throw new Error(`[Lỗi HTTP ${status}] Gọi Gemini API thất bại: ${rawMessage}`);
    }
  }

  /**
   * Phân tích text đầu vào (bữa ăn hoặc bài tập)
   */
  async parseText(promptText) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhấn nút ⚙️ Cài đặt trên góc phải để nhập API Key.');
    }

    const currentModel = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

    const systemInstruction = `
Bạn là chuyên gia dinh dưỡng và HLV thể thao dành cho vận động viên ultra runner (chạy trail/địa hình leo dốc).
Nhiệm vụ của bạn là phân tích văn bản người dùng cung cấp và trích xuất thành định dạng JSON chuẩn.

QUY TẮC BẮT BỘC VỀ KHẨU PHẦN DINH DƯỠNG & MÓN ĂN CHÍNH:
1. Nếu người dùng nhập tên một món ăn chính (Ví dụ: Phở, Bún Bò, Bún Bò Nạm, Cơm Tấm, Hủ Tiếu, Bánh Canh, Miến, Bún Rêu...) mà không ghi rõ định lượng, AI BẮT BUỘC phải mặc định đó là "1 TÔ/DĨA SIZE TIÊU CHUẨN NGOÀI QUÁN".
2. Mức năng lượng cho 1 món ăn chính tiêu chuẩn của Việt Nam BẮT BUỘC phải dao động từ 400 Kcal đến 700 Kcal (Ví dụ: 1 tô Bún bò nạm ngoài quán khoảng 520-650 Kcal, Carb 60-80g, Protein 25-35g, Fat 15-25g).
3. TUYỆT ĐỐI KHÔNG ĐƯỢC tính toán dưới 200 Kcal cho bất kỳ món ăn chính nào nói trên.
4. Nếu là món ăn phụ/thức uống nhẹ (Sữa, Cà phê sữa, Trứng, Trái cây, Bánh), tính theo 1 khẩu phần trung bình (VD: Hộp 180ml, Ly 200ml, 1 quả 60g) và ghi rõ khẩu phần giả định đó vào TenMon hoặc GhiChu.

Xác định xem input thuộc dạng 'DINH_DUONG' (bữa ăn) hay 'TAP_LUYEN' (buổi tập).

1. Nếu là 'DINH_DUONG', trả về JSON có cấu trúc:
{
  "type": "DINH_DUONG",
  "items": [
    {
      "bua": "Sáng" | "Trưa" | "Tối" | "Phụ" | "Trong tập",
      "tenMon": "Tên món ăn cụ thể (kèm giả định khẩu phần nếu không có sẵn, VD: Bún bò nạm (1 tô tiêu chuẩn))",
      "kcal": số nguyên (calo ước tính từ 400-700 Kcal với món chính),
      "proteinG": số nguyên (gram protein),
      "fatG": số nguyên (gram chất béo),
      "carbG": số nguyên (gram tinh bột/carb),
      "ghiChu": "ghi rõ giả định khẩu phần chuẩn (VD: 1 tô ngoài quán ~550 Kcal) nếu người dùng không ghi trọng lượng"
    }
  ]
}

2. Nếu là 'TAP_LUYEN', trả về JSON có cấu trúc:
{
  "type": "TAP_LUYEN",
  "workout": {
    "monTap": "Chạy trail" | "Chạy đường bằng" | "Đạp xe" | "Gym" | "Khác",
    "quangDuongKm": số thực (km),
    "elevationGainM": số nguyên (mét elevation gain leo dốc),
    "thoiGianH": số thực (số giờ tập, VD 2.5),
    "kcalDot": số nguyên (calo đã đốt cháy),
    "ghiChu": "mô tả bài tập"
  }
}

CHỈ Trả về duy nhất đối tượng JSON hợp lệ, không kèm bất kỳ câu dẫn hay dấu nháy markdown nào khác ngoài JSON.
    `;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemInstruction },
            { text: `Phân tích nội dung sau:\n"${promptText}"` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      console.error('[Gemini Network Error]', netErr);
      throw new Error(`[Lỗi Mạng/CORS] Không thể kết nối tới generativelanguage.googleapis.com: ${netErr.message}`);
    }

    if (!response.ok) {
      await this.handleApiError(response, currentModel);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      throw new Error(`Gemini API (${currentModel}) trả về response nhưng không có nội dung text parsed.`);
    }

    try {
      return JSON.parse(candidateText);
    } catch (e) {
      const cleaned = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }

  /**
   * Phân tích ảnh đầu vào (base64 image)
   */
  async parseImage(base64Data, mimeType, textNote = '') {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để nhập API Key.');
    }

    const currentModel = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

    const systemInstruction = `
Bạn là chuyên gia dinh dưỡng ultra runner và trợ lý thể thao.
Hãy nhìn vào hình ảnh (ảnh chụp món ăn, thực đơn, hoặc ảnh chụp màn hình Strava/Garmin/đồng hồ tập luyện) và phân tích thành JSON có cấu trúc.

QUY TẮC BẮT BỘC VỀ KHẨU PHẦN DINH DƯỠNG & MÓN ĂN CHÍNH:
1. Nếu hình ảnh/mô tả là món ăn chính (Ví dụ: Phở, Bún Bò, Cơm Tấm, Hủ Tiếu, Bánh Canh...) mà không có định lượng cụ thể, AI BẮT BUỘC phải mặc định đó là "1 TÔ/DĨA SIZE TIÊU CHUẨN NGOÀI QUÁN".
2. Năng lượng cho 1 món ăn chính tiêu chuẩn Việt Nam BẮT BUỘC từ 400 Kcal đến 700 Kcal. TUYỆT ĐỐI KHÔNG ĐƯỢC tính dưới 200 Kcal cho các món chính này.
3. Với món phụ/nước uống, mặc định theo 1 khẩu phần chuẩn (VD: Hộp 180ml, Ly 200ml) và ghi rõ vào tenMon hoặc ghiChu.

Nếu là ảnh món ăn -> Trả về type 'DINH_DUONG' chứa các món ăn với ước tính Kcal, Protein(g), Fat(g), Carb(g).
Nếu là ảnh bài tập Strava/Garmin -> Trả về type 'TAP_LUYEN' với QuangDuong_km, Elevation_Gain_m, ThoiGian_h, KcalDot.

Cấu trúc JSON đầu ra bắt buộc:
1. 'DINH_DUONG': { "type": "DINH_DUONG", "items": [{ "bua": "Phụ", "tenMon": "Tên món (kèm 1 tô/dĩa chuẩn)", "kcal": 550, "proteinG": 28, "fatG": 18, "carbG": 65, "ghiChu": "Giả định 1 tô tiêu chuẩn ngoài quán (~550 Kcal)" }] }
2. 'TAP_LUYEN': { "type": "TAP_LUYEN", "workout": { "monTap": "Chạy bộ", "quangDuongKm": 0, "elevationGainM": 0, "thoiGianH": 0, "kcalDot": 0, "ghiChu": "..." } }

CHỈ Trả về JSON thuần.
    `;

    const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemInstruction + (textNote ? `\nGhi chú kèm theo: "${textNote}"` : '') },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: base64Content
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    } catch (netErr) {
      console.error('[Gemini Network Error]', netErr);
      throw new Error(`[Lỗi Mạng/CORS] Không thể gửi ảnh tới generativelanguage.googleapis.com: ${netErr.message}`);
    }

    if (!response.ok) {
      await this.handleApiError(response, currentModel);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      throw new Error(`Gemini API (${currentModel}) trả về response từ ảnh nhưng không có nội dung text parsed.`);
    }

    try {
      return JSON.parse(candidateText);
    } catch (e) {
      const cleaned = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  }
}

window.geminiParser = new GeminiParser();
