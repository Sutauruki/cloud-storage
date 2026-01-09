import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 } 
}).single('file');

const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.authorization === `Bearer ${AUTH_TOKEN}`) return next();
  res.status(401).json({ error: "Unauthorized" });
};

app.post('/upload', checkAuth, (req: Request, res: Response) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: "File exceeds 50MB limit." });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    res.json({ directUrl: `${protocol}://${host}/download/${req.file.filename}` });
  });
});

app.get('/download/:filename', (req: Request, res: Response) => {
  const filePath = path.join(uploadDir, req.params.filename);
  fs.existsSync(filePath) ? res.download(filePath) : res.status(404).send("Not found.");
});

app.listen(PORT, () => console.log(`🚀 Server ready at http://localhost:${PORT}`));