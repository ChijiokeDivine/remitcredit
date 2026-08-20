// backend/src/server.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getConfig } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import { borrowersRouter } from "./routes/borrowers";
import { remittancesRouter } from "./routes/remittances";
import { loansRouter } from "./routes/loans";
import { creditRouter } from "./routes/credit";
import { activityStore } from "./store";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const config = getConfig();
    res.json({ status: "ok", networkEnv: config.networkEnv });
  });

  app.get("/activity", (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json({ events: activityStore.listAll(limit) });
  });

  app.use("/borrowers", borrowersRouter);
  app.use("/remittances", remittancesRouter);
  app.use("/loans", loansRouter);
  app.use("/credit", creditRouter);

  // Keep error handling last so it catches everything above.
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const config = getConfig();
  const app = createApp();
  app.listen(config.backend.port, () => {
    console.log(`[backend] RemitCredit API listening on :${config.backend.port} (${config.networkEnv})`);
    console.log(
      config.backend.relayerPrivateKey
        ? "[backend] relayer configured — write endpoints will submit on-chain directly"
        : "[backend] no relayer configured — write endpoints will return 500 until BACKEND_RELAYER_PRIVATE_KEY is set, or a frontend should sign client-side instead"
    );
  });
}
