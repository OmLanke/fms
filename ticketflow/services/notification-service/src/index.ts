import 'dotenv/config';
import { consumer } from './consumer';

console.log('Starting notification service...');
consumer.start().catch((err) => {
  console.error('Failed to start consumer:', err);
  process.exit(1);
});
