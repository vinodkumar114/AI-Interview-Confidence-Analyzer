import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Brain, Eye, Mic, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-blob animation-delay-4000"></div>

      {/* Navbar */}
      <nav className="relative z-10 glass-card mx-8 mt-6 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Brain className="w-8 h-8 text-purple-400" />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            AIHR
          </span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium">
          <a href="#" className="hover:text-purple-400 transition-colors">Features</a>
          <a href="#" className="hover:text-purple-400 transition-colors">How it Works</a>
          <a href="#" className="hover:text-purple-400 transition-colors">About</a>
        </div>
        <div className="flex space-x-4">
          <button className="text-sm font-medium hover:text-purple-400 transition-colors">Login</button>
          <button onClick={() => navigate('/dashboard')} className="btn-primary py-2 text-sm">Get Started</button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            Master Your Next Interview with <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
              AI-Powered Feedback
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Practice with our virtual HR interviewer. Get real-time analysis on your eye contact, fluency, confidence, and technical skills.
          </p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="btn-primary text-lg flex items-center mx-auto space-x-2 px-8 py-4"
          >
            <span>Start Mock Interview</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Feature Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
              <Eye className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Eye Contact Analysis</h3>
            <p className="text-slate-400">Advanced CV tracks your eye direction and face orientation in real-time.</p>
          </div>
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-6">
              <Mic className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Fluency Tracking</h3>
            <p className="text-slate-400">Monitors speaking speed, filler words, and vocabulary dynamically.</p>
          </div>
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mb-6">
              <Briefcase className="w-8 h-8 text-pink-400" />
            </div>
            <h3 className="text-xl font-bold mb-3">Dynamic Questions</h3>
            <p className="text-slate-400">Questions are generated instantly based on your resume and previous answers.</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default LandingPage;
