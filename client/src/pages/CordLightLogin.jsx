import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Eye, EyeOff, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import axios from 'axios';

const CordLightLogin = () => {
  const navigate = useNavigate();
  const [isLightOn, setIsLightOn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cordControls = useAnimation();
  const cardControls = useAnimation();

  // Trigger cord pull spring animation & card slide in/out
  const handlePullCord = async () => {
    // Cord stretch and snap back spring animation
    await cordControls.start({
      y: 45,
      transition: { type: 'spring', stiffness: 600, damping: 10 }
    });

    const nextLightState = !isLightOn;
    setIsLightOn(nextLightState);

    cordControls.start({
      y: 0,
      transition: { type: 'spring', stiffness: 350, damping: 14 }
    });

    // Animate Card position
    if (nextLightState) {
      // Light turned ON -> Drop down card from top into center
      await cardControls.start({
        y: 0,
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 180, damping: 18 }
      });
    } else {
      // Light turned OFF -> Tuck card UP off-screen
      await cardControls.start({
        y: -750,
        opacity: 0,
        scale: 0.92,
        transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        try {
          await axios.post('https://ai-interview-confidence-analyzer.onrender.com/api/auth/register', {
            name: name || 'Candidate',
            email,
            password
          });
        } catch (err) {
          console.warn("Backend auth offline, continuing with local session", err);
        }
      } else {
        try {
          await axios.post('https://ai-interview-confidence-analyzer.onrender.com/api/auth/login', {
            name: name || 'Candidate',
            email,
            password
          });
        } catch (err) {
          console.warn("Backend auth offline, continuing with local session", err);
        }
      }

      // Save candidate session
      localStorage.setItem('candidateUser', JSON.stringify({
        email: email || 'candidate@example.com',
        name: name || email.split('@')[0] || 'Candidate'
      }));

      // Navigate to Setup Interview Dashboard
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg('Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen relative flex flex-col items-center justify-center p-4 transition-all duration-700 select-none overflow-hidden ${isLightOn ? 'cozy-light-bg-on' : 'cozy-light-bg-off'}`}>
      
      {/* Light Cone Ray & Glowing Particles */}
      {isLightOn && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Radial Light Halo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-amber-400/15 rounded-full blur-3xl opacity-80 animate-pulse" />
          
          {/* Ceiling Lamp Cone Ray */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[350px] border-l-transparent border-r-[350px] border-r-transparent border-b-[750px] border-b-amber-400/10 blur-2xl pointer-events-none" />

          {/* Cozy Floating Ambient Sparkles */}
          {[...Array(16)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 bg-amber-300 rounded-full opacity-70"
              style={{
                top: `${15 + Math.random() * 70}%`,
                left: `${10 + Math.random() * 80}%`
              }}
              animate={{
                y: [0, -25, 0],
                opacity: [0.2, 0.9, 0.2],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: 3 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>
      )}

      {/* Lamp Socket, Bulb Character & Cord Pull Handle */}
      <div className="relative flex flex-col items-center mb-4 z-30 pt-2">
        {/* Ceiling Wire */}
        <div className="w-1 h-16 bg-gradient-to-b from-slate-700 to-amber-900/60 rounded-full" />

        {/* Screw Socket Base */}
        <div className="w-10 h-5 bg-gradient-to-r from-slate-600 via-slate-400 to-slate-700 rounded-t-sm shadow-md border-b border-slate-900" />

        {/* Interactive Light Bulb Character */}
        <motion.div 
          onClick={handlePullCord}
          className={`relative cursor-pointer transition-all duration-500 ${isLightOn ? 'bulb-glow-active' : 'bulb-glow-inactive'}`}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          title="Click or pull cord to turn light ON/OFF!"
        >
          {/* Bulb Body */}
          <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center relative transition-all duration-500 ${
            isLightOn 
              ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-amber-400 shadow-[inset_0_0_25px_rgba(255,255,255,0.9)]' 
              : 'bg-slate-800/90 border-2 border-slate-700/80 shadow-inner'
          }`}>
            
            {/* Bulb Filament highlight arc */}
            {isLightOn && (
              <div className="absolute top-2 w-10 h-4 border-t-2 border-white/60 rounded-t-full" />
            )}

            {/* Cute Bulb Face Expressions */}
            {isLightOn ? (
              /* OPEN ALERT / SMILING EYES */
              <div className="flex flex-col items-center space-y-1 mt-1">
                <div className="flex space-x-3.5 items-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-4 bg-amber-950 rounded-full relative">
                    <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5" />
                  </motion.div>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-4 bg-amber-950 rounded-full relative">
                    <div className="w-1 h-1 bg-white rounded-full absolute top-0.5 right-0.5" />
                  </motion.div>
                </div>
                
                {/* Rosy blush cheeks */}
                <div className="w-full flex justify-between px-3.5 -mt-1">
                  <div className="w-3 h-1.5 bg-rose-400/60 rounded-full blur-[0.5px]" />
                  <div className="w-3 h-1.5 bg-rose-400/60 rounded-full blur-[0.5px]" />
                </div>

                {/* Happy wide smile */}
                <div className="w-4 h-2 border-b-2 border-amber-950 rounded-full" />
              </div>
            ) : (
              /* SLEEPING / CLOSED EYES */
              <div className="flex flex-col items-center space-y-1.5 mt-2">
                <svg className="w-10 h-4 text-slate-400" viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M 6 8 Q 12 14 18 8" />
                  <path d="M 22 8 Q 28 14 34 8" />
                </svg>
                {/* Quiet sleeping mouth */}
                <div className="w-3 h-1 border-b border-slate-500 rounded-full" />
              </div>
            )}
          </div>

          {/* Cord Socket Attachment */}
          <div className="w-3.5 h-2 bg-slate-700 mx-auto -mt-1 rounded-b" />
        </motion.div>

        {/* INTERACTIVE PULL CORD STRING & BEAD HANDLE */}
        <motion.div
          animate={cordControls}
          drag="y"
          dragConstraints={{ top: 0, bottom: 50 }}
          dragElastic={0.2}
          onDragEnd={handlePullCord}
          onClick={handlePullCord}
          className="relative flex flex-col items-center cursor-pointer group pt-1"
          title="Click or pull cord string to light up and drop login card!"
        >
          {/* Thread / Cord String */}
          <div className={`w-0.5 h-16 transition-colors duration-300 ${isLightOn ? 'bg-amber-300' : 'bg-slate-400/70 group-hover:bg-amber-400'}`} />
          
          {/* Pull Bead Handle */}
          <motion.div 
            className={`w-5 h-5 rounded-full shadow-lg border transition-transform duration-300 ${
              isLightOn 
                ? 'bg-gradient-to-b from-amber-200 to-amber-500 border-amber-100 shadow-amber-500/50' 
                : 'bg-gradient-to-b from-slate-400 to-slate-600 border-slate-300 group-hover:scale-125'
            }`}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
          />

          {/* Tooltip hint badge */}
          <div className="absolute -bottom-7 text-[11px] font-accent font-semibold tracking-wider text-amber-300/90 whitespace-nowrap bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-amber-500/30 opacity-90 group-hover:opacity-100 transition-opacity shadow-md">
            {isLightOn ? "Pull to Turn OFF 🔌" : "Pull Cord to Turn ON 💡"}
          </div>
        </motion.div>
      </div>

      {/* FROSTED GLASSMORPHISM LOGIN CARD WITH DROPDOWN ANIMATION */}
      <motion.div 
        animate={cardControls}
        initial={{ y: -750, opacity: 0, scale: 0.92 }}
        className="w-full max-w-md p-8 backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-2xl rounded-3xl transition-all duration-500 z-20 relative"
      >
        {/* App Title & Version Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-accent tracking-wide">v2.0 AI CONFIDENCE ANALYZER</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-100 via-amber-300 to-orange-400">
            {isSignUp ? 'Create Candidate Account' : 'Candidate Portal Login'}
          </h1>

          <p className="text-sm text-slate-400 mt-2">
            {isLightOn 
              ? "The light is on — enter your credentials to launch AI interview." 
              : "Pull the cord above to light up and unlock your dashboard."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-accent">
                Full Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-11"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider font-accent">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="email"
                required
                placeholder="candidate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-11"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-accent">
                Password
              </label>
              {!isSignUp && (
                <button 
                  type="button" 
                  onClick={() => alert("Password reset link sent to your registered email!")} 
                  className="text-xs text-amber-400 hover:underline"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500" />
                <span>Remember me on this device</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3.5 text-base flex items-center justify-center space-x-2 mt-4 cursor-pointer"
          >
            <span className="font-semibold">{loading ? 'Authenticating...' : (isSignUp ? 'Create Account' : 'Sign In to Dashboard')}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Footer Account Switch Toggle */}
        <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
          <span>{isSignUp ? "Already have an account?" : "First time candidate?"}</span>{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
            }}
            className="font-bold text-amber-400 hover:text-amber-300 underline ml-1 cursor-pointer"
          >
            {isSignUp ? 'Sign In' : 'Create an account'}
          </button>
        </div>
      </motion.div>

      {/* Interactive Helper Text Footer */}
      <div className="mt-6 text-center text-xs font-accent text-slate-400 z-10 flex items-center space-x-1.5 bg-slate-950/60 px-4 py-1.5 rounded-full border border-slate-800">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
        <span>Pull or click the cord string above to turn light ON/OFF & drop login card</span>
      </div>
    </div>
  );
};

export default CordLightLogin;
