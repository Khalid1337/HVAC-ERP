import { createApp } from './app';

const PORT = process.env.PORT || 5000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`[SERVER] Running successfully on http://localhost:${PORT}`);
});
