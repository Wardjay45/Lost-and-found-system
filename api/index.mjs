import app from '../server/app.js';
import { createVercelHandler } from '../server/services/vercelRequest.js';
export default createVercelHandler(app);
