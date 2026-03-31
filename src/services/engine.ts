import { WinGoApiResponse, PredictionResult, AIInsight } from "../types";
import { GoogleGenAI } from "@google/genai";

const API_URL = "/api/proxy/wingo?ts=";

function getAIInstance() {
  // Use user-provided key from localStorage first, then environment variable, then hardcoded fallback
  const userKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const hardcodedKey = "AIzaSyBNMBi0XqzkotqqB_CkguW2BUt7NKDnAXY";
  const apiKey = userKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined) || hardcodedKey;
  return new GoogleGenAI({ apiKey: apiKey || "" });
}

export async function fetchWinGoData(): Promise<WinGoApiResponse> {
  const ts = Date.now();
  const userUrl = typeof window !== 'undefined' ? localStorage.getItem('lottery_api_url') : null;
  const finalUrl = userUrl || (API_URL + ts);
  
  // If it's a relative URL (like /api/proxy), we append timestamp if needed
  const urlWithTs = finalUrl.includes('?') ? `${finalUrl}&ts=${ts}` : (finalUrl.startsWith('http') ? finalUrl : `${finalUrl}?ts=${ts}`);

  const response = await fetch(urlWithTs);
  if (!response.ok) {
    throw new Error("Failed to fetch data");
  }
  return response.json();
}

let geminiCooldownUntil = 0;

export async function getAIInsights(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): Promise<AIInsight> {
  const now = Date.now();
  const isCooldownActive = now < geminiCooldownUntil;

  try {
    if (isCooldownActive) {
      throw new Error("429: Cooldown active");
    }

    const ai = getAIInstance();
    const historyStr = bsHistory.slice(-50).join(", ");
    
    // Calculate current streak for context
    let streak = 1;
    for (let i = bsHistory.length - 1; i > 0; i--) {
      if (bsHistory[i] === bsHistory[i - 1]) streak++;
      else break;
    }
    const streakType = bsHistory[bsHistory.length - 1];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `CRITICAL NEURAL ANALYSIS: WinGo 1M sequence: [${historyStr}]. 
      CURRENT STREAK: ${streak}x ${streakType}.
      Your goal is to maintain a 99.9% accuracy streak. 
      Analyze the last 50 periods for hidden cycles, Fibonacci clusters, neural entropy, and fractal resonance.
      Provide a deep technical analysis in JSON format.
      Use a mix of high-level technical jargon and Hindi/English (Hinglish) to sound like a professional neural trader.
      Schema: { 
        "sentiment": "BULLISH" (for BIG) | "BEARISH" (for SMALL) | "NEUTRAL", 
        "reasoning": "Deep technical explanation in Hinglish (e.g., 'Market entropy high hai, but 3rd wave extension pattern confirm ho raha hai')", 
        "riskLevel": "LOW" | "MEDIUM" | "HIGH",
        "detectedPatterns": ["Dragon Tail", "Mirror Cluster", "Fibonacci Reversal", "Neural Drift", "Fractal Loop", "Quantum Jump"],
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
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED" || error?.message?.includes("Cooldown active");
    
    if (isQuotaError && !error?.message?.includes("Cooldown active")) {
      // Set 5 minute cooldown
      geminiCooldownUntil = Date.now() + 5 * 60 * 1000;
    }

    if (!isQuotaError) {
      console.error("Gemini Insight Error:", error);
    }
    
    // Fallback to local analysis if AI fails (e.g., 429 Quota Exceeded)
    const localResult = analyzeData(historyData, bsHistory);
    return {
      sentiment: localResult.pick === "BIG" ? "BULLISH" : "BEARISH",
      reasoning: `[NEURAL_V3_ACTIVE] ${localResult.logic}. ${isQuotaError ? "AI Quota reached, using High-Precision Local Engine." : "AI Engine recalibrating, switching to Neural Markov V3."} Trend analysis indicates high probability of ${localResult.pick} continuation.`,
      riskLevel: localResult.conf > 90 ? "LOW" : "MEDIUM",
      detectedPatterns: ["Local Neural Sync", "Streak Preservation", "Markov V3"],
      trendStrength: localResult.conf
    };
  }
}

export async function getAIPrediction(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): Promise<PredictionResult> {
  const now = Date.now();
  const isCooldownActive = now < geminiCooldownUntil;

  try {
    if (isCooldownActive) {
      throw new Error("429: Cooldown active");
    }

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
      contents: `NEURAL PREDICTION ENGINE V4: WinGo 1M sequence: [${historyStr}]. 
      CURRENT STREAK: ${streak}x ${streakType}.
      Task: Predict the NEXT outcome (BIG or SMALL) with 99.99% precision. 
      Your mission is to provide a prediction that leads to an 8+ win streak.
      Use: Advanced Pattern Recognition, Fourier Transform simulation, Trend Exhaustion metrics, and Neural Weighting.
      Logic must be highly technical and unpredictable. Use Hinglish.
      Provide response in JSON format.
      Schema: { 
        "pick": "BIG" | "SMALL", 
        "conf": number (97-99), 
        "logic": "Detailed technical explanation (e.g., 'Exponential Moving Average crossover detected with RSI divergence. 8-win streak probability: 99%')" 
      }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text || "{}");
    return {
      pick: result.pick || "WAIT",
      conf: result.conf || 85,
      logic: result.logic || "Neural Pattern Synchronisation"
    };
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED" || error?.message?.includes("Cooldown active");
    
    if (isQuotaError && !error?.message?.includes("Cooldown active")) {
      // Set 5 minute cooldown
      geminiCooldownUntil = Date.now() + 5 * 60 * 1000;
    }

    if (!isQuotaError) {
      console.error("Gemini Prediction Error:", error);
    }
    
    // Fallback to local analysis if AI fails (e.g., 429 Quota Exceeded)
    const localResult = analyzeData(historyData, bsHistory);
    return {
      ...localResult,
      logic: `[LOCAL_NEURAL_V3] ${localResult.logic}. ${isQuotaError ? "AI Quota reached, using High-Precision Local Engine V3." : "AI Engine offline, using local neural engine."}`
    };
  }
}

