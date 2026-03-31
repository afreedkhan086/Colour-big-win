export interface AIInsight {
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  reasoning: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  detectedPatterns: string[];
  trendStrength: number;
}

export interface WinGoHistoryItem {
  issueNumber: string;
  number: string;
  color: string;
  premium: string;
}

export interface WinGoApiResponse {
  code: number;
  msg: string;
  data: {
    list: WinGoHistoryItem[];
    pageNo: number;
    pageSize: number;
    totalCount: number;
    totalPage: number;
  };
}

export interface PredictionResult {
  pick: "BIG" | "SMALL" | "WAIT";
  conf: number;
  logic: string;
}

export interface Stats {
  wins: number;
  losses: number;
}
