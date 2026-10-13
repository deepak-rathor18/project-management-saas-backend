import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const port = Number(process.env.PORT) || 5000;

connectDatabase()
  .then(() => {
    app.listen(port, () => console.log(`API listening on port ${port}`));
  })
  .catch((error) => {
    console.error("Could not start the API:", error.message);
    process.exit(1);
  });
