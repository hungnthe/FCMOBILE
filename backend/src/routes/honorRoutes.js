const express = require('express');
const router = express.Router();
const { applyHth, applyLastWeekCup } = require('../services/honorService');

function sendError(res, error) {
  res.status(error.statusCode || 500).json({ error: error.message || 'Honor update failed', details: error.details });
}

router.post('/hth', (req, res) => {
  try {
    const result = applyHth(req.body?.session_id);
    res.json({ message: 'Đã cập nhật HTH cho toàn bộ cầu thủ trong Season.', ...result });
  } catch (error) { sendError(res, error); }
});

router.post('/last-week-cup', (req, res) => {
  try {
    if (req.body && ['increment', 'amount', 'delta'].some((key) => Object.prototype.hasOwnProperty.call(req.body, key))) {
      return res.status(400).json({ error: 'Last Week Cup chỉ hỗ trợ tăng đúng 1 mỗi lần cập nhật.' });
    }
    const batchId = req.get('Idempotency-Key') || req.get('X-Batch-Id') || undefined;
    const result = applyLastWeekCup(req.body?.session_id, req.body?.player_ids, batchId);
    res.json({ message: result.alreadyApplied ? 'Batch đã được xử lý trước đó; không cộng thêm.' : 'Đã cộng +1 Last Week Cup cho cầu thủ đã chọn.', ...result });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
