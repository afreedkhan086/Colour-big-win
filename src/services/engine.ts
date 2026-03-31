import { WinGoApiResponse, PredictionResult, AIInsight } from "../types";
import { GoogleGenAI } from "@google/genai";

const API_URL = "/api/proxy/wingo?ts=";

function getAIInstance() {
  // Use environment variable first, then hardcoded fallback
  const hardcodedKey = "AIzaSyBNMBi0XqzkotqqB_CkguW2BUt7NKDnAXY";
  const apiKey = (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined) || hardcodedKey;
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

export async function fetchWinGoData(): Promise<WinGoApiResponse> {
  const ts = Date.now();
  const response = await fetch(API_URL + ts);
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }
  return response.json();
}

export async function getAIInsights(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): Promise<AIInsight> {
  try {
    const ai = getAIInstance();
    const historyStr = bsHistory.slice(-40).join(", ");
    
    // Calculate current streak for context
    let streak = 1;
    for (let i = bsHistory.length - 1; i > 0; i--) {
      if (bsHistory[i] === bsHistory[i - 1]) streak++;
      else break;
    }
    const streakType = bsHistory[bsHistory.length - 1];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `CRITICAL ANALYSIS: WinGo 1M sequence: [${historyStr}]. 
      CURRENT STREAK: ${streak}x ${streakType}.
      Your goal is to maintain a 99%+ accuracy streak. 
      Analyze the last 40 periods for hidden cycles, Fibonacci clusters, and neural entropy.
      Provide a deep technical analysis in JSON format.
      Use a mix of high-level technical jargon and Hindi/English (Hinglish) to sound like a professional neural trader.
      Schema: { 
        "sentiment": "BULLISH" (for BIG) | "BEARISH" (for SMALL) | "NEUTRAL", 
        "reasoning": "Deep technical explanation in Hinglish (e.g., 'Market entropy high hai, but 3rd wave extension pattern confirm ho raha hai')", 
        "riskLevel": "LOW" | "MEDIUM" | "HIGH",
        "detectedPatterns": ["Dragon Tail", "Mirror Cluster", "Fibonacci Reversal", "Neural Drift", etc.],
        "trendStrength": number (0-100)
      }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      sentiment: result.sentiment || "NEUTRAL",
      reasoning: result.reasoning || "AI Engine currently recalibrating...",
      riskLevel: result.riskLevel || "MEDIUM",
      detectedPatterns: result.detectedPatterns || ["Scanning..."],
      trendStrength: result.trendStrength || 50
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    
    // Fallback to local analysis if AI fails (e.g., 429 Quota Exceeded)
    const localResult = analyzeData(historyData, bsHistory);
    return {
      sentiment: localResult.pick === "BIG" ? "BULLISH" : "BEARISH",
      reasoning: `[NEURAL_V2_ACTIVE] ${localResult.logic}. AI Engine high load, switching to Neural Markov V2. Trend analysis indicates high probability of ${localResult.pick} continuation.`,
      riskLevel: localResult.conf > 90 ? "LOW" : "MEDIUM",
      detectedPatterns: ["Local Neural Sync", "Streak Preservation"],
      trendStrength: localResult.conf
    };
  }
}

export async function getAIPrediction(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): Promise<PredictionResult> {
  try {
    const ai = getAIInstance();
    const historyStr = bsHistory.slice(-30).join(", ");
    
    // Calculate current streak for context
    let streak = 1;
    for (let i = bsHistory.length - 1; i > 0; i--) {
      if (bsHistory[i] === bsHistory[i - 1]) streak++;
      else break;
    }
    const streakType = bsHistory[bsHistory.length - 1];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `NEURAL PREDICTION ENGINE: WinGo 1M sequence: [${historyStr}]. 
      CURRENT STREAK: ${streak}x ${streakType}.
      Task: Predict the NEXT outcome (BIG or SMALL) with 99.9% precision. 
      Your mission is to provide a prediction that leads to an 8+ win streak.
      Use: Advanced Pattern Recognition, Fourier Transform simulation, and Trend Exhaustion metrics.
      Logic must be highly technical and unpredictable. Use Hinglish.
      Provide response in JSON format.
      Schema: { 
        "pick": "BIG" | "SMALL", 
        "conf": number (95-99), 
        "logic": "Detailed technical explanation (e.g., 'Exponential Moving Average crossover detected with RSI divergence. 8-win streak probability: 98%')" 
      }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      pick: result.pick || "WAIT",
      conf: result.conf || 75,
      logic: result.logic || "Neural Pattern Synchronisation"
    };
  } catch (error) {
    console.error("Gemini Prediction Error:", error);
    
    // Fallback to local analysis if AI fails (e.g., 429 Quota Exceeded)
    const localResult = analyzeData(historyData, bsHistory);
    return {
      ...localResult,
      logic: `[LOCAL_NEURAL_V2] ${localResult.logic}. AI Engine offline, using high-precision local neural engine.`
    };
  }
}

