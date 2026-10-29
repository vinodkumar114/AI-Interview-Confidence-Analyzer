import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, CheckCircle2, ShieldCheck, Sparkles, Activity } from 'lucide-react';

const ReportGenerationModal = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { title: "Analyzing Face Mesh & Eye Contact Patterns", desc: "Processing 68 3D facial landmarks and camera gaze stability" },
    { title: "Evaluating Speech Pace & Fluency", desc: "Scanning vocal audio for WPM, filler word ratios, and pauses" },
    { title: "Verifying Answer Accuracy & Resume Fit", desc: "Cross-referencing technical responses with candidate skill profiles" },
    { title: "Finalizing HR Selection & Shortlist Verdict", desc: "Generating downloadable PDF report & email evaluation" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 800);
          return 100;
        }
        const next = prev + 1;
        if (next > 75) setActiveStep(3);
        else if (next > 50) setActiveStep(2);
        else if (next > 25) setActiveStep(1);
        else setActiveStep(0);
        return next;
      });
    }, 45); // ~4.5 seconds total animation

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-8 shadow-[0_0_80px_rgba(0,229,255,0.15)] relative overflow-hidden"
      >
        {/* Animated Background Scanner Line */}
        <motion.div 
          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-xs pointer-events-none"
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
            <Cpu className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-300">
            Generating Your AI Assessment Report
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Our virtual HR engine is synthesizing your interview metrics
          </p>
        </div>

        {/* Circular / Line Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
              <Activity className="w-4 h-4 animate-spin" />
              <span>Assessment In Progress</span>
            </span>
            <span className="text-lg font-bold font-mono text-cyan-300">{progress}%</span>
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full shadow-[0_0_15px_#00e5ff]"
              style={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Step Breakdown Cards */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isDone = idx < activeStep;
            const isCurrent = idx === activeStep;

            return (
              <div 
                key={idx}
                className={`p-3.5 rounded-xl border transition-all duration-300 flex items-center space-x-4 ${
                  isCurrent 
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 shadow-md' 
                    : isDone 
                      ? 'bg-slate-800/40 border-emerald-500/30 text-slate-300' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Sparkles className="w-5 h-5 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[10px] font-mono">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold tracking-wide truncate">{step.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{step.desc}</p>
                </div>

                {isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono animate-pulse">
                    Processing...
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Report will be available for instant viewing and PDF download</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ReportGenerationModal;
