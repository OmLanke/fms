import { createApp } from "./app";
import { config } from "./config";

const app = createApp();

app.listen(config.port, () => {
  console.log(`[Gateway] Running on port ${config.port}`);
  console.log(`[Gateway] Routing to:`, config.services);
});
