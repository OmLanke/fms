import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ?? 3002;

app.listen(PORT, () => {
  console.log(`Event service listening on port ${PORT}`);
});
