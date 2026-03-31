import { WinGoApiResponse, PredictionResult, AIInsight } from "./types";
import { GoogleGenAI } from "@google/genai";

const API_URL = "/api/proxy/wingo?ts=";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function fetchWinGoData(): Promise<WinGoApiResponse> {
  const ts = Date.now();
  const response = await fetch(API_URL + ts);
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }
  return response.json();
}

export async function getAIInsights(bsHistory: ("BIG" | "SMALL")[]): Promise<AIInsight> {
  try {
    const historyStr = bsHistory.slice(-20).join(", ");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this WinGo 1M sequence: [${historyStr}]. 
      Provide a deep technical analysis in JSON format.
      Schema: { "sentiment": "BULLISH" (for BIG) | "BEARISH" (for SMALL) | "NEUTRAL", "reasoning": "short explanation in Hindi/English mix", "riskLevel": "LOW" | "MEDIUM" | "HIGH" }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "{}") as AIInsight;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      sentiment: "NEUTRAL",
      reasoning: "AI Engine currently recalibrating...",
      riskLevel: "MEDIUM"
    };
  }
}

export async function getAIPrediction(bsHistory: ("BIG" | "SMALL")[]): Promise<PredictionResult> {
  try {
    const historyStr = bsHistory.slice(-15).join(", ");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this WinGo 1M sequence: [${historyStr}]. 
      Predict the NEXT outcome (BIG or SMALL) based on pattern recognition and probability.
      Provide response in JSON format.
      Schema: { "pick": "BIG" | "SMALL", "conf": number (0-100), "logic": "short explanation in Hindi/English mix" }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      pick: result.pick || "WAIT",
      conf: result.conf || 50,
      logic: `AI: ${result.logic || "Pattern Analysis"}`
    };
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    return { pick: "WAIT", conf: 0, logic: "AI Offline" };
  }
}

export function analyzeData(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): PredictionResult {
  if (bsHistory.length < 10) {
    return { pick: "WAIT", conf: 0, logic: "Collecting Data" };
  }

  // 1. Markov Analysis
  const transitions: Record<string, Record<string, number>> = {
    BIG: { BIG: 0, SMALL: 0 },
    SMALL: { BIG: 0, SMALL: 0 },
  };

  for (let i = 0; i < bsHistory.length - 1; i++) {
    transitions[bsHistory[i]][bsHistory[i + 1]]++;
  }

  const lastState = bsHistory[bsHistory.length - 1];
  const markovPick: "BIG" | "SMALL" = transitions[lastState]["BIG"] >= transitions[lastState]["SMALL"] ? "BIG" : "SMALL";

  // 2. Volatility
  let switches = 0;
  const recent = bsHistory.slice(-6);
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] !== recent[i + 1]) switches++;
  }

  // Decision
  let finalPick: "BIG" | "SMALL" = markovPick;
  let logic = "MARKOV_CHAIN";
  let conf = 65;

  if (switches >= 4) {
    const avg = historyData.slice(-10).reduce((a, b) => a + b, 0) / 10;
    finalPick = avg > 4.5 ? "SMALL" : "BIG";
    logic = "VOLATILE_REVERSION";
    conf = 78;
  } else if (switches <= 1) {
    finalPick = lastState;
    logic = "STABLE_TREND";
    conf = 88;
  }

  return { pick: finalPick, conf, logic };
}
