const express = require('express');
const crypto = require('crypto');
const service = require('../services/rankService');
const router = express.Router();
const fail = (res,e) => { if (!e.statusCode) console.error('Rank journey error:', e); res.status(e.statusCode || 500).json({ error:e.statusCode ? e.message : 'Không thể lưu dữ liệu thăng hạng.' }); };
function admin(req,res,next) {
  const key = process.env.RANK_ADMIN_KEY;
  if (!key) return res.status(503).json({ error:'Chưa cấu hình mật khẩu quản trị thăng hạng trên máy chủ.' });
  const given=Buffer.from(String(req.get('X-Rank-Admin-Key') || '')); const expected=Buffer.from(key);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given,expected)) return res.status(403).json({ error:'Mật khẩu quản trị không đúng.' });
  next();
}
router.get('/', (req,res)=>{ try { res.json(service.getAll()); } catch(e){ fail(res,e); } });
router.post('/admin/check',admin,(req,res)=>res.json({ authorized:true }));
router.put('/players/:id/stages/:rank/missions',admin,(req,res)=>{ try { res.json(service.setMissions(req.params.id,req.params.rank,req.body?.missions)); } catch(e){ fail(res,e); } });
router.put('/players/:id/stages/:rank/missions/:mission/confirmation',admin,(req,res)=>{ try { res.json(service.confirmMission(req.params.id,req.params.rank,req.params.mission,req.body?.confirmed)); } catch(e){ fail(res,e); } });
router.post('/players/:id/promotions',admin,(req,res)=>{ try { res.json(service.promote(req.params.id,req.body?.target)); } catch(e){ fail(res,e); } });
module.exports=router;
