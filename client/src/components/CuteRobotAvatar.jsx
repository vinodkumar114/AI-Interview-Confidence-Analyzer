import React, { useRef, useEffect, Suspense, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import roboImg from '../assets/robo1.jpeg';

const AVATAR_URL = 'https://models.readyplayer.me/64b7a13318f70f612d4d3856.glb?morphTargets=mouthOpen,viseme_aa,viseme_O,viseme_I';

// Error Boundary Component to gracefully catch WebGL / network GLB load failures
class AvatarErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("3D Canvas error caught by boundary, switching to high-res fallback:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// 3D Avatar Model Component inside Canvas
function AvatarModel({ isAiSpeaking }) {
  const { scene, nodes } = useGLTF(AVATAR_URL);
  const groupRef = useRef();
  const headMeshRef = useRef(null);
  const teethMeshRef = useRef(null);
  const eyeLeftMeshRef = useRef(null);
  const eyeRightMeshRef = useRef(null);

  // Safely find head, teeth, and eye meshes with morphTargets
  useEffect(() => {
    if (nodes) {
      if (nodes.Wolf3D_Head) headMeshRef.current = nodes.Wolf3D_Head;
      if (nodes.Wolf3D_Avatar) headMeshRef.current = nodes.Wolf3D_Avatar;
      if (nodes.Wolf3D_Teeth) teethMeshRef.current = nodes.Wolf3D_Teeth;
      if (nodes.EyeLeft) eyeLeftMeshRef.current = nodes.EyeLeft;
      if (nodes.EyeRight) eyeRightMeshRef.current = nodes.EyeRight;
    }

    if (scene && !headMeshRef.current) {
      scene.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
          if (child.name.includes('Head') || child.name.includes('Avatar')) {
            headMeshRef.current = child;
          } else if (child.name.includes('Teeth')) {
            teethMeshRef.current = child;
          } else if (child.name.includes('EyeLeft')) {
            eyeLeftMeshRef.current = child;
          } else if (child.name.includes('EyeRight')) {
            eyeRightMeshRef.current = child;
          }
        }
      });
    }
  }, [scene, nodes]);

  // Audio-driven lip sync & idle motion render loop
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // 1. Idle Head Sway & Breathing Motion
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.5) * 0.008;
      groupRef.current.rotation.y = Math.sin(t * 1.2) * 0.04;
      groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.02;
    }

    // Helper to safely update morph target weight
    const setMorphValue = (mesh, targetName, val) => {
      if (mesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const index = mesh.morphTargetDictionary[targetName];
        if (index !== undefined && mesh.morphTargetInfluences[index] !== undefined) {
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
            mesh.morphTargetInfluences[index],
            val,
            0.3
          );
        }
      }
    };

    // 2. Real-Time Lip Sync when AI is Speaking
    if (isAiSpeaking) {
      const speechIntensity = Math.abs(Math.sin(t * 16) * Math.cos(t * 9));
      const mouthOpenVal = Math.min(0.8, speechIntensity * 0.75 + Math.random() * 0.15);
      const visemeAaVal = Math.min(0.7, speechIntensity * 0.6);
      const visemeOVal = Math.min(0.5, Math.sin(t * 12) * 0.5);

      setMorphValue(headMeshRef.current, 'mouthOpen', mouthOpenVal);
      setMorphValue(teethMeshRef.current, 'mouthOpen', mouthOpenVal);
      setMorphValue(headMeshRef.current, 'viseme_aa', visemeAaVal);
      setMorphValue(headMeshRef.current, 'viseme_O', visemeOVal);
    } else {
      // Reset mouth to closed when listening
      setMorphValue(headMeshRef.current, 'mouthOpen', 0);
      setMorphValue(teethMeshRef.current, 'mouthOpen', 0);
      setMorphValue(headMeshRef.current, 'viseme_aa', 0);
      setMorphValue(headMeshRef.current, 'viseme_O', 0);
    }

    // 3. Natural Eye Blinking
    const blinkTrigger = Math.sin(t * 2.2) > 0.97;
    const blinkVal = blinkTrigger ? 0.95 : 0;
    setMorphValue(eyeLeftMeshRef.current, 'eyeBlinkLeft', blinkVal);
    setMorphValue(eyeRightMeshRef.current, 'eyeBlinkRight', blinkVal);
    setMorphValue(headMeshRef.current, 'eyeBlinkLeft', blinkVal);
    setMorphValue(headMeshRef.current, 'eyeBlinkRight', blinkVal);
  });

  return (
    <group ref={groupRef} position={[0, -0.05, 0]}>
      <primitive object={scene} />
    </group>
  );
}

// 3D Canvas Suspense Loading Spinner
function Avatar3DSpinner() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center text-cyan-400 font-accent text-xs whitespace-nowrap bg-slate-950/90 px-4 py-2.5 rounded-xl border border-cyan-500/40 shadow-xl backdrop-blur-md">
        <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-1.5" />
        <span>Loading 3D Avatar...</span>
      </div>
    </Html>
  );
}

