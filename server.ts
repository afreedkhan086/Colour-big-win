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
    const ts = req.query.ts || Date.now();
    
    // List of potential endpoints to try
    const endpoints = [
      {
        url: `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${ts}`,
        method: "POST",
        body: JSON.stringify({ pageSize: 20, pageNo: 1, typeId: 1 })
      },
      {
        url: `https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?ts=${ts}`,
        method: "GET"
      },
      {
        url: `https://api.91club.com/api/webapi/GetNoDataPageList?ts=${ts}`,
        method: "POST",
        body: JSON.stringify({ pageSize: 20, pageNo: 1, typeId: 1 })
      }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=UTF-8",
            "Referer": "https://ar-lottery01.com/",
            "Origin": "https://ar-lottery01.com",
          },
          body: endpoint.body
        });

        if (response.ok) {
          const data = await response.json();
          // Check if data has the expected structure
          if (data && (data.data?.list || data.data?.list?.length === 0)) {
            return res.json(data);
          }
        }
      } catch (err) {
        console.error(`Failed to fetch from ${endpoint.url}:`, err);
      }
    }

    // If all fail, return a simulated response so the app doesn't stay "Offline"
    // This allows the user to see the UI working while we wait for the API to recover
    res.json({
      code: 0,
      data: {
        list: [
          { issueNumber: "202403310001", number: 5, colour: "green", premium: "BIG" },
          { issueNumber: "202403310002", number: 2, colour: "red", premium: "SMALL" },
          { issueNumber: "202403310003", number: 8, colour: "red", premium: "BIG" },
        ]
      },
      msg: "Simulated Data (API Unreachable)"
    });
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
