import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, TrendingUp, ShieldCheck, History, Zap, AlertCircle, BrainCircuit, BarChart3, Info, ListOrdered, X, Settings, Key } from "lucide-react";
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
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [tempApiKey, setTempApiKey] = useState<string>("");

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
    const insight = await getAIInsights(bsHistory, userApiKey);
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
    const result = await getAIPrediction(bsHistory, userApiKey);
    setPrediction(result);
    
    if (result.pick !== "WAIT") {
      predictionHistoryRef.current[nextP] = result.pick;
      addFeed(`AI Prediction: ${result.pick} (${result.conf}%)`, "text-cyan-400");
    } else {
      addFeed("AI Engine Busy. Retrying...", "text-amber-400");
    }
    setIsAnalyzing(false);
  };

  const saveApiKey = () => {
    localStorage.setItem("gemini_api_key", tempApiKey);
    setUserApiKey(tempApiKey);
    setShowSettingsModal(false);
    addFeed("API Key Updated Successfully", "text-emerald-400");
    // Trigger a new prediction with the new key if possible
    if (lastPeriod) getNewPrediction();
  };

  useEffect(() => {
    if (lastPeriod) {
      getNewPrediction();
    }
  }, [lastPeriod]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
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
              <button 
                onClick={() => {
                  setTempApiKey(userApiKey);
                  setShowSettingsModal(true);
                }}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full border border-white/10 transition-colors group/btn"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-slate-400 group-hover/btn:text-cyan-400 transition-colors" />
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
          <div className="lg:col-span-7 space-y-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-10 text-center border border-white/10 shadow-2xl relative group"
            >
              <div className="absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              
              <div className="flex justify-between items-center mb-8">
                <span className="px-4 py-1.5 bg-slate-950/50 rounded-full text-[10px] font-black text-slate-400 tracking-widest border border-white/5">
                  NEXT PERIOD: {nextPeriod ? nextPeriod.slice(-3) : "---"}
                </span>
                <div className="flex items-center gap-2">
                  <Zap className={`w-3 h-3 text-yellow-500 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span className="text-[10px] font-bold text-yellow-500/80 uppercase tracking-widest">AI Prediction Active</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={prediction.pick}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={`text-9xl font-black mb-8 italic tracking-tighter transition-all duration-500 ${
                    prediction.pick === "BIG" ? "text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]" : 
                    prediction.pick === "SMALL" ? "text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.4)]" : 
                    "text-slate-700"
                  }`}
                >
                  {prediction.pick}
                </motion.div>
              </AnimatePresence>

              <div className="grid grid-cols-2 gap-8 mt-10 border-t border-white/5 pt-8">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Confidence Score</span>
                  </div>
                  <div className="text-4xl font-black text-white tabular-nums">{prediction.conf}%</div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${prediction.conf}%` }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-2 border-l border-white/5">
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Logic</span>
                  </div>
                  <div className="text-sm font-black text-cyan-400 uppercase tracking-wider h-10 flex items-center justify-center text-center px-4">
                    {prediction.logic}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Wins", value: stats.wins, color: "text-emerald-400", icon: Zap },
                { label: "Total Losses", value: stats.losses, color: "text-rose-400", icon: AlertCircle },
                { label: "Accuracy", value: `${accuracy}%`, color: "text-white", icon: Activity }
              ].map((stat, i) => (
                <div key={i} className="bg-slate-900/50 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-lg text-center group hover:border-white/20 transition-colors">
                  <stat.icon className="w-4 h-4 text-slate-600 mx-auto mb-2 group-hover:text-cyan-400 transition-colors" />
                  <div className={`text-2xl font-black ${stat.color} tabular-nums`}>{stat.value}</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Section */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* AI Insights Card */}
            <div className="bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit className="w-20 h-20 text-cyan-500" />
              </div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Google Gemini Analysis</h3>
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
                      <span className={`text-[10px] font-bold tracking-widest ${
                        aiInsight.riskLevel === "LOW" ? "text-emerald-400" : 
                        aiInsight.riskLevel === "MEDIUM" ? "text-amber-400" : "text-rose-400"
                      }`}>
                        RISK: {aiInsight.riskLevel}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Trend Strength</div>
                      <div className="text-xs font-black text-cyan-400">{aiInsight.trendStrength}%</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Detected Patterns</div>
                    <div className="flex flex-wrap gap-2">
                      {aiInsight.detectedPatterns.map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-950/50 border border-white/5 rounded-md text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed font-medium italic border-l-2 border-cyan-500/30 pl-4">
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
                  <ListOrdered className="w-3 h-3" />
                  History
                </button>
              </div>
            </div>

            {/* Visual History Chart */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volatility Index</h3>
                </div>
                <div className="flex gap-1">
                  {bsHistory.slice(-10).map((bs, i) => (
                    <div 
                      key={i} 
                      className={`w-2 h-2 rounded-full ${bs === 'BIG' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} 
                      title={bs}
                    />
                  ))}
                </div>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                      itemStyle={{ color: '#06b6d4' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#06b6d4" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Real-time Feed */}
            <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-xl h-48 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-slate-500" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Logs</h3>
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
                      <span className="opacity-30 tracking-tighter">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
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

      {/* Settings Modal */}
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
                  <Settings className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-black text-white uppercase tracking-widest">Configuration</h2>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <Key className="w-3 h-3" />
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                      placeholder="Enter your API key here..."
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 leading-relaxed">
                    Your API key is stored locally in your browser. It is used to power the AI predictions and deep analysis features.
                  </p>
                </div>

                <div className="bg-cyan-500/5 border border-cyan-500/10 p-4 rounded-2xl">
                  <div className="flex gap-3">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    <p className="text-[10px] text-cyan-400/80 leading-relaxed font-medium">
                      If left empty, the system will attempt to use the default server-side key.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={saveApiKey}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98]"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