const CuteRobotAvatar = ({ isAiSpeaking }) => {
  // Image Fallback Component with animated speech effects & mouth motion if Canvas/3D fallback is triggered
  const ImageFallback = (
    <div className="relative w-full h-56 flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/40 p-2">
      <motion.img 
        src={roboImg} 
        alt="Smart AI HR Interviewer" 
        className="w-full h-full object-contain"
        animate={isAiSpeaking ? {
          scale: [1, 1.035, 0.985, 1.02, 1],
          y: [0, -3, 2, -2, 0],
          rotate: [0, 0.5, -0.5, 0.2, 0],
          filter: "brightness(115%) contrast(108%) drop-shadow(0 0 20px rgba(0,229,255,0.6))"
        } : {
          scale: [1, 1.01, 1],
          y: [0, -1.5, 0],
          filter: "brightness(95%) contrast(100%)"
        }}
        transition={{
          duration: isAiSpeaking ? 0.45 : 3.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        onError={(e) => console.error("Failed to load AI Robot Avatar image:", e)}
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-purple-950/20 pointer-events-none" />

      {/* Animated Glowing Mouth Movement Overlay Effect */}
      {isAiSpeaking && (
        <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
          <motion.div 
            className="w-10 h-3 rounded-full bg-cyan-400/80 blur-[2px] border border-cyan-200 shadow-[0_0_15px_#00e5ff]"
            animate={{ 
              scaleY: [0.3, 1.8, 0.5, 1.4, 0.2],
              scaleX: [0.8, 1.2, 0.9, 1.1, 0.8],
              opacity: [0.6, 1, 0.7, 0.9, 0.5]
            }}
            transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="w-14 h-14 rounded-full bg-cyan-400/30 blur-lg"
            animate={{ scale: [0.8, 1.3, 0.9], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* Animated Equalizer Waveform Overlay when Speaking */}
      {isAiSpeaking && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1 px-3 py-1 bg-slate-950/85 backdrop-blur-md rounded-full border border-cyan-500/40 shadow-lg z-20">
          {[0.6, 0.9, 0.4, 1.0, 0.7, 0.5, 0.8].map((h, i) => (
            <motion.span
              key={i}
              className="w-1 bg-gradient-to-t from-cyan-500 to-purple-400 rounded-full"
              animate={{ height: ['4px', `${14 * h}px`, '4px'] }}
              transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex flex-col items-center justify-center py-2 select-none w-full max-w-sm mx-auto">
      
      {/* Dynamic Soundwave Ripple Rings Radiating Behind Robot while AI is Speaking */}
      {isAiSpeaking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-0">
          <motion.div
            className="w-64 h-64 rounded-full border-2 border-cyan-400/60 shadow-[0_0_30px_rgba(0,229,255,0.5)]"
            animate={{ scale: [0.85, 1.4, 0.85], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="w-72 h-72 rounded-full border border-purple-500/50 shadow-[0_0_35px_rgba(168,85,247,0.4)]"
            animate={{ scale: [0.85, 1.5, 0.85], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: 0.3, ease: "easeInOut" }}
          />
          <motion.div
            className="w-80 h-80 rounded-full border border-blue-400/30 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            animate={{ scale: [0.9, 1.6, 0.9], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: 0.6, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* Ambient Radial Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
        isAiSpeaking ? 'bg-cyan-400/30 scale-125' : 'bg-blue-500/10 scale-90'
      }`} />

      {/* 3D CANVAS FRAME WITH FROSTED GLASS & NEON GLOW */}
      <div className="relative z-10 w-full flex flex-col items-center">
        
        <div className={`rounded-3xl p-1 transition-all duration-500 w-full ${
          isAiSpeaking 
            ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 shadow-[0_0_45px_rgba(0,229,255,0.6)] scale-[1.02]' 
            : 'bg-slate-800/80 border border-slate-700 shadow-xl'
        }`}>
          
          <div className="relative w-full h-56 flex items-center justify-center overflow-hidden rounded-xl bg-slate-900/40 p-2 border border-white/10 shadow-inner">
            
            {/* ERROR BOUNDARY + THREE.JS R3F CANVAS WITH SUSPENSE */}
            <AvatarErrorBoundary fallback={ImageFallback}>
              <Canvas className="w-full h-full" camera={{ position: [0, 1.45, 0.75], fov: 38 }}>
                {/* Theme Lights */}
                <ambientLight intensity={0.9} />
                <directionalLight position={[0, 2, 2]} intensity={1.5} />
                <pointLight position={[-2, 1, -1]} color="#00e5ff" intensity={2.5} />
                <pointLight position={[2, 1, -1]} color="#a855f7" intensity={2.5} />

                {/* Avatar GLTF Model wrapped in Suspense */}
                <Suspense fallback={<Avatar3DSpinner />}>
                  <AvatarModel isAiSpeaking={isAiSpeaking} />
                </Suspense>
              </Canvas>
            </AvatarErrorBoundary>

            {/* Live Status Badge Overlay with Audio Equalizer Animation */}
            <div className="absolute top-3 right-3 flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-[10px] font-accent text-cyan-300 z-20 shadow-lg">
              {isAiSpeaking ? (
                <>
                  <span className="flex space-x-0.5 items-center">
                    <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="font-bold tracking-wider text-cyan-300">SPEAKING LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="tracking-wider text-slate-300">AI LISTENING</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Robot Name Badge */}
        <div className="mt-3 px-4 py-1.5 rounded-full backdrop-blur-xl bg-slate-900/80 border border-white/10 shadow-lg flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
          <span className="text-xs font-accent text-slate-200 tracking-wider">SMART AI HR INTERVIEWER</span>
        </div>

      </div>
    </div>
  );
};

// Safe Model Preload
try {
  useGLTF.preload(AVATAR_URL);
} catch (e) {
  console.warn("Avatar preload note:", e);
}

export default CuteRobotAvatar;
