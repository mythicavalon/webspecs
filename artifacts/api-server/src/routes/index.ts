import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import healthRouter from "./health";
import integrationRouter from "./integration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationRouter);
router.use(dashboardRouter);

export default router;
