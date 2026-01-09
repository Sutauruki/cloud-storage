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
const AUTH_TOKEN = process.env.AUTH_TOKEN || "change-me-in-env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

/**
 * CLEANUP LOGIC: Deletes files older than 60 days
 */
const cleanupOldFiles = () => {
  const sixtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  fs.readdir(uploadDir, (err, files) => {
    if (err) return console.error("Cleanup error:", err);

    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        // Check if file is older than 60 days
        if (now - stats.mtimeMs > sixtyDaysInMs) {
          fs.unlink(filePath, (err) => {
            if (!err) console.log(`🗑️ Deleted expired file: ${file}`);
          });
        }
      });
    });
  });
};

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

/**
 * FRONTEND: Private Landing Page
 */
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Private Storage | Vault</title>
        <style>
            body { 
                background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif;
                display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;
            }
            .card {
                background: #1e293b; padding: 2.5rem; border-radius: 1rem;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); border: 1px solid #334155;
                text-align: center; max-width: 400px;
            }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #38bdf8; }
            p { color: #94a3b8; line-height: 1.6; }
            .status {
                display: inline-block; padding: 0.25rem 0.75rem; background: #064e3b;
                color: #34d399; border-radius: 9999px; font-size: 0.75rem; font-weight: bold;
                margin-top: 1rem;
            }
            .expiry-note { font-size: 0.7rem; color: #64748b; margin-top: 2rem; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Personal Vault</h1>
            <p>This is a private file storage server. Access is restricted to authorized API keys only.</p>
            <div class="status">● SYSTEM ONLINE</div>
            <p class="expiry-note">Files are automatically purged after 60 days of inactivity.</p>
        </div>
    </body>
    </html>
  `);
});

app.post('/upload', checkAuth, (req: Request, res: Response) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: "File exceeds 50MB limit." });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    // TRIGGER CLEANUP on every successful upload
    cleanupOldFiles();

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    res.json({ 
      success: true,
      directUrl: `${protocol}://${host}/download/${req.file.filename}`,
      expires: "60 Days"
    });
  });
});

app.get('/download/:filename', (req: Request, res: Response) => {
  const filePath = path.join(uploadDir, req.params.filename);
  fs.existsSync(filePath) ? res.download(filePath) : res.status(404).send("File not found or expired.");
});

app.listen(PORT, () => console.log(`🚀 Server ready at http://localhost:${PORT}`));