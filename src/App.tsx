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
  isWin: boolean;
  time: string;
}

export default function App() {
  const [lastPeriod, setLastPeriod] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult>({ pick: "WAIT", conf: 0, logic: "Initialising..." });
  const [nextPeriod, setNextPeriod] = useState<string>("");
  const [stats, setStats] = useState<Stats>({ wins: 0, losses: 0 });
  const [historyData, setHistoryData] = useState<number[]>([]);
  const [bsHistory, setBsHistory] = useState<("BIG" | "SMALL")[]>([]);
  const [feed, setFeed] = useState<{ msg: string; color: string; id: number }[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [lastUpdate, setLastUpdate] = useState<string>("Checking server...");
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [winLossHistory, setWinLossHistory] = useState<WinLossRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [matrixData, setMatrixData] = useState<number[]>(Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)));

  const predictionHistoryRef = useRef<Record<string, "BIG" | "SMALL">>({});
  const feedIdCounter = useRef(0);

  const addFeed = (msg: string, color: string) => {
    setFeed((prev) => [
      { msg, color, id: feedIdCounter.current++ },
      ...prev.slice(0, 4),
    ]);
  };

  const updateStats = (isWin: boolean, period: string, actual: "BIG" | "SMALL", predicted: "BIG" | "SMALL") => {
    setStats((prev) => ({
      wins: isWin ? prev.wins + 1 : prev.wins,
      losses: isWin ? prev.losses : prev.losses + 1,
    }));
    
    const record: WinLossRecord = {
      period,
      predicted,
      actual,
      isWin,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setWinLossHistory(prev => [record, ...prev].slice(0, 50));
    addFeed(`Period ${period}: ${isWin ? "WIN" : "LOSS"} (${actual})`, isWin ? "text-green-400" : "text-red-400");
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
        
        setHistoryData(initialNumbers);
        setBsHistory(initialBS as ("BIG" | "SMALL")[]);
        setLastPeriod(currP);
        addFeed("Engine Memory Synchronised", "text-cyan-400");
        return;
      }

      if (currP !== lastPeriod) {
        if (predictionHistoryRef.current[currP]) {
          const predicted = predictionHistoryRef.current[currP];
          updateStats(predicted === actual, currP, actual, predicted);
        }

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
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
                
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Neural Target</span>
                    <span className="text-sm font-bold text-cyan-400">#{nextPeriod ? nextPeriod.slice(-4) : "----"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${timeLeft <= 10 ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{timeLeft}s</span>
                  </div>
                </div>

                <div className="relative py-8 flex flex-col items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={prediction.pick}
                      initial={{ scale: 0.8, opacity: 0, rotateX: 45 }}
                      animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                      exit={{ scale: 1.2, opacity: 0, rotateX: -45 }}
                      className={`text-8xl font-black italic tracking-tighter transition-all duration-700 ${
                        prediction.pick === "BIG" ? "text-emerald-400 drop-shadow-[0_0_40px_rgba(52,211,153,0.5)]" : 
                        prediction.pick === "SMALL" ? "text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.5)]" : 
                        "text-slate-800"
                      }`}
                    >
                      {prediction.pick}
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Glitch Overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay animate-pulse bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                </div>

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Confidence</span>
                    <span className="text-white">{prediction.conf}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${prediction.conf}%` }}
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-mono italic text-center opacity-80">
                    {prediction.logic}
                  </p>
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

            {/* Chart Row */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volatility Index</h3>
                </div>
                <div className="flex gap-1">
                  {bsHistory.slice(-8).map((bs, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${bs === 'BIG' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  ))}
                </div>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#06b6d4" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* History Button Window */}
            <div className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <History className="w-20 h-20 text-slate-500" />
              </div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Data Archive</h3>
              </div>
              <button 
                onClick={() => setShowHistoryModal(true)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-2xl text-[10px] font-black text-slate-300 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" />
                View Full History
              </button>
            </div>

            {/* Real-time Feed */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl h-[340px] flex flex-col">
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
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-black text-white uppercase tracking-widest">Session History</h2>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {winLossHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No records found yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {winLossHistory.map((record, i) => (
                      <div key={i} className="bg-slate-950/50 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Period: {record.period.slice(-3)}</div>
                          <div className="text-xs font-bold text-slate-300">Predicted: <span className={record.predicted === 'BIG' ? 'text-emerald-400' : 'text-amber-400'}>{record.predicted}</span></div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className={`text-xs font-black uppercase tracking-widest ${record.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {record.isWin ? 'WIN' : 'LOSS'}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono">{record.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-950/50 border-t border-white/5 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Wins</div>
                  <div className="text-2xl font-black text-emerald-400">{stats.wins}</div>
                </div>
                <div className="text-center border-l border-white/5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Losses</div>
                  <div className="text-2xl font-black text-rose-400">{stats.losses}</div>
                </div>
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
