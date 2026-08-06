/**
 * Gemini AI Parser Client for HLV Dinh Dưỡng
 * Bóc tách text hoặc ảnh bữa ăn/bài tập thành JSON có cấu trúc.
 */

class GeminiParser {
  constructor() {
    this.model = 'gemini-1.5-flash';
  }

  getApiKey() {
    return localStorage.getItem('hlv_gemini_api_key') || '';
  }

  setApiKey(key) {
    localStorage.setItem('hlv_gemini_api_key', key.trim());
  }

  /**
   * Phân tích text đầu vào (bữa ăn hoặc bài tập)
   */
  async parseText(promptText) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhấn nút ⚙️ Cài đặt trên góc phải để nhập API Key.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

    const systemInstruction = `
Bạn là chuyên gia dinh dưỡng và HLV thể thao dành cho vận động viên ultra runner (chạy trail/địa hình leo dốc).
Nhiệm vụ của bạn là phân tích văn bản người dùng cung cấp và trích xuất thành định dạng JSON chuẩn.

Xác định xem input thuộc dạng 'DINH_DUONG' (bữa ăn) hay 'TAP_LUYEN' (buổi tập).

1. Nếu là 'DINH_DUONG', trả về JSON có cấu trúc:
{
  "type": "DINH_DUONG",
  "items": [
    {
      "bua": "Sáng" | "Trưa" | "Tối" | "Phụ" | "Trong tập",
      "tenMon": "Tên món ăn cụ thể",
      "kcal": số nguyên (calo ước tính),
      "proteinG": số nguyên (gram protein),
      "fatG": số nguyên (gram chất béo),
      "carbG": số nguyên (gram tinh bột/carb),
      "ghiChu": "chi tiết nếu có"
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Lỗi Gemini API (${response.status})`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      throw new Error('Gemini API không trả về kết quả.');
    }

    try {
      return JSON.parse(candidateText);
    } catch (e) {
      // Clean JSON if markdown block returned
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

    const systemInstruction = `
Bạn là chuyên gia dinh dưỡng ultra runner và trợ lý thể thao.
Hãy nhìn vào hình ảnh (ảnh chụp món ăn, thực đơn, hoặc ảnh chụp màn hình Strava/Garmin/đồng hồ tập luyện) và phân tích thành JSON có cấu trúc.

Nếu là ảnh món ăn -> Trả về type 'DINH_DUONG' chứa các món ăn với ước tính Kcal, Protein(g), Fat(g), Carb(g).
Nếu là ảnh bài tập Strava/Garmin -> Trả về type 'TAP_LUYEN' với QuangDuong_km, Elevation_Gain_m, ThoiGian_h, KcalDot.

Cấu trúc JSON đầu ra bắt buộc:
1. 'DINH_DUONG': { "type": "DINH_DUONG", "items": [{ "bua": "Phụ", "tenMon": "...", "kcal": 0, "proteinG": 0, "fatG": 0, "carbG": 0, "ghiChu": "..." }] }
2. 'TAP_LUYEN': { "type": "TAP_LUYEN", "workout": { "monTap": "Chạy bộ", "quangDuongKm": 0, "elevationGainM": 0, "thoiGianH": 0, "kcalDot": 0, "ghiChu": "..." } }

CHỈ Trả về JSON thuần.
    `;

    // Base64 cleaning
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Lỗi Gemini API (${response.status})`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!candidateText) {
      throw new Error('Gemini API không trả về kết quả từ hình ảnh.');
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
