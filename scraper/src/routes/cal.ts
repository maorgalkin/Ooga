import { Router, type Request, type Response } from 'express';
import { handleOtpRequest, handleOtpVerify } from '../cal-handlers.js';

const router = Router();

/** POST /cal/otp/request { connectionId } → { calSessionToken } */
router.post('/otp/request', async (req: Request, res: Response) => {
  const { status, body } = await handleOtpRequest(req.headers.authorization ?? '', req.body);
  res.status(status).json(body);
});

/** POST /cal/otp/verify { connectionId, calSessionToken, code } → { otpToken } */
router.post('/otp/verify', async (req: Request, res: Response) => {
  const { status, body } = await handleOtpVerify(req.headers.authorization ?? '', req.body);
  res.status(status).json(body);
});

export default router;
