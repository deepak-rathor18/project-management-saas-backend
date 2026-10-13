import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { isOriginAllowed } from "./config/cors.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins, process.env.NODE_ENV === "production"))
        return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api/auth",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }),
  authRoutes,
);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/organizations", organizationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
