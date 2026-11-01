import express, { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as RacuniController from '../controllers/racuni.controller.js';

const router = Router();

router.get('/', verifyToken, RacuniController.lista);
// Tijelo zahtjeva je sam PDF. Token se provjerava prije citanja fajla.
router.post(
  '/',
  verifyToken,
  express.raw({ type: 'application/pdf', limit: '5mb' }),
  RacuniController.uvezi,
);
router.delete('/:id', verifyToken, RacuniController.obrisi);

export default router;
