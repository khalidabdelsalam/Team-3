const express = require('express');

const { getHealth } = require('../controllers/healthController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/dependency-health', getHealth);
//دي بتدينا معلومات عن حالةالخدمة (هل شغالة؟ هل متصلة بال MongoDB؟ هل شغالة بكامل قوتها؟)
//وغير محتاجة API Key عشان نقدر نطمن عليها من برة.
module.exports = router;
//لو MongoDB connected و Kafka connected يرجع:
//{ status: 'ok', mongo: true, kafka: true }
//لكن لو Kafka مش متصل يرجع:
//{ status: 'degraded', mongo: true, kafka: false }
//بالطريقة دي نقدر نعرف لو في حاجة غلط بسرعة.
//دي مهمة في Docker healthcheck.
