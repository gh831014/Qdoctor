import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  History, 
  Download, 
  Trash2, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileText,
  LayoutDashboard,
  ClipboardList,
  Search,
  ArrowRight,
  Menu,
  X,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { supabase, Member } from './lib/supabase';

import { AnalysisData, HistoryItem, ProblemType } from './types';
import { analyzeProblem, AnalysisConfig } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'process' | 'report'>('input');
  const [clarification, setClarification] = useState<string | null>(null);
  const [originalProblem, setOriginalProblem] = useState('');
  const [user, setUser] = useState<Member | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [config, setConfig] = useState<AnalysisConfig>({
    focus: 'default',
    depth: 'standard'
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('zhixi_member');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [user]);

  const handleLogin = async () => {
    if (!loginEmail.trim()) return;
    
    try {
      // Try to find existing user
      let { data, error } = await supabase
        .from('pm_members')
        .select('*')
        .eq('email', loginEmail)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // If not found, create new user
      if (!data) {
        const { data: newUser, error: createError } = await supabase
          .from('pm_members')
          .insert({ 
            email: loginEmail,
            name: loginEmail.split('@')[0],
            role: 'member',
            status: 'active'
          })
          .select()
          .single();
        
        if (createError) throw createError;
        data = newUser;
      }

      setUser(data);
      localStorage.setItem('zhixi_member', JSON.stringify(data));
      setIsLoginModalOpen(false);
      setLoginEmail('');
    } catch (err) {
      console.error('Login failed:', err);
      alert('登录失败，请重试');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('zhixi_member');
    setHistory([]);
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('analysis_history')
        .select('*')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const generateMarkdown = (data: AnalysisData, problem: string) => {
    let md = `# 问题分析报告: ${data.fiveWOneH.what}\n\n`;
    md += `## 原始问题\n${problem}\n\n`;
    
    md += `## 1. 5W1H 分析\n`;
    md += `- **WHAT**: ${data.fiveWOneH.what}\n`;
    md += `- **WHY**: ${data.fiveWOneH.why}\n`;
    md += `- **WHEN**: ${data.fiveWOneH.when}\n`;
    md += `- **WHO**: ${data.fiveWOneH.who}\n`;
    md += `- **WHERE**: ${data.fiveWOneH.where}\n`;
    md += `- **HOW**: ${data.fiveWOneH.how}\n\n`;

    md += `## 2. MECE 穷举\n`;
    data.exhaustion.forEach(cat => {
      md += `### ${cat.category}\n`;
      cat.elements.forEach(el => md += `- ${el}\n`);
      md += `\n`;
    });

    md += `## 3. 归纳法 (根因)\n`;
    md += `### 共同特征\n`;
    data.induction.commonalities.forEach(c => md += `- ${c}\n`);
    md += `\n### 核心根因\n`;
    data.induction.rootCauses.forEach(r => md += `- ${r}\n`);
    md += `\n`;

    md += `## 4. 演绎法 (解决方案)\n`;
    data.deduction.forEach(d => {
      md += `- **逻辑**: ${d.logic}\n  **方案**: ${d.solution}\n`;
    });
    md += `\n`;

    md += `## 5. 逻辑检查\n`;
    data.logicCheck.forEach(c => {
      md += `- [${c.passed ? 'x' : ' '}] ${c.item}${c.reason ? ` (${c.reason})` : ''}\n`;
    });
    md += `\n`;

    if (data.fiveWOneH.problemType === ProblemType.TASK && data.taskDecomposition && data.taskDecomposition.length > 0) {
      md += `## 6. 任务拆解 (PDCA)\n`;
      data.taskDecomposition.forEach(step => {
        md += `### ${step.step}\n`;
        step.tasks.forEach(t => md += `- **[${t.role}]**: ${t.action}\n`);
        md += `\n`;
      });
    }

    if (data.knowledgePoints && data.knowledgePoints.length > 0) {
      md += `## 核心知识点\n`;
      data.knowledgePoints.forEach(kp => {
        md += `### ${kp.name}\n`;
        md += `**概要**: ${kp.summary}\n\n`;
        kp.attributes.forEach(attr => {
          md += `- **${attr.label}**: ${attr.value}\n`;
        });
        md += `\n`;
      });
    }
    return md;
  };

  const handleAnalyze = async (problemText: string = input) => {
    if (!problemText.trim()) return;

    setIsAnalyzing(true);
    setClarification(null);
    setOriginalProblem(problemText);
    setActiveTab('process');

    try {
      const result = await analyzeProblem(problemText, config);
      
      if (result.clarification) {
        setClarification(result.clarification);
        setActiveTab('input');
      } else if (result.data) {
        setCurrentAnalysis(result.data);
        setActiveTab('report');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Save to history
        const mdContent = generateMarkdown(result.data, problemText);
        
        try {
          await supabase.from('analysis_history').insert({
            member_id: user?.id || null,
            title: result.data.fiveWOneH.what.substring(0, 30) || problemText.substring(0, 30),
            original_problem: problemText,
            analysis_data: result.data,
            report_markdown: mdContent
          });
          
          if (user) {
            fetchHistory();
          }
        } catch (err) {
          console.error('Failed to save history to Supabase', err);
        }
      }
    } catch (err) {
      console.error(err);
      setClarification('分析失败，请稍后重试。');
      setActiveTab('input');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteHistory = async (id: string) => {
    try {
      await supabase.from('analysis_history').delete().eq('id', id);
      fetchHistory();
    } catch (err) {
      console.error('Failed to delete history', err);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    // Handle both string (SQLite legacy) and object (Supabase JSONB) formats
    const data = typeof item.analysis_data === 'string' 
      ? JSON.parse(item.analysis_data) 
      : item.analysis_data;
      
    setCurrentAnalysis(data);
    setOriginalProblem(item.original_problem);
    setActiveTab('report');
    setIsSidebarOpen(false);
  };

  const exportMarkdown = () => {
    if (!currentAnalysis) return;
    const md = generateMarkdown(currentAnalysis, originalProblem);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${new Date().getTime()}.md`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -320 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 w-80 bg-white border-r border-gray-200 z-50 transition-transform lg:translate-x-0",
          !isSidebarOpen && "lg:block"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-bottom border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold text-xl tracking-tight">智析专家</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pb-4 border-b border-gray-100">
            {user ? (
              <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="text-sm font-medium text-indigo-900 truncate max-w-[100px]">
                    {user.name || user.email}
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  退出
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                登录 / 注册会员
              </button>
            )}
            {!user && (
              <div className="mt-2 text-center text-xs text-gray-400">
                当前为游客模式 (ID: 游客)
              </div>
            )}
          </div>

          <div className="p-4">
            <button 
              onClick={() => {
                setCurrentAnalysis(null);
                setClarification(null);
                setActiveTab('input');
                setInput('');
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新分析
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">历史记录</div>
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm italic">暂无记录</div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="group relative">
                  <button 
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                  >
                    <div className="text-sm font-medium truncate pr-6">{item.title}</div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </div>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteHistory(String(item.id)); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="lg:ml-80 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('input')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'input' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                问题输入
              </button>
              <button 
                onClick={() => setActiveTab('process')}
                disabled={!isAnalyzing && !currentAnalysis}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50",
                  activeTab === 'process' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                分析过程
              </button>
              <button 
                onClick={() => setActiveTab('report')}
                disabled={!currentAnalysis}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50",
                  activeTab === 'report' ? "bg-white shadow-sm text-indigo-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                分析报告
              </button>
            </nav>
          </div>

          {currentAnalysis && (
            <button 
              onClick={exportMarkdown}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 MD
            </button>
          )}
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'input' && (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4 py-12">
                  <h2 className="text-4xl font-bold tracking-tight text-gray-900">
                    深度拆解，洞悉本质
                  </h2>
                  <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
                    输入您面临的任何复杂问题、任务或决策，我们将通过 5W1H、MECE、PDCA 等专业方法论为您提供结构化的深度分析。
                  </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-indigo-500/5 border border-gray-100 p-8 space-y-6">
                  {clarification && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900">需要补充信息</p>
                        <p className="text-sm text-amber-800">{clarification}</p>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <textarea 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="描述您的问题，例如：'如何提升团队的远程协作效率？' 或 '分析为什么最近的营销活动转化率低于预期？'"
                      className="w-full h-48 p-6 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500/20 text-lg resize-none placeholder:text-gray-400 transition-all"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-3">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept=".txt,.md,.json"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="上传文件"
                      >
                        <Upload className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleAnalyze()}
                        disabled={isAnalyzing || !input.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在分析...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            开始拆解
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Analysis Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                        分析侧重
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'default', label: '默认平衡' },
                          { id: 'task', label: '任务拆解' },
                          { id: 'knowledge', label: '知识梳理' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setConfig({ ...config, focus: opt.id as any })}
                            className={cn(
                              "py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                              config.focus === opt.id 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white border-gray-200 text-gray-600 hover:border-indigo-200"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Search className="w-4 h-4 text-indigo-500" />
                        分析深度
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'standard', label: '标准分析' },
                          { id: 'deep', label: '深度挖掘' }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setConfig({ ...config, depth: opt.id as any })}
                            className={cn(
                              "py-2 px-3 rounded-xl text-xs font-medium border transition-all",
                              config.depth === opt.id 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white border-gray-200 text-gray-600 hover:border-indigo-200"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { icon: Search, title: "5W1H 识别", desc: "WHAT/WHY/WHO/WHEN/WHERE/HOW" },
                      { icon: ClipboardList, title: "MECE 穷举", desc: "不重叠、不遗漏的要素拆解" },
                      { icon: CheckCircle2, title: "PDCA 任务", desc: "闭环式的行动计划拆解" }
                    ].map((item, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-3 shadow-sm">
                          <item.icon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-sm text-gray-900">{item.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'process' && (
              <motion.div 
                key="process"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold">分析进度</h3>
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">AI 正在深度思考中...</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {[
                    { id: '5w1h', label: '5W1H 属性识别', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                    { id: 'mece', label: 'MECE 要素穷举', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                    { id: 'induction', label: '逻辑归纳与根因提炼', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                    { id: 'deduction', label: '演绎推导与方案生成', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                    { id: 'check', label: '逻辑检查与闭环验证', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                    { id: 'pdca', label: '任务拆解 (PDCA)', status: isAnalyzing ? 'loading' : (currentAnalysis ? 'done' : 'pending') },
                  ].map((step, i) => (
                    <div 
                      key={step.id} 
                      className={cn(
                        "p-6 rounded-2xl border transition-all flex items-center justify-between",
                        step.status === 'done' ? "bg-emerald-50 border-emerald-100" : 
                        step.status === 'loading' ? "bg-indigo-50 border-indigo-100 animate-pulse" : 
                        "bg-white border-gray-200 opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                          step.status === 'done' ? "bg-emerald-500 text-white" : 
                          step.status === 'loading' ? "bg-indigo-500 text-white" : 
                          "bg-gray-200 text-gray-500"
                        )}>
                          {step.status === 'done' ? <CheckCircle2 className="w-6 h-6" /> : i + 1}
                        </div>
                        <div>
                          <p className={cn(
                            "font-bold",
                            step.status === 'done' ? "text-emerald-900" : 
                            step.status === 'loading' ? "text-indigo-900" : 
                            "text-gray-500"
                          )}>
                            {step.label}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {step.status === 'done' ? '分析已完成' : step.status === 'loading' ? '正在处理数据...' : '等待开始'}
                          </p>
                        </div>
                      </div>
                      {step.status === 'loading' && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                    </div>
                  ))}
                </div>

                {currentAnalysis && (
                  <div className="flex justify-center pt-8">
                    <button 
                      onClick={() => setActiveTab('report')}
                      className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl"
                    >
                      查看完整报告
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'report' && currentAnalysis && (
              <motion.div 
                key="report"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12 pb-24"
              >
                {/* Report Header */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                    {currentAnalysis.fiveWOneH.problemType}
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-gray-900 leading-tight">
                    {currentAnalysis.fiveWOneH.what}
                  </h2>
                  <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 italic text-gray-600">
                    <p className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-widest">原始问题</p>
                    "{originalProblem}"
                  </div>
                </div>

                {/* 5W1H Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <Search className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">1. 5W1H 深度识别</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'WHAT', sub: '核心要求', value: currentAnalysis.fiveWOneH.what, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'WHY', sub: '背景原因', value: currentAnalysis.fiveWOneH.why, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'WHO', sub: '涉及角色', value: currentAnalysis.fiveWOneH.who, icon: History, color: 'text-purple-600', bg: 'bg-purple-50' },
                      { label: 'WHEN', sub: '时间节点', value: currentAnalysis.fiveWOneH.when, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'WHERE', sub: '应用场景', value: currentAnalysis.fiveWOneH.where, icon: LayoutDashboard, color: 'text-rose-600', bg: 'bg-rose-50' },
                      { label: 'HOW', sub: '实现手段', value: currentAnalysis.fiveWOneH.how, icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    ].map((item, i) => (
                      <div key={i} className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", item.bg)}>
                            <item.icon className={cn("w-5 h-5", item.color)} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
                            <p className="text-xs font-bold text-gray-900">{item.sub}</p>
                          </div>
                        </div>
                        <p className="text-gray-700 font-medium leading-relaxed">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* MECE Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <ClipboardList className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">2. MECE 要素穷举</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentAnalysis.exhaustion.map((group, i) => (
                      <div key={i} className="bg-white rounded-3xl border border-gray-100 p-8 space-y-4">
                        <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                          {group.category}
                        </h4>
                        <ul className="space-y-3">
                          {group.elements.map((el, j) => (
                            <li key={j} className="flex items-start gap-3 text-gray-600">
                              <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />
                              <span>{el}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Induction Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">3. 归纳法：根因识别</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-3xl border border-gray-100 p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">共同特征</h4>
                      </div>
                      <ul className="space-y-4">
                        {currentAnalysis.induction.commonalities.map((c, i) => (
                          <li key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-indigo-600 shadow-sm">{i+1}</div>
                            <span className="text-gray-700 leading-relaxed">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-indigo-900 text-white rounded-3xl p-8 space-y-6 shadow-xl shadow-indigo-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-indigo-300" />
                        </div>
                        <h4 className="text-lg font-bold">核心根因</h4>
                      </div>
                      <ul className="space-y-4">
                        {currentAnalysis.induction.rootCauses.map((r, i) => (
                          <li key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-indigo-50 font-medium leading-relaxed">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Deduction Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <ArrowRight className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">4. 演绎法：解决方案</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {currentAnalysis.deduction.map((d, i) => (
                      <div key={i} className="group p-8 bg-white rounded-[2rem] border border-gray-100 hover:border-indigo-200 transition-all hover:shadow-xl hover:shadow-indigo-500/5">
                        <div className="flex flex-col md:flex-row gap-8">
                          <div className="md:w-1/3 space-y-3">
                            <div className="flex items-center gap-2 text-gray-400">
                              <Search className="w-4 h-4" />
                              <p className="text-[10px] font-black uppercase tracking-[0.2em]">推导逻辑</p>
                            </div>
                            <p className="text-gray-600 italic leading-relaxed text-sm">{d.logic}</p>
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2 text-indigo-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <p className="text-[10px] font-black uppercase tracking-[0.2em]">解决方案</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 leading-tight">{d.solution}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Logic Check Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">5. 逻辑检查与验证</h3>
                  </div>
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">检查项</th>
                          <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">状态</th>
                          <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">说明</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentAnalysis.logicCheck.map((check, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-8 py-6 font-medium text-gray-900">{check.item}</td>
                            <td className="px-8 py-6">
                              {check.passed ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                  <CheckCircle2 className="w-3 h-3" /> 通过
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                  <AlertCircle className="w-3 h-3" /> 未通过
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-6 text-sm text-gray-500">{check.reason || '逻辑严密，符合规范'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Task Decomposition Section */}
                {currentAnalysis.fiveWOneH.problemType === ProblemType.TASK && currentAnalysis.taskDecomposition && currentAnalysis.taskDecomposition.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold">6. 任务拆解 (PDCA)</h3>
                    </div>
                    <div className="space-y-8 relative before:absolute before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-indigo-100">
                      {currentAnalysis.taskDecomposition.map((step, i) => (
                        <div key={i} className="relative pl-20 space-y-4">
                          <div className="absolute left-0 top-0 w-16 h-16 bg-white border-4 border-indigo-50 rounded-2xl flex items-center justify-center shadow-sm z-10">
                            <span className="text-2xl font-black text-indigo-600">{i+1}</span>
                          </div>
                          <h4 className="text-xl font-bold text-gray-900 pt-3">{step.step}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {step.tasks.map((task, j) => (
                              <div key={j} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">{task.role}</p>
                                <p className="text-gray-800 font-medium">{task.action}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Knowledge Points Section */}
                {currentAnalysis.knowledgePoints && currentAnalysis.knowledgePoints.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold">核心知识点</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {currentAnalysis.knowledgePoints.map((point, i) => (
                        <div key={i} className="bg-white rounded-3xl border border-gray-100 p-8 space-y-4 hover:shadow-lg transition-shadow">
                          <h4 className="text-xl font-bold text-gray-900">{point.name}</h4>
                          <p className="text-gray-600 leading-relaxed">{point.summary}</p>
                          <div className="pt-4 border-t border-gray-50 flex flex-wrap gap-4">
                            {point.attributes.map((attr, j) => (
                              <div key={j} className="space-y-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{attr.label}</p>
                                <p className="text-sm font-medium text-indigo-600">{attr.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm z-10"
            >
              <h2 className="text-xl font-bold mb-4 text-gray-900">会员登录</h2>
              <p className="text-sm text-gray-500 mb-4">输入邮箱即可登录，如果不存在将自动注册。</p>
              <input 
                type="email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="请输入邮箱"
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 outline-none mb-4"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="flex-1 py-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleLogin}
                  disabled={!loginEmail.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  登录
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