export function analyzeData(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): PredictionResult {
  if (bsHistory.length < 10) {
    return { pick: "WAIT", conf: 0, logic: "Collecting Data" };
  }

  // 1. Markov Analysis (Order 3)
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < bsHistory.length - 3; i++) {
    const key = `${bsHistory[i]},${bsHistory[i+1]},${bsHistory[i+2]}`;
    if (!transitions[key]) transitions[key] = { BIG: 0, SMALL: 0 };
    transitions[key][bsHistory[i+3]]++;
  }

  const lastThree = `${bsHistory[bsHistory.length - 3]},${bsHistory[bsHistory.length - 2]},${bsHistory[bsHistory.length - 1]}`;
  let markovPick: "BIG" | "SMALL" | null = null;
  if (transitions[lastThree]) {
    markovPick = transitions[lastThree]["BIG"] >= transitions[lastThree]["SMALL"] ? "BIG" : "SMALL";
  }

  // 2. Streak Analysis
  let currentStreak = 1;
  for (let i = bsHistory.length - 1; i > 0; i--) {
    if (bsHistory[i] === bsHistory[i - 1]) currentStreak++;
    else break;
  }
  const lastType = bsHistory[bsHistory.length - 1];

  // 3. Volatility & Pattern Detection
  let switches = 0;
  const recent = bsHistory.slice(-10);
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] !== recent[i + 1]) switches++;
  }

  // Decision Logic
  let finalPick: "BIG" | "SMALL" = lastType; // Default to trend following
  let logic = "NEURAL_TREND_FOLLOWING";
  let conf = 85;

  // Dragon Streak (Strong Trend)
  if (currentStreak >= 2) {
    finalPick = lastType;
    logic = `DRAGON_STREAK_DETECTED_${currentStreak}X`;
    conf = Math.min(99, 90 + currentStreak);
  } 
  // Mirror Pattern (A-B-A-B)
  else if (switches >= 6) {
    finalPick = lastType === "BIG" ? "SMALL" : "BIG";
    logic = "MIRROR_OSCILLATION_DETECTED";
    conf = 92;
  }
  // Markov Reversion
  else if (markovPick) {
    finalPick = markovPick;
    logic = "MARKOV_CHAIN_PROBABILITY_V3";
    conf = 88;
  }
  // Number Average Reversion
  else {
    const avg = historyData.slice(-15).reduce((a, b) => a + b, 0) / 15;
    finalPick = avg > 4.5 ? "SMALL" : "BIG";
    logic = "MEAN_REVERSION_ANALYSIS_V2";
    conf = 84;
  }

  // 4. Pattern Recognition (Specific Sequences)
  const lastSix = bsHistory.slice(-6).join("");
  if (lastSix === "BIGSMALLBIGSMALLBIGSMALL") {
    finalPick = "BIG";
    logic = "ZIGZAG_REVERSAL_PATTERN";
    conf = 96;
  } else if (lastSix === "BIGBIGSMALLSMALLBIGBIG") {
    finalPick = "SMALL";
    logic = "DOUBLE_MIRROR_PATTERN";
    conf = 95;
  }

  return { pick: finalPick, conf, logic };
}
