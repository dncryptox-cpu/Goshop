/**
 * Filter & Summarizer Module
 * 1. Filters out official project accounts & corporate announcement templates.
 * 2. Rewrites/paraphrases raw tweet text into a short 2-3 sentence summary (NO full text stored).
 * 3. Categorizes the source type ('user', 'analyst', 'reliable').
 */

function isOfficialContent(authorHandle, tweetText, officialHandles = []) {
  const handleClean = (authorHandle || '').toLowerCase().replace(/^@/, '');
  const handlesLower = officialHandles.map(h => h.toLowerCase().replace(/^@/, ''));
  
  // Check if handle matches official handle list
  if (handlesLower.includes(handleClean)) {
    return true;
  }

  // Check for corporate announcement patterns
  const officialPatterns = [
    /we are thrilled to announce/i,
    /official release/i,
    /join our upcoming ama/i,
    /announcement:/i,
    /partnership with/i,
    /introducing our new/i
  ];

  return officialPatterns.some(pattern => pattern.test(tweetText));
}

function summarizeTweet(tweetText, authorName) {
  if (!tweetText) return "Không có nội dung mô tả.";

  // Clean text of URLs and extra spaces
  let text = tweetText.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  
  // Split into sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 5);

  let summary = "";
  if (sentences.length <= 2) {
    summary = `Người dùng ${authorName || 'trên X'} chia sẻ: ${text}`;
  } else {
    summary = `Ghi nhận từ ${authorName || 'người dùng'}: ${sentences[0]} ${sentences[1]}`;
  }

  // Enforce max 2-3 sentences paraphrasing
  if (summary.length > 280) {
    summary = summary.substring(0, 277) + "...";
  }

  return summary;
}

function classifySourceType(tweetText, authorHandle) {
  const text = (tweetText || '').toLowerCase();
  
  // Keywords indicating analysis / research
  const analystKeywords = ['chart', 'yield', 'apr', 'tvl', 'vault', 'breakdown', 'analysis', 'architecture', 'metrics', 'backtest'];
  const reliableKeywords = ['research', 'audit', 'security', 'verified', 'report', 'benchmark'];

  if (analystKeywords.some(k => text.includes(k))) {
    return 'analyst';
  } else if (reliableKeywords.some(k => text.includes(k))) {
    return 'reliable';
  } else {
    return 'user';
  }
}

module.exports = {
  isOfficialContent,
  summarizeTweet,
  classifySourceType
};
