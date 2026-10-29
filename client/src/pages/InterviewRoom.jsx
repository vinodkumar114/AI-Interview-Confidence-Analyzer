import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Eye, Sparkles, AlertCircle, StopCircle, ArrowRight, 
  MessageSquare, Send, Activity, Volume2, Loader2, CheckCircle2,
  ShieldAlert, AlertTriangle, AlertOctagon, X, Maximize
} from 'lucide-react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import CuteRobotAvatar from '../components/CuteRobotAvatar';
import ReportGenerationModal from '../components/ReportGenerationModal';

const InterviewRoom = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(180); // 3-minute interview duration
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [aiText, setAiText] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Live Proctoring & Gaze Warning System State
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("Please look straight into the camera. You have only 5 chances before your session is automatically terminated.");
  const [isTerminated, setIsTerminated] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(!!document.fullscreenElement);

  // Array to store round-by-round metrics for final assessment
  const [historyMetrics, setHistoryMetrics] = useState([]);

  // Live Genuine Metrics State
  const [metrics, setMetrics] = useState({
    eyeContact: 88,
    fluency: 92,
    confidence: 85,
    wpm: 120,
    fillerCount: 0,
    answerAccuracy: 88
  });

  const [liveSuggestion, setLiveSuggestion] = useState('Maintain direct eye contact with the camera for optimal gaze scoring.');
  const [eyeContactWarning, setEyeContactWarning] = useState(false);

  // Resume Questions starting with mandatory welcoming self-introduction prompt
  const [questions, setQuestions] = useState([
    "Tell me about yourself and your technical background.",
    "What is JavaScript, and why do we use it?",
    "Can you explain what React is and why we use components?",
    "What is the difference between state and props in React?"
  ]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeLeftRef = useRef(180);

  // Proctoring Tracking Refs (Avoid React closure stale state inside MediaPipe loop)
  const isProctoringActiveRef = useRef(false);
  const warmupTimerRef = useRef(null);
  const warmupStartedRef = useRef(false);
  const lookAwayTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptRef = useRef('');
  const showReportModalRef = useRef(false);
  const cleanupWindowListenersRef = useRef(null);

  const lookAwayStartTimeRef = useRef(null);
  const isCooldownRef = useRef(false);
  const warningCountRef = useRef(0);
  const showWarningModalRef = useRef(false);
  const isTerminatedRef = useRef(false);
  const lookBackTimerRef = useRef(null);

  // Synchronize state values into refs for requestAnimationFrame & event listener consistency
  useEffect(() => {
    warningCountRef.current = warningCount;
  }, [warningCount]);

  useEffect(() => {
    showWarningModalRef.current = showWarningModal;
  }, [showWarningModal]);

  useEffect(() => {
    isTerminatedRef.current = isTerminated;
  }, [isTerminated]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    showReportModalRef.current = showReportModal;
  }, [showReportModal]);

  // Keep timeLeftRef in sync for STT callback
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Request Fullscreen helper
  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreenActive(true);
      }).catch(err => {
        console.warn("Fullscreen request note:", err);
      });
    }
  };

  // Audio Beep Warning Synthesizer
  const playWarningBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("Audio beep alert error:", e);
    }
  };

  // Text-To-Speech Warning Alert
  const speakWarningAlert = (count) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const alertMsg = count >= 5
        ? "Maximum proctoring violations exceeded. Your interview session is automatically terminated."
        : `Warning ${count} of 5. Please look straight into the camera.`;
      const utterance = new SpeechSynthesisUtterance(alertMsg);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Universal Disarm Proctoring & Resource Cleanup (on report generation or termination)
  const disarmProctoringAndCleanup = () => {
    // 1. Immediately set isProctoringActiveRef.current = false
    isProctoringActiveRef.current = false;
    showWarningModalRef.current = false;
    setShowWarningModal(false);

    // 2. Cancel all active timers: lookAwayTimerRef and silenceTimerRef
    if (lookAwayTimerRef.current) {
      clearTimeout(lookAwayTimerRef.current);
      lookAwayTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    lookAwayStartTimeRef.current = null;
    lookBackTimerRef.current = null;

    // 3. Stop all webcam and microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Stop audio recorder / speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    // 4. Cancel the MediaPipe camera.stop() / requestAnimationFrame loop so zero detection runs during report generation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (faceLandmarkerRef.current) {
      try {
        if (typeof faceLandmarkerRef.current.close === 'function') {
          faceLandmarkerRef.current.close();
        }
      } catch (e) {}
    }

    // 5. Remove window listeners for blur, visibilitychange, and fullscreenchange
    if (cleanupWindowListenersRef.current) {
      cleanupWindowListenersRef.current();
      cleanupWindowListenersRef.current = null;
    }
  };

  // Immediate Termination Handler for Proctoring Malpractice (5/5 strikes)
  const triggerTermination = () => {
    setIsTerminated(true);
    isTerminatedRef.current = true;
    disarmProctoringAndCleanup();

    // Call backend endpoint to record malpractice / termination status
    fetch('https://ai-interview-confidence-analyzer.onrender.com/api/interview/terminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interview_id: 1,
        reason: "Maximum proctoring violations exceeded (5/5)",
        warning_count: 5
      })
    }).catch(err => console.warn("Backend termination endpoint note:", err));
  };

  // Universal Strike Handler for External Proctoring Events (Fullscreen Exit, Tab Switch, Window Blur)
  const registerStrike = (message, ttsMessage) => {
    if (!isProctoringActiveRef.current || isCooldownRef.current || isTerminatedRef.current || showReportModalRef.current) return;

    isCooldownRef.current = true;
    warningCountRef.current += 1;
    const currentCount = warningCountRef.current;

    setWarningCount(currentCount);
    setWarningMessage(message || "Please look straight into the camera. You have only 5 chances before your session is automatically terminated.");
    setShowWarningModal(true);
    showWarningModalRef.current = true;

    playWarningBeep();
    speakWarningAlert(currentCount);

    if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
    lookAwayTimerRef.current = setTimeout(() => {
      isCooldownRef.current = false;
      lookAwayTimerRef.current = null;
    }, 3500);
    lookAwayStartTimeRef.current = null;

    if (currentCount >= 5) {
      triggerTermination();
    }
  };

  // Fullscreen, Anti-Tab Switching, and Window Blur Event Listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreenActive(active);

      if (!active && !isTerminatedRef.current && isProctoringActiveRef.current && !showReportModalRef.current) {
        registerStrike(
          "Fullscreen exited! Split screen or window resizing is prohibited.",
          "Fullscreen exited. Split screen is prohibited."
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !isTerminatedRef.current && isProctoringActiveRef.current && !showReportModalRef.current) {
        registerStrike(
          "Tab switch or split-screen activity detected! Please stay on the interview tab.",
          "Tab switch detected. Please stay on the interview tab."
        );
      }
    };

    const handleWindowBlur = () => {
      if (!isTerminatedRef.current && isProctoringActiveRef.current && !showReportModalRef.current) {
        registerStrike(
          "Tab switch or split-screen activity detected! Please stay on the interview tab.",
          "Window lost focus. Please remain on the interview tab."
        );
      }
    };

    const removeListeners = () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };

    cleanupWindowListenersRef.current = removeListeners;

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      removeListeners();
    };
  }, []);

  // 1. Initialize MediaPipe Task Vision (FaceLandmarker)
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });
        faceLandmarkerRef.current = landmarker;
      } catch (err) {
        console.warn("MediaPipe FaceLandmarker loading fallback note:", err);
      }
    };

    initMediaPipe();
  }, []);

  // 2. Main Setup: Resume Data, WebCam, STT, and Live Analysis Loops
  useEffect(() => {
    // Retrieve Candidate Resume Data & Config
    const parsedResume = JSON.parse(localStorage.getItem('parsedResume') || '{}');
    const interviewConfig = JSON.parse(localStorage.getItem('interviewConfig') || '{}');
    const company = interviewConfig.company || 'Google';

    const mainSkills = (parsedResume.skills && parsedResume.skills.length > 0)
      ? parsedResume.skills.slice(0, 3).join(', ')
      : 'React.js, Python, and JavaScript';
    const mainProject = parsedResume.projects?.[0] || 'your core technical project';
    const rawType = interviewConfig.interviewType || 'HR';
    const interviewTypeStr = rawType.toLowerCase().includes('interview') 
      ? rawType.toLowerCase().replace('interview', '').trim() 
      : rawType;
    const formattedType = interviewTypeStr.toUpperCase();

    // Enforce foundational focus with clear one-sentence technical questions
    const firstSkill = parsedResume.skills?.[0] || 'JavaScript';
    const secondSkill = parsedResume.skills?.[1] || 'React';
    const dynamicQuestions = [
      `Tell me about yourself and your technical background.`,
      `What is ${firstSkill}, and why do we use it?`,
      `Can you explain what ${secondSkill} is and why we use it?`,
      `What is the difference between state and props in React?`
    ];

    setQuestions(dynamicQuestions);

    // Start WebCam Feed
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if (!warmupStartedRef.current && videoRef.current && videoRef.current.readyState >= 2) {
              warmupStartedRef.current = true;
              if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
              warmupTimerRef.current = setTimeout(() => {
                if (!isTerminatedRef.current && !showReportModalRef.current) {
                  isProctoringActiveRef.current = true;
                }
              }, 4000);
            }
          };
          videoRef.current.play().then(() => {
            if (!warmupStartedRef.current && videoRef.current && videoRef.current.readyState >= 2) {
              warmupStartedRef.current = true;
              if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
              warmupTimerRef.current = setTimeout(() => {
                if (!isTerminatedRef.current && !showReportModalRef.current) {
                  isProctoringActiveRef.current = true;
                }
              }, 4000);
            }
          }).catch(console.error);
        }
      })
      .catch((err) => console.error("Webcam init error:", err));

    // Web Speech STT setup (Live Speech-To-Text Transcription & Real-time WPM/Filler analysis)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalized += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (finalized) {
          setTranscript((prev) => {
            const combined = (prev + ' ' + finalized).replace(/\s+/g, ' ').trim();
            transcriptRef.current = combined;

            // Compute Live Speech Analytics: Words, WPM, Fillers, Fluency
            const totalWords = combined.split(/\s+/).filter(Boolean).length;
            const elapsedSecs = Math.max(5, 180 - timeLeftRef.current);
            const computedWPM = Math.min(180, Math.max(60, Math.round((totalWords / elapsedSecs) * 60)));

            // Filler word count regex
            const fillers = (combined.match(/\b(um|uh|like|basically|actually|you know)\b/gi) || []).length;
            const liveFluency = Math.max(50, Math.min(99, 96 - fillers * 4));

            setMetrics(m => ({
              ...m,
              wpm: computedWPM,
              fillerCount: fillers,
              fluency: liveFluency,
              confidence: Math.round((m.eyeContact * 0.4) + (liveFluency * 0.4) + 15)
            }));

            return combined;
          });

          // Reset silence timer and arm auto-submit check after 3.5s silence
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            handleInstantSubmit();
          }, 3500);
        }
        setInterimTranscript(interim);
      };

      recognition.onstart = () => setIsRecording(true);
      
      // Indefinite listening loop: wait for user to click Submit Answer instead of auto-stopping
      recognition.onend = () => {
        setIsRecording(false);
        if (recognitionRef.current && !isSubmitting && !isTerminatedRef.current && !showReportModalRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) {}
    }

    // Timer Counter (SOFT TIMER: does NOT auto-cut off or auto-advance questions!)
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          return 0; // Wait indefinitely for explicit user submit
        }
        return prev - 1;
      });
    }, 1000);

    // MediaPipe 360-Degree FaceMesh Gaze & Head Pose Frame Detector Loop (~30 FPS)
    let lastVideoTime = -1;
    const processVisionFrame = () => {
      if (isTerminatedRef.current || showReportModalRef.current) return;

      // Start warmup 4s grace period once stream is fully attached and playing (readyState >= 2)
      if (!warmupStartedRef.current && videoRef.current && videoRef.current.readyState >= 2) {
        warmupStartedRef.current = true;
        if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
        warmupTimerRef.current = setTimeout(() => {
          if (!isTerminatedRef.current && !showReportModalRef.current) {
            isProctoringActiveRef.current = true;
          }
        }, 4000);
      }

      // If proctoring is not active OR face landmarks are still loading, do NOT increment warningCount or trigger any strike timers
      if (!isProctoringActiveRef.current || !faceLandmarkerRef.current) {
        lookAwayStartTimeRef.current = null;
        lookBackTimerRef.current = null;
        if (lookAwayTimerRef.current) {
          clearTimeout(lookAwayTimerRef.current);
          lookAwayTimerRef.current = null;
        }
        setEyeContactWarning(false);
        if (!isTerminatedRef.current && !showReportModalRef.current) {
          animFrameRef.current = requestAnimationFrame(processVisionFrame);
        }
        return;
      }

      let currentIsLookingAway = false;
      let contactScore = 0;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const video = videoRef.current;

        if (faceLandmarkerRef.current && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          try {
            const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
            const landmarks = results?.faceLandmarks?.[0] || results?.multiFaceLandmarks?.[0];

            if (!landmarks || landmarks.length === 0) {
              contactScore = 0;
              currentIsLookingAway = true;
            } else {
              // 1. Vertical Gaze Ratios
              // Left eye: Iris 468, Upper lid 159, Lower lid 145
              // Right eye: Iris 473, Upper lid 386, Lower lid 374
              const leftLidHeight = (landmarks[145] && landmarks[159]) ? Math.abs(landmarks[145].y - landmarks[159].y) : 0.01;
              const leftVerticalRatio = (landmarks[468] && landmarks[159]) 
                ? (landmarks[468].y - landmarks[159].y) / (leftLidHeight || 0.01)
                : 0.5;

              const rightLidHeight = (landmarks[374] && landmarks[386]) ? Math.abs(landmarks[374].y - landmarks[386].y) : 0.01;
              const rightVerticalRatio = (landmarks[473] && landmarks[386]) 
                ? (landmarks[473].y - landmarks[386].y) / (rightLidHeight || 0.01)
                : 0.5;

              // 2. Head Pitch Ratio (Forehead 10, Nose tip 1, Chin 152)
              const foreheadToNose = (landmarks[1] && landmarks[10]) ? Math.abs(landmarks[1].y - landmarks[10].y) : 0.1;
              const noseToChin = (landmarks[152] && landmarks[1]) ? Math.abs(landmarks[152].y - landmarks[1].y) : 0.1;
              const pitchRatio = foreheadToNose / (noseToChin || 1);

              // 3. Horizontal Iris Ratios
              const leftIris = landmarks[468] || landmarks[473];
              const leftCornerOuter = landmarks[33];
              const leftCornerInner = landmarks[133];
              const rightIris = landmarks[473] || landmarks[468];
              const rightCornerInner = landmarks[362];
              const rightCornerOuter = landmarks[263];

              let leftHRatio = 0.5;
              let rightHRatio = 0.5;
              if (leftIris && leftCornerOuter && leftCornerInner) {
                const lWidth = Math.abs(leftCornerInner.x - leftCornerOuter.x);
                if (lWidth > 0) leftHRatio = Math.abs(leftIris.x - leftCornerOuter.x) / lWidth;
              }
              if (rightIris && rightCornerOuter && rightCornerInner) {
                const rWidth = Math.abs(rightCornerOuter.x - rightCornerInner.x);
                if (rWidth > 0) rightHRatio = Math.abs(rightIris.x - rightCornerInner.x) / rWidth;
              } else {
                rightHRatio = leftHRatio;
              }

              // STRICT UP / DOWN / LEFT / RIGHT GAZE RULES
              // Looking UP: leftVerticalRatio < 0.28 || rightVerticalRatio < 0.28 || pitchRatio < 0.65
              // Looking DOWN: leftVerticalRatio > 0.75 || rightVerticalRatio > 0.75 || pitchRatio > 1.45
              // Looking LEFT / RIGHT: leftHRatio < 0.38 || leftHRatio > 0.62 || rightHRatio < 0.38 || rightHRatio > 0.62
              const isLookingUp = (leftVerticalRatio < 0.28 || rightVerticalRatio < 0.28 || pitchRatio < 0.65);
              const isLookingDown = (leftVerticalRatio > 0.75 || rightVerticalRatio > 0.75 || pitchRatio > 1.45);
              const isLookingLeftRight = (leftHRatio < 0.38 || leftHRatio > 0.62 || rightHRatio < 0.38 || rightHRatio > 0.62);

              if (isLookingUp || isLookingDown || isLookingLeftRight) {
                contactScore = 0;
                currentIsLookingAway = true;
              } else {
                const deviation = Math.abs(leftHRatio - 0.5) + Math.abs(leftVerticalRatio - 0.5);
                contactScore = Math.max(90, Math.min(100, Math.round(98 - deviation * 20)));
                currentIsLookingAway = false;
              }
            }

            setMetrics(m => ({ ...m, eyeContact: contactScore }));
            setEyeContactWarning(contactScore === 0);

          } catch (e) {}
        }
      }

      // DIRECT STRIKE TRIGGER LOGIC USING REFS (Fix React state closure bug)
      if (currentIsLookingAway || contactScore === 0) {
        lookBackTimerRef.current = null; // Reset continuous look-back timer

        if (lookAwayStartTimeRef.current === null) {
          lookAwayStartTimeRef.current = Date.now();
        } else {
          const elapsed = Date.now() - lookAwayStartTimeRef.current;
          if (elapsed >= 1500 && !isCooldownRef.current) {
            // Sustained gaze deviation >= 1.5s!
            warningCountRef.current += 1;
            const currentCount = warningCountRef.current;

            setWarningCount(currentCount);
            setWarningMessage("Please look straight into the camera. You have only 5 chances before your session is automatically terminated.");
            setShowWarningModal(true);
            showWarningModalRef.current = true;

            playWarningBeep();
            speakWarningAlert(currentCount);

            // Set 3.5-second cooldown and reset start time
            isCooldownRef.current = true;
            if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
            lookAwayTimerRef.current = setTimeout(() => {
              isCooldownRef.current = false;
              lookAwayTimerRef.current = null;
            }, 3500);
            lookAwayStartTimeRef.current = null;

            if (currentCount >= 5) {
              triggerTermination();
            }
          }
        }
      } else {
        // Candidate looking straight into camera lens
        lookAwayStartTimeRef.current = null;
        if (lookAwayTimerRef.current) {
          clearTimeout(lookAwayTimerRef.current);
          lookAwayTimerRef.current = null;
        }

        if (showWarningModalRef.current) {
          if (lookBackTimerRef.current === null) {
            lookBackTimerRef.current = Date.now();
          } else {
            const elapsedLookBack = Date.now() - lookBackTimerRef.current;
            if (elapsedLookBack >= 1000) {
              // Candidate looks back straight at camera for 1 second -> Auto-dismiss warning dialog
              setShowWarningModal(false);
              showWarningModalRef.current = false;
              lookBackTimerRef.current = null;
            }
          }
        }
      }

      if (!isTerminatedRef.current && !showReportModalRef.current) {
        animFrameRef.current = requestAnimationFrame(processVisionFrame);
      }
    };

    animFrameRef.current = requestAnimationFrame(processVisionFrame);

    return () => {
      disarmProctoringAndCleanup();
      clearInterval(timer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Speak initial question on load
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIdx === 0 && !aiText && !isTerminated) {
      const qText = questions[0];
      setAiText(qText);
      speak(qText);
    }
  }, [questions, isTerminated]);

  // Fluent Speech Synthesis with callback support
  const speak = (text, onComplete) => {
    if (!('speechSynthesis' in window) || isTerminatedRef.current) {
      if (onComplete) onComplete();
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsAiSpeaking(true);
    utterance.onend = () => {
      setIsAiSpeaking(false);
      if (onComplete) onComplete();
    };
    utterance.onerror = () => {
      setIsAiSpeaking(false);
      if (onComplete) onComplete();
    };

    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (!recognitionRef.current || isTerminated) return;
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setInterimTranscript('');
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  // Handle instant submit (or auto-submit on silence timer)
  const handleInstantSubmit = () => {
    if (isSubmitting || isTerminatedRef.current || showReportModalRef.current) return;

    // Check the spoken transcript
    const words = (transcript || "").trim().split(/\s+/).filter(Boolean);
    const manualWords = (manualInput || "").trim().split(/\s+/).filter(Boolean);

    if (words.length < 3 && manualWords.length < 3) {
      // Do NOT call /api/interview/respond.
      // Do NOT switch state to "Evaluating Answer...".
      // Reset the silence timer and remain in "LISTENING..." state until actual words are spoken.
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    handleSubmitAnswer();
  };

  // Explicit User Submit Answer to LLM Backend API & Handle Conversational Loop
  const handleSubmitAnswer = async () => {
    if (isSubmitting || isTerminatedRef.current || showReportModalRef.current) return;

    // Check the spoken transcript
    const words = (transcript || "").trim().split(/\s+/).filter(Boolean);
    const manualWords = (manualInput || "").trim().split(/\s+/).filter(Boolean);

    if (words.length < 3 && manualWords.length < 3) {
      // Do NOT call /api/interview/respond.
      // Do NOT switch state to "Evaluating Answer...".
      // Reset the silence timer and remain in "LISTENING..." state until actual words are spoken.
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setIsSubmitting(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const parsedResume = JSON.parse(localStorage.getItem('parsedResume') || '{}');
    const skills = parsedResume.skills || ['React.js', 'Python', 'JavaScript'];
    const answerText = (transcript + ' ' + interimTranscript).trim() || manualInput.trim() || "Candidate provided technical details regarding skills and experience.";

    const payload = {
      candidate_id: "candidate-1",
      question_index: currentQuestionIdx,
      current_question: aiText || questions[currentQuestionIdx],
      user_answer: answerText,
      resume_skills: skills,
      metrics: {
        eye_contact: metrics.eyeContact,
        wpm: metrics.wpm,
        fillers: metrics.fillerCount
      }
    };

    let responseData = null;
    try {
      const res = await fetch('https://ai-interview-confidence-analyzer.onrender.com/api/interview/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        responseData = await res.json();
      }
    } catch (err) {
      console.warn("Backend LLM endpoint note, using dynamic fallback:", err);
    }

    // Extract LLM responses including relevancy evaluation
    const acknowledgment = responseData?.acknowledgment || "Thank you for explaining your technical approach.";
    const nextQuestion = responseData?.next_question || questions[currentQuestionIdx + 1] || "Thank you for completing all interview questions.";
    const instantFeedback = responseData?.instant_feedback || "Good response content and steady delivery pace.";
    const isFinalQuestion = responseData?.is_final_question ?? (currentQuestionIdx >= questions.length - 1);
    const isRelevant = responseData?.is_relevant ?? true;
    const relevancyStatus = responseData?.relevancy_status || (isRelevant ? "Relevant" : "Off-Topic");
    const relevancyReason = responseData?.relevancy_reason || "Answer directly addressed the question.";

    // Save round metric with relevancy grading
    const roundMetric = {
      questionIndex: currentQuestionIdx,
      question: payload.current_question,
      answer: answerText,
      eyeContact: metrics.eyeContact,
      wpm: metrics.wpm,
      fillers: metrics.fillerCount,
      fluency: metrics.fluency,
      feedback: instantFeedback,
      isRelevant: isRelevant,
      relevancyStatus: relevancyStatus,
      relevancyReason: relevancyReason
    };

    const updatedHistory = [...historyMetrics, roundMetric];
    setHistoryMetrics(updatedHistory);
    setLiveSuggestion(instantFeedback);

    // Prepare combined TTS voice response
    const fullSpeech = `${acknowledgment} ${nextQuestion}`;

    // Update screen display state
    setAiText(nextQuestion);
    setTranscript('');
    setInterimTranscript('');
    setManualInput('');

    // Trigger SpeechSynthesis voice output
    speak(fullSpeech, () => {
      setIsSubmitting(false);

      if (isFinalQuestion || currentQuestionIdx >= questions.length - 1) {
        triggerEndInterview(updatedHistory);
      } else {
        setCurrentQuestionIdx(prev => prev + 1);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (recognitionRef.current && !isTerminatedRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
      }
    });
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.trim() || isTerminated) return;
    setTranscript(prev => prev ? `${prev} ${manualInput}` : manualInput);
    setManualInput('');
  };

  const triggerEndInterview = async (latestHistory = historyMetrics) => {
    // Immediately disarm proctoring and run full cleanup on report generation
    disarmProctoringAndCleanup();

    window.speechSynthesis?.cancel();
    speak("Your mock interview session is now complete. Synthesizing your full confidence assessment report.");

    const candidateUser = JSON.parse(localStorage.getItem('candidateUser') || '{}');
    const interviewConfig = JSON.parse(localStorage.getItem('interviewConfig') || '{}');

    let reportData = null;
    try {
      const res = await fetch('https://ai-interview-confidence-analyzer.onrender.com/api/interview/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: candidateUser.name || "Candidate",
          candidate_email: candidateUser.email || "candidate@example.com",
          company: interviewConfig.company || "Target Company",
          interview_type: interviewConfig.interviewType || "Technical HR Interview",
          interview_history: latestHistory,
          metrics: {
            eyeContact: metrics.eyeContact,
            fluency: metrics.fluency,
            confidence: metrics.confidence,
            wpm: metrics.wpm,
            fillerCount: metrics.fillerCount,
            warningCount: warningCountRef.current || warningCount
          }
        })
      });

      if (res.ok) {
        reportData = await res.json();
      }
    } catch (err) {
      console.warn("Backend generate-report call note:", err);
    }

    if (!reportData) {
      // Fallback if backend API is offline
      const offTopicCount = latestHistory.filter(h => h.relevancyStatus === "Off-Topic" || h.isRelevant === false).length;
      const genuineEye = metrics.eyeContact;
      const genuineFluency = metrics.fluency;
      const avgScore = latestHistory.length > 0
        ? Math.round(latestHistory.reduce((acc, h) => acc + (h.score || (h.isRelevant ? 75 : 10)), 0) / latestHistory.length)
        : 20;
      const genuineOverall = Math.max(0, Math.min(100, Math.round((avgScore * 0.70) + (genuineEye * 0.15) + (genuineFluency * 0.15))));

      reportData = {
        candidateName: candidateUser.name || "Candidate",
        candidateEmail: candidateUser.email || "candidate@example.com",
        company: interviewConfig.company || "Target Company",
        interviewType: interviewConfig.interviewType || "Technical Interview",
        overallScore: genuineOverall,
        finalVerdict: genuineOverall >= 70 ? "SELECTED FOR THE JOB" : (genuineOverall >= 50 ? "NEEDS IMPROVEMENT" : "NOT SELECTED"),
        selectionStatus: genuineOverall >= 70 ? "SELECTED" : (genuineOverall >= 50 ? "NEEDS IMPROVEMENT" : "NOT SELECTED"),
        shortlistStatus: genuineOverall >= 70 ? "SHORTLISTED" : (genuineOverall >= 50 ? "ON HOLD" : "REJECTED"),
        metrics: {
          eyeContact: genuineEye,
          fluency: genuineFluency,
          confidence: metrics.confidence,
          wpm: metrics.wpm,
          fillerCount: metrics.fillerCount,
          answerAccuracy: avgScore,
          warningCount: warningCountRef.current || warningCount
        },
        historyMetrics: latestHistory,
        evaluatedQuestions: latestHistory,
        completedAt: new Date().toISOString()
      };
    }

    localStorage.setItem('finalReport', JSON.stringify(reportData));

    setTimeout(() => {
      setShowReportModal(true);
    }, 1500);
  };

  // Cleanup effect when transitioning to "Generating Your AI Assessment Report" modal
  useEffect(() => {
    if (showReportModal) {
      disarmProctoringAndCleanup();
    }
  }, [showReportModal]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // RED SESSION TERMINATED VIEW (Disqualification for Proctoring Malpractice)
  if (isTerminated) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 select-none"
      >
        <div className="max-w-md w-full bg-slate-900/90 border-2 border-red-600/80 shadow-[0_0_50px_rgba(239,68,68,0.4)] rounded-3xl p-8 text-center backdrop-blur-2xl relative overflow-hidden">
          {/* Glowing Ambient Backdrop */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse">
            <AlertOctagon className="w-10 h-10 text-red-500" />
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-red-500 tracking-tight font-sans mb-3">
            Session Terminated
          </h1>

          <div className="inline-block px-4 py-1.5 bg-red-950/90 border border-red-500/40 rounded-full text-red-300 text-xs font-bold font-accent mb-4">
            Maximum proctoring violations exceeded (5/5)
          </div>

          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-8 bg-slate-950/60 p-4 rounded-xl border border-red-900/40">
            Your interview session was automatically terminated due to repeated sustained proctoring violations (5/5). Camera feed, microphone recorder, and speech recognition have been stopped.
          </p>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-2xl shadow-[0_0_25px_rgba(239,68,68,0.4)] transition-all cursor-pointer font-sans text-sm tracking-wide"
          >
            Exit to Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  // Safe Fluency & WPM Calculation for UI display based on active answer state
  const currentWords = (transcript || interimTranscript || "").trim().split(/\s+/).filter(Boolean);
  const safeFluency = currentWords.length > 0 ? metrics.fluency : 0;
  const safeWpm = currentWords.length > 0 ? metrics.wpm : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98, filter: 'blur(6px)' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen flex flex-col p-3 md:p-6 bg-slate-950 text-slate-100 relative select-none"
    >
      {/* Top Glassmorphism Timer Header Bar */}
      <div className="flex justify-between items-center mb-4 px-3 py-2.5 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-xl flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
          <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 font-sans">
            AI Virtual HR Interview Room
          </h1>
          <span className="hidden md:inline-block text-xs px-3 py-1 bg-slate-950/80 rounded-full border border-cyan-500/30 text-cyan-300 font-accent">
            QUESTION {currentQuestionIdx + 1} OF {questions.length}
          </span>
        </div>

        {/* Dynamic Countdown Timer, Proctoring Warnings Counter Chip, & Fullscreen Button */}
        <div className="flex items-center space-x-3">
          {!isFullscreenActive && (
            <button
              onClick={enterFullscreen}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition-all shadow-lg cursor-pointer animate-pulse font-sans"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span>Enter Fullscreen</span>
            </button>
          )}

          {/* Synchronized Proctoring Warnings Counter Chip */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl font-accent text-xs font-bold border transition-all ${
            warningCount > 0 
              ? 'bg-red-950/80 border-red-500/60 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' 
              : 'bg-slate-950/80 border-cyan-500/30 text-cyan-300'
          }`}>
            <ShieldAlert className={`w-4 h-4 ${warningCount > 0 ? 'text-red-400' : 'text-cyan-400'}`} />
            <span>Proctoring Warnings: <strong className={warningCount >= 4 ? "text-red-300 font-extrabold" : ""}>{warningCount}/5</strong></span>
          </div>

          <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/40 text-red-400 px-4 py-1.5 rounded-xl font-accent text-xl font-extrabold shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <span className="text-xs uppercase font-sans text-red-300 font-semibold mr-1">Time Left:</span>
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button 
            onClick={triggerEndInterview}
            className="text-xs bg-red-600/80 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer font-sans"
          >
            <StopCircle className="w-4 h-4" />
            <span>End Interview</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 min-h-[580px]">
        
        {/* LEFT COLUMN: Candidate WebCam & MediaPipe HUD Overlay */}
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-2xl rounded-3xl flex flex-col relative overflow-hidden min-h-[440px]">
          
          <div className="relative w-full h-[460px] lg:h-[500px] flex-1 bg-slate-950/80 rounded-2xl overflow-hidden border border-cyan-500/20 shadow-inner flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* WebCam HUD Overlay Controls */}
          <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-center gap-2 z-20">
            
            {/* Mic Status Badge */}
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 backdrop-blur-md border ${
              isRecording ? 'bg-red-500/80 text-white border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-950/80 text-slate-400 border-slate-700'
            }`}>
              {isRecording ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span className="font-accent">STT LIVE TRANSCRIBING...</span>
                </>
              ) : (
                <span className="font-accent">MIC PAUSED</span>
              )}
            </div>

            {/* LIVE DYNAMIC METRICS BADGES (MediaPipe Eye Contact, Fluency, WPM, Fillers) */}
            <div className="flex flex-wrap gap-2">
              <div className={`backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 shadow-lg font-accent border transition-all ${
                metrics.eyeContact === 0 
                  ? 'border-red-500 text-red-400 bg-red-950/40 animate-pulse' 
                  : 'border-cyan-500/40 text-cyan-300 bg-slate-950/90'
              }`}>
                <Eye className={`w-3.5 h-3.5 ${metrics.eyeContact === 0 ? 'text-red-400' : 'text-cyan-400'}`} />
                <span>EYE: {metrics.eyeContact}%</span>
              </div>
              <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-purple-500/40 text-purple-300 flex items-center space-x-1.5 shadow-lg font-accent">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>FLUENCY: {safeFluency}%</span>
              </div>
              <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/40 text-amber-300 flex items-center space-x-1.5 shadow-lg font-accent">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>WPM: {safeWpm}</span>
              </div>
              <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-rose-500/40 text-rose-300 flex items-center space-x-1.5 shadow-lg font-accent">
                <span>FILLERS: {metrics.fillerCount}</span>
              </div>
            </div>
          </div>

          {/* Eye Contact Warning Banner */}
          <AnimatePresence>
            {eyeContactWarning && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-16 left-4 right-4 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-lg z-30 font-sans"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>MediaPipe Vision Alert: Please look directly into your camera lens!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* REAL-TIME SPEECH TRANSCRIPTION CONTAINER */}
          <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl z-20">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center space-x-1 font-accent">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Answer Text (Spoken Word Stream):</span>
              </span>
              <button 
                onClick={toggleRecording} 
                className={`p-1.5 rounded-lg text-xs font-medium cursor-pointer ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-300'}`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-sm text-slate-100 min-h-[42px] max-h-[70px] overflow-y-auto leading-relaxed font-sans font-medium">
              {transcript || interimTranscript ? (
                <>
                  <span className="text-cyan-200">{transcript}</span>
                  {interimTranscript && (
                    <span className="text-cyan-400/60 font-normal italic ml-1">{interimTranscript}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 italic">Speak your response... Your spoken words will stream here live with WPM & filler analytics.</span>
              )}
            </p>

            {/* Fallback Manual Typing */}
            <form onSubmit={handleManualSubmit} className="flex space-x-2 mt-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Or edit/type your text answer here..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500 font-sans"
              />
              <button type="submit" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer font-sans">
                <Send className="w-3 h-3" />
                <span>Add</span>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D METALLIC ROBOT AVATAR & CHATGPT QUESTION BUBBLE */}
        <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-2xl rounded-3xl p-6 flex flex-col items-center justify-between relative min-h-[440px]">
          
          {/* AI Robot Header Tag */}
          <div className="w-full flex justify-between items-center mb-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 font-sans">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>ChatGPT-Style Resume AI Interviewer</span>
            </div>
            <span className="text-xs text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30 font-accent flex items-center space-x-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-amber-300">AI THINKING</span>
                </>
              ) : isAiSpeaking ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SPEAKING LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AI LISTENING</span>
                </>
              )}
            </span>
          </div>

          {/* 3D METALLIC ROBOT AVATAR COMPONENT */}
          <CuteRobotAvatar isAiSpeaking={isAiSpeaking || isSubmitting} />

          {/* Question Text Bubble */}
          <div className="w-full bg-slate-950/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-xl my-3 text-center">
            <p className="text-base md:text-lg font-medium text-slate-100 leading-relaxed font-sans">
              "{aiText}"
            </p>
          </div>

          {/* Live AI Suggestion Bar */}
          <div className="w-full bg-cyan-950/30 border border-cyan-500/30 rounded-xl px-4 py-2 text-xs text-cyan-300 flex items-center justify-between font-sans">
            <div className="flex items-center space-x-2 truncate">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate">{liveSuggestion}</span>
            </div>
            <span className="text-[10px] text-slate-400 shrink-0 font-accent ml-2">WPM: {safeWpm}</span>
          </div>

          {/* Controls Footer */}
          <div className="w-full flex justify-end items-center mt-3 pt-3 border-t border-white/10">
            <button 
              onClick={handleInstantSubmit}
              disabled={isSubmitting}
              className="btn-primary py-3 px-6 text-sm flex items-center space-x-2 shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer font-sans disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Answer...</span>
                </>
              ) : (
                <>
                  <span>{currentQuestionIdx < questions.length - 1 ? 'Submit & Next Question' : 'Submit & Finish Interview'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* FLOATING PROCTORING WARNING ALERT MODAL */}
      <AnimatePresence>
        {showWarningModal && !isTerminated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-8 right-8 z-50 max-w-md w-full p-1"
          >
            <div className="bg-slate-900/95 border-2 border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.4)] rounded-2xl p-5 backdrop-blur-2xl relative overflow-hidden">
              {/* Crimson pulse strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 animate-pulse" />
              
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-bounce">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-black uppercase text-red-400 tracking-wider font-accent">
                      PROCTORING WARNING [{warningCount}/5]
                    </span>
                    <button
                      onClick={() => setShowWarningModal(false)}
                      className="text-slate-400 hover:text-white p-1 transition-colors rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-slate-100 leading-snug font-sans mb-3">
                    Warning [{warningCount}/5]: {warningMessage}
                  </p>

                  {!isFullscreenActive && (
                    <button
                      onClick={enterFullscreen}
                      className="w-full py-2 px-3 mb-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer font-sans"
                    >
                      <Maximize className="w-3.5 h-3.5" />
                      <span>Re-enter Fullscreen Mode</span>
                    </button>
                  )}

                  <div className="flex items-center space-x-2 text-[11px] text-cyan-300 font-accent bg-slate-950/70 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Looking straight back into camera for 1s auto-dismisses this alert</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REPORT GENERATION MODAL */}
      {showReportModal && (
        <ReportGenerationModal 
          onComplete={() => navigate('/result/1')} 
        />
      )}

    </motion.div>
  );
};

export default InterviewRoom;
