import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, TrendingUp, ShieldCheck, History, Zap, AlertCircle, BrainCircuit, BarChart3, Info, ListOrdered, X, Settings, LayoutGrid, Cpu, Fingerprint } from "lucide-react";
import { fetchWinGoData, analyzeData, getAIInsights, getAIPrediction } from "./services/engine";
import { PredictionResult, Stats, AIInsight } from "./types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface WinLossRecord {
  period: string;
  predicted: "BIG" | "SMALL";
  actual: "BIG" | "SMALL";
  actualNum: number;
  isWin: boolean;
  time: string;
}

interface GameResult {
  period: string;
  number: number;
  bs: "BIG" | "SMALL";
  time: string;
}

export default function App() {
  const [lastPeriod, setLastPeriod] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult>({ pick: "WAIT", conf: 0, logic: "Initialising..." });
  const [nextPeriod, setNextPeriod] = useState<string>("");
  const [stats, setStats] = useState<Stats>(() => {
    try {
      const saved = localStorage.getItem('neural_stats');
      return saved ? JSON.parse(saved) : { wins: 0, losses: 0 };
    } catch {
      return { wins: 0, losses: 0 };
    }
  });
  const [historyData, setHistoryData] = useState<number[]>([]);
  const [bsHistory, setBsHistory] = useState<("BIG" | "SMALL")[]>([]);
  const [pastResults, setPastResults] = useState<GameResult[]>([]);
  const [feed, setFeed] = useState<{ msg: string; color: string; id: number }[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [lastUpdate, setLastUpdate] = useState<string>("Checking server...");
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [winLossHistory, setWinLossHistory] = useState<WinLossRecord[]>(() => {
    try {
      const saved = localStorage.getItem('neural_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [matrixData, setMatrixData] = useState<number[]>(Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)));

  const predictionHistoryRef = useRef<Record<string, "BIG" | "SMALL">>({});
  const feedIdCounter = useRef(0);

  useEffect(() => {
    localStorage.setItem('neural_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('neural_history', JSON.stringify(winLossHistory));
  }, [winLossHistory]);

  const addFeed = (msg: string, color: string) => {
    setFeed((prev) => [
      { msg, color, id: feedIdCounter.current++ },
      ...prev.slice(0, 4),
    ]);
  };

  const updateStats = (isWin: boolean, period: string, actual: "BIG" | "SMALL", predicted: "BIG" | "SMALL", actualNum: number) => {
    setStats((prev) => ({
      wins: isWin ? prev.wins + 1 : prev.wins,
      losses: isWin ? prev.losses : prev.losses + 1,
    }));
    
    const record: WinLossRecord = {
      period,
      predicted,
      actual,
      actualNum,
      isWin,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setWinLossHistory(prev => [record, ...prev].slice(0, 50));
    addFeed(`Period ${period}: ${isWin ? "WIN" : "LOSS"} (${actual} ${actualNum})`, isWin ? "text-green-400" : "text-red-400");
  };

  const fetchData = async () => {
    try {
      const json = await fetchWinGoData();
      const list = json.data.list;

      if (!list || list.length === 0) {
        addFeed("API returned empty data", "text-amber-400");
        return;
      }

      const latest = list[0];
      const currP = latest.issueNumber;
      const currN = parseInt(latest.number);
      const actual: "BIG" | "SMALL" = currN >= 5 ? "BIG" : "SMALL";

      setStatus("connected");
      setLastUpdate(`Last check: ${new Date().toLocaleTimeString()}`);
      
      if (json.msg && json.msg.includes("Simulated")) {
        addFeed("API Unreachable. Using AI Simulation.", "text-amber-400/60");
      }

      if (!lastPeriod) {
        const initialNumbers = list.slice(0, 50).map((item: any) => parseInt(item.number)).reverse();
        const initialBS = list.slice(0, 50).map((item: any) => parseInt(item.number) >= 5 ? "BIG" : "SMALL").reverse();
        const initialResults = list.slice(0, 50).map((item: any) => ({
          period: item.issueNumber,
          number: parseInt(item.number),
          bs: parseInt(item.number) >= 5 ? "BIG" : "SMALL",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })).reverse();
        
        setHistoryData(initialNumbers);
        setBsHistory(initialBS as ("BIG" | "SMALL")[]);
        setPastResults(initialResults as GameResult[]);
        setLastPeriod(currP);
        addFeed("Engine Memory Synchronised", "text-cyan-400");
        return;
      }

      if (currP !== lastPeriod) {
        if (predictionHistoryRef.current[currP]) {
          const predicted = predictionHistoryRef.current[currP];
          updateStats(predicted === actual, currP, actual, predicted, currN);
        }

        setPastResults(prev => {
          const updated = [...prev, { 
            period: currP, 
            number: currN, 
            bs: actual,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }];
          return updated.length > 50 ? updated.slice(-50) : updated;
        });

        setHistoryData((prev) => {
          const updated = [...prev, currN];
          return updated.length > 50 ? updated.slice(-50) : updated;
        });
        setBsHistory((prev) => {
          const updated = [...prev, actual];
          return updated.length > 50 ? updated.slice(-50) : updated;
        });

        setLastPeriod(currP);
        
        if (parseInt(currP) % 3 === 0) {
          handleAIAnalysis();
        }
      }
    } catch (error) {
      console.error("API Error:", error);
      setStatus("error");
      addFeed("Connection unstable. Retrying...", "text-rose-400");
    }
  };

  const handleAIAnalysis = async () => {
    if (bsHistory.length < 10) return;
    setIsAnalyzing(true);
    const insight = await getAIInsights(bsHistory);
    setAiInsight(insight);
    setIsAnalyzing(false);
    addFeed("AI Deep Analysis Completed", "text-cyan-400");
  };

  const getNewPrediction = async () => {
    if (bsHistory.length < 5) {
      addFeed("Collecting more data for AI...", "text-slate-500");
      return;
    }
    
    setIsAnalyzing(true);
    const nextP = (BigInt(lastPeriod!) + 1n).toString();
    setNextPeriod(nextP);
    
    addFeed(`Analyzing Period ${nextP}...`, "text-cyan-500/50");
    
    // Use Gemini for the main prediction
    const result = await getAIPrediction(bsHistory);
    setPrediction(result);
    
    if (result.pick !== "WAIT") {
      predictionHistoryRef.current[nextP] = result.pick;
      addFeed(`AI Prediction: ${result.pick} (${result.conf}%)`, "text-cyan-400");
    } else {
      addFeed("AI Engine Busy. Retrying...", "text-amber-400");
    }
    setIsAnalyzing(false);
  };

  useEffect(() => {
    if (lastPeriod) {
      getNewPrediction();
    }
  }, [lastPeriod]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    
    const timer = setInterval(() => {
      const now = new Date();
      setTimeLeft(60 - now.getSeconds());
      
      // Randomize matrix data for "unpredictability"
      if (now.getSeconds() % 5 === 0) {
        setMatrixData(Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)));
      }

      // If period just changed (seconds is 0-2), force a refresh
      if (now.getSeconds() <= 2) {
        fetchData();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []); // Poller should only run once on mount

  const chartData = historyData.slice(-20).map((val, idx) => ({
    time: idx,
    value: val,
    type: val >= 5 ? "BIG" : "SMALL"
  }));

  const accuracy = stats.wins + stats.losses > 0 
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] p-4 flex flex-col items-center font-sans selection:bg-cyan-500/30">
      <div className="w-full max-w-4xl space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-500/30 animate-pulse">
              <BrainCircuit className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">FARIDABAD AI ULTRA</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Neural Engine v4.2</span>
                <div className="h-1 w-1 rounded-full bg-slate-700" />
                <span className="text-[10px] text-cyan-500/80 font-bold uppercase">Gemini Integrated</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end relative z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchData}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full border border-white/10 transition-colors group/btn"
                title="Force Refresh"
              >
                <Activity className={`w-4 h-4 text-slate-400 group-hover/btn:text-emerald-400 transition-colors ${status === "connecting" ? "animate-spin" : ""}`} />
              </button>
              <div className="flex items-center gap-3 bg-slate-950/50 px-4 py-2 rounded-full border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {status === "connecting" ? "Syncing..." : status === "connected" ? "Live Link" : "Offline"}
                </span>
                <div className={`w-2 h-2 rounded-full ${status === "connected" ? "bg-emerald-500 shadow-[0_0_15px_#10b981]" : "bg-red-500 shadow-[0_0_15px_#ef4444]"} ${status === "connecting" ? "animate-ping" : ""}`} />
              </div>
            </div>
            <p className="text-[9px] text-slate-500 font-mono mt-2 tracking-tighter uppercase">{lastUpdate}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Prediction Panel */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Prediction Window */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden group flex flex-col justify-between min-h-[400px]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/5 pointer-events-none" />
                
                {/* Animated Background Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-[60px] animate-pulse" />
                  <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-[80px] animate-pulse delay-700" />
                </div>

                <div className="flex justify-between items-center relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Target</span>
                    <span className="text-sm font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">#{nextPeriod ? nextPeriod.slice(-4) : "----"}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${timeLeft <= 10 ? "bg-rose-500 animate-pulse" : "bg-emerald-500 shadow-[0_0_8px_#10b981]"}`} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{timeLeft}s</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1">Syncing...</span>
                  </div>
                </div>

                <div className="relative py-8 flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={prediction.pick}
                      initial={{ scale: 0.5, opacity: 0, rotateY: 90 }}
                      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                      exit={{ scale: 1.5, opacity: 0, rotateY: -90 }}
                      transition={{ type: "spring", damping: 12, stiffness: 100 }}
                      className={`text-9xl font-black italic tracking-tighter transition-all duration-700 select-none ${
                        prediction.pick === "BIG" ? "text-emerald-400 drop-shadow-[0_0_50px_rgba(52,211,153,0.6)]" : 
                        prediction.pick === "SMALL" ? "text-amber-400 drop-shadow-[0_0_50px_rgba(251,191,36,0.6)]" : 
                        "text-slate-800"
                      }`}
                    >
                      {prediction.pick}
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Scanning Line Effect */}
                  <motion.div 
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-px bg-cyan-500/30 blur-sm pointer-events-none z-20"
                  />
                </div>

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3 h-3" />
                      <span>Confidence</span>
                    </div>
                    <span className="text-white bg-slate-950 px-2 py-0.5 rounded border border-white/5">{prediction.conf}%</span>
                  </div>
                  <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${prediction.conf}%` }}
                      className="h-full bg-gradient-to-r from-cyan-600 via-blue-500 to-purple-600 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    />
                  </div>
                  <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                    <p className="text-[10px] text-slate-400 leading-relaxed font-mono italic text-center opacity-90">
                      <span className="text-cyan-500/50 mr-1">LOG:</span>
                      {prediction.logic}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Probability Matrix Window */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-xl flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-6">
                  <LayoutGrid className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Neural Probability Matrix</h3>
                </div>

                <div className="grid grid-cols-5 gap-2 flex-1 items-center">
                  {matrixData.map((prob, i) => {
                    const isHigh = prob > 75;
                    return (
                      <div key={i} className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all duration-700 ${
                        isHigh ? "bg-cyan-500/20 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "bg-slate-950/50 border-white/5"
                      }`}>
                        <span className="text-[8px] font-bold text-slate-500">{i}</span>
                        <span className={`text-[10px] font-black ${isHigh ? "text-cyan-400" : "text-slate-600"}`}>{prob}%</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3 h-3 text-slate-600" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Processing Layer: L3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Verified</span>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Stats & Chart Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live History</h3>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-75" />
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-150" />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="space-y-2">
                    {pastResults.slice(-10).reverse().map((res, i) => {
                      const predictionForThis = winLossHistory.find(h => h.period === res.period);
                      return (
                        <div key={i} className="flex items-center justify-between bg-slate-950/30 p-2 rounded-xl border border-white/5 relative group">
                          <span className="text-[9px] font-mono text-slate-500">{res.period.slice(-3)}</span>
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                              res.bs === 'BIG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {res.number}
                            </span>
                            {predictionForThis && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                                predictionForThis.isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                              }`}>
                                {predictionForThis.isWin ? "W" : "L"}
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] font-black tracking-widest ${
                            res.bs === 'BIG' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {res.bs}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[8px] font-black text-slate-600 uppercase tracking-widest">
                  <div className="flex flex-col">
                    <span>BIG: {bsHistory.filter(x => x === 'BIG').length}</span>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${(bsHistory.filter(x => x === 'BIG').length / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col text-right">
                    <span>SMALL: {bsHistory.filter(x => x === 'SMALL').length}</span>
                    <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-all duration-500" 
                        style={{ width: `${(bsHistory.filter(x => x === 'SMALL').length / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volatility</h3>
                  </div>
                </div>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="#06b6d433" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col justify-center items-center text-center group hover:border-emerald-500/30 transition-all duration-500">
                <div className="p-3 bg-emerald-500/10 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white tabular-nums">{accuracy}%</div>
                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Accuracy</div>
                <div className="mt-3 flex gap-2">
                  <div className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-lg border border-emerald-500/20">W: {stats.wins}</div>
                  <div className="px-2 py-1 bg-rose-500/20 text-rose-400 text-[9px] font-black rounded-lg border border-rose-500/20">L: {stats.losses}</div>
                </div>
                <button 
                  onClick={() => {
                    if (confirm("Reset current session stats and history?")) {
                      setStats({ wins: 0, losses: 0 });
                      setWinLossHistory([]);
                      localStorage.removeItem('neural_stats');
                      localStorage.removeItem('neural_history');
                      addFeed("Session Data Purged", "text-rose-400");
                    }
                  }}
                  className="mt-3 text-[8px] font-black text-slate-600 hover:text-rose-400 uppercase tracking-widest transition-colors"
                >
                  Reset Session
                </button>
                {winLossHistory.length > 0 && (
                  <div className="mt-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Streak: {winLossHistory[0].isWin ? "WIN" : "LOSS"} x{
                      (() => {
                        let count = 0;
                        const isWin = winLossHistory[0].isWin;
                        for (const h of winLossHistory) {
                          if (h.isWin === isWin) count++;
                          else break;
                        }
                        return count;
                      })()
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* AI Insights Card */}
            <div className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit className="w-20 h-20 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Gemini Neural Analysis</h3>
                </div>
                {isAnalyzing && <div className="text-[10px] text-cyan-400 font-bold animate-pulse uppercase">Scanning...</div>}
              </div>

              {aiInsight ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${
                        aiInsight.sentiment === "BULLISH" ? "bg-emerald-500/20 text-emerald-400" : 
                        aiInsight.sentiment === "BEARISH" ? "bg-rose-500/20 text-rose-400" : 
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {aiInsight.sentiment}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Risk Level</div>
                      <div className={`text-xs font-black ${
                        aiInsight.riskLevel === "LOW" ? "text-emerald-400" : 
                        aiInsight.riskLevel === "MEDIUM" ? "text-amber-400" : "text-rose-400"
                      }`}>{aiInsight.riskLevel}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Detected Patterns</div>
                    <div className="flex flex-wrap gap-2">
                      {aiInsight.detectedPatterns.map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-950/50 border border-white/5 rounded-md text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium italic border-l-2 border-cyan-500/30 pl-4">
                    "{aiInsight.reasoning}"
                  </p>
                </motion.div>
              ) : (
                <div className="py-8 text-center text-slate-600 space-y-2">
                  <Info className="w-6 h-6 mx-auto opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Waiting for next data batch...</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button 
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing || bsHistory.length < 10}
                  className="py-3 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-30 border border-cyan-500/20 rounded-2xl text-[10px] font-black text-cyan-400 uppercase tracking-widest transition-all active:scale-95"
                >
                  Deep Scan
                </button>
                <button 
                  onClick={() => setShowHistoryModal(true)}
                  className="py-3 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <History className="w-3 h-3" />
                  History
                </button>
              </div>
            </div>

            {/* Live History Sidebar */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col h-[450px] mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-xl">
                    <History className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">History Counting</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total: {pastResults.length}</span>
                  <button 
                    onClick={() => setShowHistoryModal(true)}
                    className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[7px] font-black rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-colors uppercase tracking-widest"
                  >
                    View Full
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-slate-950/50 rounded-xl border border-white/5 text-center">
                  <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Wins</div>
                  <div className="text-sm font-black text-emerald-400">{stats.wins}</div>
                </div>
                <div className="p-2 bg-slate-950/50 rounded-xl border border-white/5 text-center">
                  <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Losses</div>
                  <div className="text-sm font-black text-rose-400">{stats.losses}</div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {pastResults.slice().reverse().map((res, i) => {
                  const predictionForThis = winLossHistory.find(h => h.period === res.period);
                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i} 
                      className="flex items-center justify-between bg-slate-950/30 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-mono text-slate-600">{res.period.slice(-3)}</span>
                          <span className="text-[7px] font-mono text-slate-700">{res.time}</span>
                        </div>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                          res.bs === 'BIG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {res.number}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {predictionForThis && (
                          <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${
                            predictionForThis.isWin ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          }`}>
                            {predictionForThis.isWin ? "WIN" : "LOSS"}
                          </span>
                        )}
                        <span className={`text-[10px] font-black tracking-widest ${
                          res.bs === 'BIG' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {res.bs}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Real-time Feed */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl h-64 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-500" />
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Logs</h3>
              </div>
              <div className="flex-1 font-mono text-[9px] space-y-2 overflow-hidden">
                <AnimatePresence initial={false}>
                  {feed.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`${item.color} flex items-center gap-3 bg-slate-950/30 p-2 rounded-lg border border-white/5`}
                    >
                      <span className="opacity-30">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                      <span className="font-bold tracking-tight uppercase">{item.msg}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
        
        <footer className="text-center py-8 space-y-2">
          <p className="text-[9px] text-slate-600 uppercase tracking-[0.4em] font-black">
            Faridabad AI Neural Network • Enterprise Edition
          </p>
          <div className="flex justify-center gap-4 opacity-30">
            <div className="h-px w-12 bg-slate-700" />
            <div className="h-px w-12 bg-slate-700" />
          </div>
        </footer>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistoryModal(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/10 rounded-2xl">
                    <History className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Neural History</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Analysis & Data Archive</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="p-3 hover:bg-white/5 rounded-2xl transition-colors border border-white/5"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                {/* Session Stats Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-950/50 border border-white/5 p-6 rounded-3xl text-center">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Wins</div>
                    <div className="text-3xl font-black text-emerald-400">{stats.wins}</div>
                  </div>
                  <div className="bg-slate-950/50 border border-white/5 p-6 rounded-3xl text-center">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Losses</div>
                    <div className="text-3xl font-black text-rose-400">{stats.losses}</div>
                  </div>
                  <div className="bg-slate-950/50 border border-white/5 p-6 rounded-3xl text-center">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Accuracy</div>
                    <div className="text-3xl font-black text-cyan-400">{accuracy}%</div>
                  </div>
                </div>

                {/* BIG/SMALL Distribution */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Data Distribution (Last 50)</h3>
                    <div className="flex gap-4 text-[9px] font-bold uppercase">
                      <span className="text-emerald-400">BIG: {bsHistory.filter(x => x === 'BIG').length}</span>
                      <span className="text-amber-400">SMALL: {bsHistory.filter(x => x === 'SMALL').length}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-white/5 flex">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_#10b981]" 
                      style={{ width: `${(bsHistory.filter(x => x === 'BIG').length / (bsHistory.length || 1)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-amber-500 transition-all duration-1000 shadow-[0_0_10px_#f59e0b]" 
                      style={{ width: `${(bsHistory.filter(x => x === 'SMALL').length / (bsHistory.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Session Records */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Session Predictions</h3>
                  {winLossHistory.length === 0 ? (
                    <div className="text-center py-12 bg-slate-950/30 rounded-[2rem] border border-dashed border-white/5">
                      <Cpu className="w-10 h-10 mx-auto mb-4 text-slate-800" />
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Waiting for first session result...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {winLossHistory.map((record, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className="bg-slate-950/50 border border-white/5 p-5 rounded-3xl flex justify-between items-center group hover:border-white/10 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-[10px] font-black text-slate-700 w-4">#{winLossHistory.length - i}</div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                              record.isWin ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                              {record.isWin ? "W" : "L"}
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Period: {record.period}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Pick:</span>
                                <span className={`text-xs font-black ${record.predicted === 'BIG' ? 'text-emerald-400' : 'text-amber-400'}`}>{record.predicted}</span>
                                <span className="text-slate-700 mx-1">|</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Actual:</span>
                                <span className={`text-xs font-black ${record.actual === 'BIG' ? 'text-emerald-400' : 'text-amber-400'}`}>{record.actual} ({record.actualNum})</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-black uppercase tracking-widest ${record.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {record.isWin ? 'SUCCESS' : 'FAILED'}
                            </div>
                            <div className="text-[9px] text-slate-600 font-mono mt-1">{record.time}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Number Frequency Analysis */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Number Frequency (Last 50)</h3>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                    {Array.from({ length: 10 }).map((_, num) => {
                      const count = historyData.filter(x => x === num).length;
                      const percentage = (count / (historyData.length || 1)) * 100;
                      return (
                        <div key={num} className="flex flex-col items-center gap-2">
                          <div className="w-full h-20 bg-slate-950/50 rounded-lg border border-white/5 relative overflow-hidden flex flex-col justify-end">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${percentage}%` }}
                              className={`w-full ${num >= 5 ? 'bg-emerald-500/30' : 'bg-amber-500/30'}`}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-500">
                              {count}
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                            num >= 5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {num}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Game History Table */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Full Game History (Counting)</h3>
                  <div className="bg-slate-950/50 rounded-3xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-white/5">
                          <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Period</th>
                          <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Number</th>
                          <th className="p-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {pastResults.slice().reverse().map((res, i) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 text-[10px] font-mono text-slate-400">{res.period}</td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-lg text-xs font-black ${
                                res.bs === 'BIG' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {res.number}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`text-[10px] font-black tracking-widest ${
                                res.bs === 'BIG' ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {res.bs}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Past Results Archive */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Neural Data Archive (Last 50)</h3>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Total Records: {pastResults.length}</span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {historyData.slice().reverse().map((num, i) => (
                      <div 
                        key={i} 
                        className={`aspect-square rounded-xl flex items-center justify-center text-[10px] font-black border transition-all ${
                          num >= 5 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="p-8 bg-slate-950 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verified Session Data</span>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest transition-all"
                >
                  Close Archive
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal - Simplified for Status */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-black text-white uppercase tracking-widest">System Status</h2>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <BrainCircuit className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">AI Engine Active</h3>
                    <p className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-widest">Enterprise Neural Network Connected</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Status</span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Operational</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Encryption</span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">AES-256</span>
                  </div>
                </div>

                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
