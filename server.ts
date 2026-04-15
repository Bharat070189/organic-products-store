import express from "express";
import { createServer as createViteServer } from "vite";
import Razorpay from "razorpay";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let razorpay: any = null;
function getRazorpay() {
  if (!razorpay) {
    let key_id = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
    let key_secret = (process.env.RAZORPAY_KEY_SECRET || process.env.VITE_RAZORPAY_KEY_SECRET || "").trim();
    
    console.log(`[Razorpay] Checking keys: ID=${key_id ? 'SET (' + key_id.substring(0, 8) + '...)' : 'MISSING'}, SECRET=${key_secret ? 'SET' : 'MISSING'}`);
    
    if (key_id && key_secret) {
      try {
        console.log(`[Razorpay] Type of Razorpay import: ${typeof Razorpay}`);
        // Handle potential ESM default export issues
        const RazorpayConstructor = (Razorpay as any).default || Razorpay;
        console.log(`[Razorpay] Type of RazorpayConstructor: ${typeof RazorpayConstructor}`);
        
        if (typeof RazorpayConstructor !== 'function') {
           throw new Error(`Razorpay constructor is not a function (got ${typeof RazorpayConstructor})`);
        }

        razorpay = new RazorpayConstructor({ key_id, key_secret });
        console.log(`[Razorpay] Initialized successfully with Key ID: ${key_id.substring(0, 8)}...`);
      } catch (e) {
        console.error("[Razorpay] Initialization error:", e);
      }
    } else {
      console.warn("[Razorpay] Key ID or Secret missing in environment variables.");
    }
  }
  return razorpay;
}

async function startServer() {
  const app = express();
  const port = 3000;

  // Enable CORS for all origins in dev, and specific origins in production
  app.use(cors({
    origin: [
      "https://organic-products-store.web.app",
      "https://organic-products-store.firebaseapp.com",
      "http://localhost:3000",
      "http://localhost:5173",
      /\.run\.app$/ // Allow AI Studio previews
    ],
    credentials: true
  }));

  app.use(express.json());
  
  // Request logging middleware
  app.use((req, res, next) => {
    const logLine = `[Request] ${req.method} ${req.url} - ${new Date().toISOString()}\n`;
    fs.appendFileSync(path.join(process.cwd(), "server.log"), logLine);
    console.log(logLine);
    next();
  });

  app.get("/api/health", (req, res) => {
    const key_id = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || process.env.VITE_RAZORPAY_KEY_SECRET || "").trim();
    
    const envKeys = Object.keys(process.env).filter(k => k.includes('RAZORPAY'));
    console.log(`[HealthCheck] Request received at ${new Date().toISOString()}`);
    
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      razorpay_configured: !!(key_id && key_secret),
      razorpay_keys_found: envKeys,
      key_id_prefix: key_id ? key_id.substring(0, 8) : null,
      node_env: process.env.NODE_ENV || 'development'
    });
  });

  app.get("/api/razorpay-config-check", (req, res) => {
    const key_id = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "").trim();
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || process.env.VITE_RAZORPAY_KEY_SECRET || "").trim();
    
    const envKeys = Object.keys(process.env).filter(k => k.includes('RAZORPAY'));
    
    res.json({
      key_id_set: !!key_id,
      key_secret_set: !!key_secret,
      key_id_prefix: key_id ? key_id.substring(0, 8) : null,
      key_id_length: key_id.length,
      key_secret_length: key_secret.length,
      found_keys: envKeys
    });
  });

  app.post("/api/create-razorpay-order", async (req, res) => {
    try {
      const { amount } = req.body;
      console.log(`[Razorpay] Received order request for amount: ${amount}`);
      
      if (amount === undefined || amount === null || isNaN(amount)) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const rp = getRazorpay();
      if (!rp) {
        return res.status(500).json({ error: "Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your Secrets." });
      }

      const orderOptions = {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };

      const order = await rp.orders.create(orderOptions);
      res.json(order);
    } catch (error: any) {
      console.error("[Razorpay] Order creation failed:", error);
      
      // Handle specific Razorpay error codes
      if (error.statusCode === 401) {
        return res.status(401).json({ 
          error: "Authentication failed: Your Razorpay Key ID or Key Secret is invalid. Please double-check them in your Razorpay Dashboard. Ensure you aren't mixing Test and Live keys." 
        });
      }

      const errorMessage = error.description || error.error?.description || error.message || "Unknown Razorpay error";
      res.status(500).json({ error: errorMessage });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      console.log(`[Vite] Handling request: ${req.originalUrl}`);
      try {
        const indexPath = path.join(process.cwd(), "index.html");
        if (!fs.existsSync(indexPath)) {
          console.error(`[Vite] index.html not found at ${indexPath}`);
          return res.status(404).send("index.html not found");
        }
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        console.error(`[Vite] Error transforming HTML:`, e);
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server started at http://0.0.0.0:${port}`);
  });
}

startServer().catch(console.error);
