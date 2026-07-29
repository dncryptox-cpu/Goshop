import type { UserProgress, JournalEntry, SpeakingSession, SRSCard } from '../types';
import { getTodayDateString, addDays } from './srs';

export function getSeedData() {
  const today = getTodayDateString();
  const yesterday = addDays(today, -1);
  const day2Ago = addDays(today, -2);
  const day3Ago = addDays(today, -3);

  const sampleProgress: UserProgress = {
    lastCompletedDate: yesterday,
    lastCheckDate: today,
    streak: 4,
    stakeAmount: 50000,
    totalBurned: 50000,
    totalPreserved: 200000,
  };

  const sampleJournals: JournalEntry[] = [
    {
      id: 'j_1',
      date: `${yesterday} 21:45`,
      text: 'Today I reviewed my trading log. The BTC breakout pattern had high volume, so I entered at $64,200 with a strict 2% stop loss. In the evening, I ran 18km easy pace around West Lake to recover legs after Sunday long run.',
      score: 9,
      feedback: 'Nhật ký viết rất rõ ràng, từ vựng chuẩn giao dịch tài chính và chạy bộ. Tiếp tục duy trì phong độ!',
      corrections: [
        { original: 'recover legs', corrected: 'recover my legs' }
      ]
    },
    {
      id: 'j_2',
      date: `${day2Ago} 20:15`,
      text: 'Market volatility was intense today due to Fed inflation report. I stayed out of the market to prevent FOMO. Discipline is key in both day trading and 100km ultra trail running.',
      score: 8,
      feedback: 'Tư duy kỷ luật rất tốt! Cấu trúc câu gãy gọn và giàu tính định hướng.',
      corrections: [
        { original: 'due to Fed inflation report', corrected: 'due to the Fed inflation report' }
      ]
    },
    {
      id: 'j_3',
      date: `${day3Ago} 22:10`,
      text: 'Completed 30km trail training on Ham Luan mountain. Altitude gain was over 1,500m. My hydration strategy worked well, consuming 500ml water with electrolytes every hour.',
      score: 9,
      feedback: 'Bài viết sắc bén về kỹ thuật trail running. Ngôn ngữ tự nhiên và mạch lạc.',
      corrections: []
    }
  ];

  const sampleSpeaking: SpeakingSession[] = [
    {
      id: 's_1',
      date: `${yesterday} 19:30`,
      topic: 'Explain your risk management rule when a trade hits stop-loss.',
      transcript: 'When a trade hits my stop loss, I immediately exit without hesitation. I never move my stop loss further down because that leads to catastrophic capital loss. Protecting capital is my first priority.',
      score: 9,
      feedback: 'Phản xạ nói mạch lạc, phát âm từ vựng quản trị rủi ro rất chuẩn xác.',
      wpm: 128,
      corrections: []
    },
    {
      id: 's_2',
      date: `${day2Ago} 18:40`,
      topic: 'Describe your pacing strategy and nutrition plan for a 100km mountain ultra trail.',
      transcript: 'For a 100km ultra trail, staying in zone two heart rate during the first fifty kilometers is critical. I eat one energy gel every 45 minutes and drink electrolytes regularly.',
      score: 8,
      feedback: 'Tốc độ nói ổn định. Chú ý mạo từ khi nhắc đến vùng nhịp tim.',
      wpm: 115,
      corrections: [
        { original: 'staying in zone two heart rate', corrected: 'staying in heart rate Zone 2' }
      ]
    },
    {
      id: 's_3',
      date: `${day3Ago} 17:50`,
      topic: 'How does mindfulness and breathwork help maintain calm during high market volatility?',
      transcript: 'When market spikes sharply, my heart rate increases. Deep diaphragmatic breathing helps clear my mind and stick to my pre-planned trading strategy instead of emotional trading.',
      score: 8,
      feedback: 'Nội dung sâu sắc kết hợp giữa thiền và trading. Cần nhớ chia động từ số ít.',
      wpm: 120,
      corrections: [
        { original: 'When market spikes sharply', corrected: 'When the market spikes sharply' }
      ]
    }
  ];

  const sampleSRSCards: SRSCard[] = [
    {
      id: 'srs_seed_1',
      front: 'due to Fed inflation report',
      back: 'due to the Fed inflation report',
      box: 0,
      nextReview: today,
      createdAt: day2Ago,
    },
    {
      id: 'srs_seed_2',
      front: 'staying in zone two heart rate',
      back: 'staying in heart rate Zone 2',
      box: 1,
      nextReview: today,
      createdAt: day2Ago,
    },
    {
      id: 'srs_seed_3',
      front: 'When market spikes sharply',
      back: 'When the market spikes sharply',
      box: 0,
      nextReview: today,
      createdAt: day3Ago,
    },
    {
      id: 'srs_seed_4',
      front: 'recover legs',
      back: 'recover my legs',
      box: 2,
      nextReview: addDays(today, 3),
      createdAt: yesterday,
    },
    {
      id: 'srs_seed_5',
      front: 'I am used to trade without stoploss',
      back: 'I am used to trading with a stop-loss',
      box: 3,
      nextReview: addDays(today, 7),
      createdAt: addDays(today, -5),
    }
  ];

  return {
    sampleProgress,
    sampleJournals,
    sampleSpeaking,
    sampleSRSCards,
  };
}