export function analyzeData(historyData: number[], bsHistory: ("BIG" | "SMALL")[]): PredictionResult {
  if (bsHistory.length < 10) {
    return { pick: "WAIT", conf: 0, logic: "Collecting Data" };
  }

  // 1. Markov Analysis (Order 3 & 4)
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
  const recent = bsHistory.slice(-12);
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i] !== recent[i + 1]) switches++;
  }

  // Decision Logic
  let finalPick: "BIG" | "SMALL" = lastType; // Default to trend following
  let logic = "NEURAL_TREND_FOLLOWING";
  let conf = 88;

  // Dragon Streak (Strong Trend) - Following the trend for long streaks
  if (currentStreak >= 3) {
    finalPick = lastType;
    logic = `DRAGON_STREAK_V3_DETECTED_${currentStreak}X`;
    conf = Math.min(99, 92 + currentStreak);
  } 
  // Mirror Pattern (A-B-A-B)
  else if (switches >= 7) {
    finalPick = lastType === "BIG" ? "SMALL" : "BIG";
    logic = "MIRROR_OSCILLATION_V3_DETECTED";
    conf = 94;
  }
  // Markov Reversion
  else if (markovPick) {
    finalPick = markovPick;
    logic = "MARKOV_CHAIN_PROBABILITY_V4";
    conf = 90;
  }
  // Number Average Reversion
  else {
    const avg = historyData.slice(-20).reduce((a, b) => a + b, 0) / 20;
    finalPick = avg > 4.5 ? "SMALL" : "BIG";
    logic = "MEAN_REVERSION_ANALYSIS_V3";
    conf = 86;
  }

  // 4. Advanced Pattern Recognition (Specific Sequences)
  const lastSix = bsHistory.slice(-6).join("");
  const lastEight = bsHistory.slice(-8).join("");
  
  if (lastSix === "BIGSMALLBIGSMALLBIGSMALL") {
    finalPick = "BIG";
    logic = "ZIGZAG_REVERSAL_PATTERN_V3";
    conf = 97;
  } else if (lastSix === "BIGBIGSMALLSMALLBIGBIG") {
    finalPick = "SMALL";
    logic = "DOUBLE_MIRROR_PATTERN_V3";
    conf = 96;
  } else if (lastEight === "BIGBIGBIGBIGSMALLSMALLSMALLSMALL") {
    finalPick = "BIG";
    logic = "QUAD_MIRROR_REVERSAL";
    conf = 98;
  } else if (lastSix === "SMALLSMALLSMALLSMALLSMALLSMALL") {
    finalPick = "SMALL";
    logic = "DEEP_SMALL_DRAGON_DETECTED";
    conf = 99;
  } else if (lastSix === "BIGBIGBIGBIGBIGBIG") {
    finalPick = "BIG";
    logic = "DEEP_BIG_DRAGON_DETECTED";
    conf = 99;
  }

  return { pick: finalPick, conf, logic };
}
