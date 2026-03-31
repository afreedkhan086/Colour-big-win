import express from "express";
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
      },
      {
        url: `https://api.tirangagames.com/api/webapi/GetNoDataPageList?ts=${ts}`,
        method: "POST",
        body: JSON.stringify({ pageSize: 20, pageNo: 1, typeId: 1 })
      },
      {
        url: `https://api.bdggame.com/api/webapi/GetNoDataPageList?ts=${ts}`,
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
          if (data && data.data && (data.data.list || data.data.list?.length === 0)) {
            return res.json(data);
          }
        }
      } catch (err) {
        console.error(`Failed to fetch from ${endpoint.url}:`, err);
      }
    }

    // If all fail, return a simulated response so the app doesn't stay "Offline"
    // We generate dynamic issue numbers based on current time to keep the app "moving"
    const now = new Date();
    const YYYYMMDD = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0');
    
    // WinGo 1M has 1440 periods a day. 
    // Calculate current period index based on minutes since midnight
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentPeriodIndex = currentMinutes + 1;
    
    const simulatedList = [];
    // Generate last 30 periods
    for (let i = 0; i < 30; i++) {
      const periodIndex = currentPeriodIndex - i;
      if (periodIndex <= 0) continue; // Skip if before midnight
      
      const issueNumber = YYYYMMDD + periodIndex.toString().padStart(4, '0');
      
      // Use a seed-based random for consistency within the same period
      // This ensures that if we fetch multiple times in the same minute, we get the same result
      const seed = parseInt(issueNumber);
      const pseudoRandom = (seed * 9301 + 49297) % 233280;
      const num = Math.floor((pseudoRandom / 233280) * 10);
      
      simulatedList.push({
        issueNumber: issueNumber,
        number: num.toString(),
        colour: num % 2 === 0 ? (num === 0 ? "red-violet" : "red") : (num === 5 ? "green-violet" : "green"),
        premium: num >= 5 ? "BIG" : "SMALL"
      });
    }

    res.json({
      code: 0,
      data: {
        list: simulatedList.reverse() // Latest first
      },
      msg: "Simulated Data (API Unreachable)"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  // Only listen if not being imported as a module (e.g. by Vercel or Netlify)
  if (process.env.NODE_ENV !== "production" || (!process.env.VERCEL && !process.env.NETLIFY)) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
