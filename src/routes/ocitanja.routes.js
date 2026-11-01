import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import * as OcitanjaController from '../controllers/ocitanja.controller.js';

const router = Router();

router.get('/', verifyToken, OcitanjaController.lista);
router.post('/', verifyToken, OcitanjaController.sacuvaj);
router.delete('/:id', verifyToken, OcitanjaController.obrisi);

export default router;
