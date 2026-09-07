import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventRouter from "./event";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventRouter);

export default router;
