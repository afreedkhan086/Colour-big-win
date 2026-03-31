import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

async function startServer() {
  // Proxy for WinGo API to avoid CORS
  app.get("/api/proxy/wingo", async (req, res) => {
    try {
      const ts = req.query.ts || Date.now();
      const API_URL = `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${ts}`;
      
      // Many of these APIs work better with POST and specific body
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json;charset=UTF-8",
          "Referer": "https://ar-lottery01.com/",
          "Origin": "https://ar-lottery01.com",
          "Accept-Language": "en-US,en;q=0.9",
        },
        body: JSON.stringify({
          pageSize: 20,
          pageNo: 1,
          typeId: 1
        })
      });
      
      if (!response.ok) {
        // Fallback to GET if POST fails
        const getResponse = await fetch(API_URL, {
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            "Accept": "application/json, text/plain, */*",
            "Referer": "https://ar-lottery01.com/",
          }
        });
        
        if (!getResponse.ok) {
          throw new Error(`API responded with status: ${getResponse.status}`);
        }
        const data = await getResponse.json();
        return res.json(data);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch data from WinGo API" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Only listen if not being imported as a module (e.g. by Vercel)
  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
