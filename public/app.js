// CookedAI Application Logic (Gender-Tailored, Manglish Gen-Z, Nuclear Spice & TTS Engine)
(function() {
  // State
  let currentGender = 'guy';
  let activeQuestions = [];
  let currentQIdx = 0;
  let userAnswers = [];
  
  let currentLanguage = localStorage.getItem('cooked_lang') || 'manglish';
  let currentSpice = localStorage.getItem('cooked_spice') || 'nuclear';
  let currentProvider = localStorage.getItem('cooked_provider') || 'gemini';
  let apiKey = localStorage.getItem('cooked_api_key') || '';
  let selectedModel = localStorage.getItem('cooked_model') || 'gemini-3.6-flash';
  let customModelName = localStorage.getItem('cooked_custom_model') || '';
  let serverHasKey = false;

  // DOM Elements - Views
  const viewWelcome = document.getElementById('view-welcome');
  const viewQuiz = document.getElementById('view-quiz');
  const viewCooking = document.getElementById('view-cooking');
  const viewResult = document.getElementById('view-result');

  // DOM Elements - Navbar & Toolbar
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = document.getElementById('sound-icon');
  const btnApiModal = document.getElementById('btn-api-modal');
  const keyDot = document.getElementById('key-dot');
  const keyBtnLabel = document.getElementById('key-btn-label');
  const pillLangManglish = document.getElementById('pill-lang-manglish');
  const pillLangEnglish = document.getElementById('pill-lang-english');
  const pillSpiceSensitive = document.getElementById('pill-spice-sensitive');
  const pillSpiceSavage = document.getElementById('pill-spice-savage');
  const pillSpiceNuclear = document.getElementById('pill-spice-nuclear');

  // DOM Elements - Gender & Start
  const genderRadios = document.querySelectorAll('input[name="gender-choice"]');
  const btnStartQuiz = document.getElementById('btn-start-quiz');

  // DOM Elements - Quiz
  const activePackBadge = document.getElementById('active-pack-badge');
  const quizStepText = document.getElementById('quiz-step-text');
  const progressBar = document.getElementById('progress-bar');
  const qCategory = document.getElementById('q-category');
  const qPrompt = document.getElementById('q-prompt');
  const qSubtext = document.getElementById('q-subtext');
  const quickPicks = document.getElementById('quick-picks');
  const answerInput = document.getElementById('answer-input');
  const btnPrevQ = document.getElementById('btn-prev-q');
  const btnNextQ = document.getElementById('btn-next-q');
  const nextBtnText = document.getElementById('next-btn-text');
  const btnRandomPick = document.getElementById('btn-random-pick');
  const btnShuffleQuestions = document.getElementById('btn-shuffle-questions');

  // DOM Elements - Cooking & Result
  const cookingTerminal = document.getElementById('cooking-terminal');
  const demoBanner = document.getElementById('demo-banner');
  const statAura = document.getElementById('stat-aura');
  const statCooked = document.getElementById('stat-cooked');
  const statSpice = document.getElementById('stat-spice');
  const statLang = document.getElementById('stat-lang');
  const roastDiagnosis = document.getElementById('roast-diagnosis');
  const roastBody = document.getElementById('roast-body');
  const roastMicdrop = document.getElementById('roast-micdrop');
  const roastPrescribed = document.getElementById('roast-prescribed');
  const btnCopyRoast = document.getElementById('btn-copy-roast');
  const btnRestart = document.getElementById('btn-restart');
  const btnVineBoom = document.getElementById('btn-vine-boom');

  // DOM Elements - TTS Player
  const ttsEqualizer = document.getElementById('tts-equalizer');
  const ttsStatusText = document.getElementById('tts-status-text');
  const btnTtsPlay = document.getElementById('btn-tts-play');
  const btnTtsPause = document.getElementById('btn-tts-pause');
  const btnTtsStop = document.getElementById('btn-tts-stop');

  // DOM Elements - Modal
  const apiModal = document.getElementById('api-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalProviderSelect = document.getElementById('modal-provider-select');
  const geminiHelpBox = document.getElementById('gemini-help-box');
  const labelApiKey = document.getElementById('label-api-key');
  const modalApiKeyInput = document.getElementById('modal-api-key-input');
  const modalModelSelect = document.getElementById('modal-model-select');
  const customModelGroup = document.getElementById('custom-model-group');
  const customModelInput = document.getElementById('custom-model-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const btnClearKey = document.getElementById('btn-clear-key');
  const toast = document.getElementById('toast');

  let currentRoastPayload = null;
  let cookingInterval = null;

  // High-Performance Audio Speech Controller with 0ms Voice Pack Pre-warming
  class SpeechController {
    constructor() {
      this.currentAudio = null;
      this.prewarmedAudio = null;
      this.prewarmedText = null;
      this.isPrefetching = false;
      this.pendingPlay = false;
      this.synth = window.speechSynthesis;
      this.isSpeaking = false;
      this.isPaused = false;
      this.isLoading = false;
      this.cachedVoices = [];

      if (this.synth) {
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
          speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
      }
    }

    loadVoices() {
      if (!this.synth) return;
      this.cachedVoices = this.synth.getVoices();
    }

    getBestFallbackVoice(langMode) {
      if (!this.cachedVoices.length) this.loadVoices();
      const indianVoice = this.cachedVoices.find(v => v.lang === 'en-IN' || v.name.includes('India'));
      const malayalamVoice = this.cachedVoices.find(v => v.lang === 'ml-IN' || v.name.toLowerCase().includes('malayalam'));
      const defaultVoice = this.cachedVoices.find(v => v.lang.startsWith('en')) || this.cachedVoices[0];
      return langMode === 'manglish' ? (malayalamVoice || indianVoice || defaultVoice) : (indianVoice || defaultVoice);
    }

    // Pre-warm the voice pack audio and wait until buffered for instant 0ms playback
    async prewarmAsync(text) {
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/"/g, '')
        .trim();

      if (!cleanText) return false;
      if (this.prewarmedAudio && this.prewarmedText === cleanText) return true;

      const userKey = apiKey || localStorage.getItem('cooked_api_key');
      if (!userKey || userKey.trim() === '') return false;

      this.prewarmedText = cleanText;
      this.isPrefetching = true;

      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voice: 'Kore',
            apiKey: userKey,
            language: currentLanguage
          })
        });

        if (!res.ok) throw new Error(`TTS server returned status ${res.status}`);
        const data = await res.json();

        if (data.audioUrl) {
          await new Promise((resolve) => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = data.audioUrl;
            this.prewarmedAudio = audio;

            const onReady = () => {
              audio.removeEventListener('canplaythrough', onReady);
              audio.removeEventListener('loadeddata', onReady);
              resolve(true);
            };
            audio.addEventListener('canplaythrough', onReady);
            audio.addEventListener('loadeddata', onReady);
            setTimeout(resolve, 2500); // 2.5s audio element buffer timeout
            audio.load();
          });
          console.log('[Voice Pack] Audio pre-warmed & buffered in memory.');
          if (this.pendingPlay) {
            this.pendingPlay = false;
            this.playAudioInstance(this.prewarmedAudio, this.pendingOnStart, this.pendingOnEnd);
          }
          return true;
        }
      } catch (err) {
        console.warn('[Voice Pack Prewarm Error]', err);
      } finally {
        this.isPrefetching = false;
      }
      return false;
    }

    // Pre-warm the voice pack audio in background
    prewarm(text) {
      this.prewarmAsync(text);
    }

    async speak(text, onStart, onEnd, onLoading) {
      this.stop();
      const cleanText = text
        .replace(/[*_#~`]/g, '')
        .replace(/"/g, '')
        .trim();

      // Case 1: Pre-warmed audio is already buffered and ready (0ms initial lag!)
      if (this.prewarmedAudio && this.prewarmedText === cleanText) {
        this.playAudioInstance(this.prewarmedAudio, onStart, onEnd);
        return;
      }

      // Case 2: Audio is currently pre-warming in background
      if (this.isPrefetching && this.prewarmedText === cleanText) {
        this.pendingPlay = true;
        this.pendingOnStart = onStart;
        this.pendingOnEnd = onEnd;
        if (onLoading) onLoading("🔊 Buffering audio...");
        return;
      }

      const userKey = apiKey || localStorage.getItem('cooked_api_key');

      // Case 3: Fetch directly from /api/tts
      if (userKey && userKey.trim() !== '') {
        try {
          this.isLoading = true;
          if (onLoading) onLoading("🔊 Loading audio...");

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              voice: 'Kore',
              apiKey: userKey,
              language: currentLanguage
            })
          });

          const data = await res.json();
          this.isLoading = false;

          if (res.ok && data.audioUrl) {
            const audio = new Audio(data.audioUrl);
            this.prewarmedAudio = audio;
            this.prewarmedText = cleanText;
            this.playAudioInstance(audio, onStart, onEnd);
            return;
          } else {
            console.warn('[TTS Warning]', data.error || data.message);
            showToast(data.message || "Failed to generate audio, falling back...");
          }
        } catch (apiErr) {
          console.warn('[TTS Fetch Error]', apiErr);
          this.isLoading = false;
        }
      } else {
        showToast("🔑 Add your free Gemini API Key in Settings for live voice generation!");
        openApiModal();
      }

      // Fallback: local browser speech synthesis
      this.fallbackSpeak(cleanText, onStart, onEnd);
    }

    playAudioInstance(audio, onStart, onEnd) {
      this.currentAudio = audio;
      audio.currentTime = 0;

      audio.onplay = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.isLoading = false;
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        console.warn('[Audio Playback Error]', e);
        this.currentAudio = null;
        this.fallbackSpeak(this.prewarmedText || '', onStart, onEnd);
      };

      audio.play().catch(err => {
        console.warn('[Audio Play Exception]', err);
        this.fallbackSpeak(this.prewarmedText || '', onStart, onEnd);
      });
    }

    fallbackSpeak(cleanText, onStart, onEnd) {
      if (!this.synth) {
        showToast('TTS is not supported in this browser.');
        if (onEnd) onEnd();
        return;
      }
      this.utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = this.getBestFallbackVoice(currentLanguage);
      if (voice) this.utterance.voice = voice;
      this.utterance.rate = 1.05;

      this.utterance.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.isLoading = false;
        if (onStart) onStart();
      };

      this.utterance.onend = () => {
        this.isSpeaking = false;
        this.isPaused = false;
        if (onEnd) onEnd();
      };

      this.utterance.onerror = (e) => {
        console.warn('Fallback Speech error:', e);
        this.isSpeaking = false;
        this.isPaused = false;
        this.isLoading = false;
        if (onEnd) onEnd();
      };

      this.synth.speak(this.utterance);
    }

    pause() {
      if (this.currentAudio && !this.currentAudio.paused) {
        this.currentAudio.pause();
        this.isPaused = true;
      } else if (this.synth && this.isSpeaking && !this.isPaused) {
        this.synth.pause();
        this.isPaused = true;
      }
    }

    resume() {
      if (this.currentAudio && this.isPaused) {
        this.currentAudio.play();
        this.isPaused = false;
      } else if (this.synth && this.isPaused) {
        this.synth.resume();
        this.isPaused = false;
      }
    }

    stop() {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      if (this.synth) {
        this.synth.cancel();
      }
      this.isSpeaking = false;
      this.isPaused = false;
      this.isLoading = false;
      this.pendingPlay = false;
    }
  }

  const tts = new SpeechController();

  const MODEL_OPTIONS = {
    gemini: [
      { id: 'gemini-3.6-flash', name: 'gemini-3.6-flash (Requested - Gemini 3.6 Flash)' },
      { id: 'gemini-3.6', name: 'gemini-3.6 (Standard Gemini 3.6)' },
      { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash (Gemini 3.8 Flash)' },
      { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite (Ultra Fast)' },
      { id: 'custom', name: '⚙️ Custom Model Identifier (type below)...' }
    ],
    openai: [
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Fast & Low Cost)' },
      { id: 'gpt-4o', name: 'gpt-4o (Maximum Violence)' },
      { id: 'custom', name: '⚙️ Custom Model Identifier (type below)...' }
    ]
  };

  // Initialize
  async function init() {
    setupEventListeners();
    updateToolbarUI();
    updateModelDropdown();
    updateKeyStatusIndicator();
    await checkHealth();
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      serverHasKey = data.hasAnyKey;
      updateKeyStatusIndicator();
    } catch (err) {
      console.warn('Server health check failed:', err);
    }
  }

  // Fetch Non-repetitive questions dynamically from the server
  async function fetchGenderQuestions(shuffle = false) {
    try {
      const res = await fetch(`/api/questions?gender=${currentGender}&lang=${currentLanguage}&t=${Date.now()}`);
      const data = await res.json();
      activeQuestions = data.questions || [];
      userAnswers = new Array(activeQuestions.length).fill(null);
      if (shuffle) showToast('Loaded fresh, randomized questions! 🔀');
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      showToast('Error loading questions.');
    }
  }

  // Navigation
  function showView(viewElement) {
    [viewWelcome, viewQuiz, viewCooking, viewResult].forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Start Quiz
  async function startQuiz() {
    // Read selected gender from radio
    const checkedRadio = document.querySelector('input[name="gender-choice"]:checked');
    if (checkedRadio) currentGender = checkedRadio.value;

    tts.stop();
    window.soundFx.playClick();
    
    // Fetch fresh 5 questions
    await fetchGenderQuestions();
    if (!activeQuestions.length) return;

    currentQIdx = 0;
    const genderLabels = {
      guy: 'Target: Guy / Bro 👦',
      girl: 'Target: Girl / Sis 👧',
      neutral: 'Target: Neutral / Other ✨'
    };
    activePackBadge.textContent = genderLabels[currentGender] || 'Target: Custom Vibe';

    loadQuestion(0);
    showView(viewQuiz);
  }

  // Load Question
  function loadQuestion(idx) {
    currentQIdx = idx;
    const total = activeQuestions.length;
    const q = activeQuestions[idx];

    quizStepText.textContent = `Question ${idx + 1} of ${total}`;
    progressBar.style.width = `${((idx + 1) / total) * 100}%`;
    qCategory.textContent = q.category || q.title.toUpperCase();
    qPrompt.textContent = q.prompt;
    qSubtext.textContent = q.subtext || '';
    answerInput.placeholder = q.placeholder;
    answerInput.value = userAnswers[idx]?.answer || '';

    quickPicks.innerHTML = q.quickPicks.map(text => `
      <button class="chip-btn" data-text="${encodeURIComponent(text)}">
        ${text}
      </button>
    `).join('');

    quickPicks.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundFx.playClick();
        answerInput.value = decodeURIComponent(btn.dataset.text);
        answerInput.focus();
      });
    });

    btnPrevQ.style.display = idx > 0 ? 'inline-block' : 'none';

    if (idx === total - 1) {
      nextBtnText.textContent = currentLanguage === 'manglish' ? 'ROAST CHEYYU 💀' : 'ROAST ME 💀';
      btnNextQ.classList.add('danger-glow');
    } else {
      nextBtnText.textContent = 'Next Question ➔';
      btnNextQ.classList.remove('danger-glow');
    }

    answerInput.focus();
  }

  // Save Current Answer & Proceed
  function proceedNext() {
    const rawAnswer = answerInput.value.trim();
    const currentQ = activeQuestions[currentQIdx];
    const finalAnswer = rawAnswer || currentQ.quickPicks[0];
    
    userAnswers[currentQIdx] = {
      question: currentQ.prompt,
      answer: finalAnswer
    };

    if (currentQIdx < activeQuestions.length - 1) {
      window.soundFx.playClick();
      loadQuestion(currentQIdx + 1);
    } else {
      triggerRoasting();
    }
  }

  // Random Answer Picker
  function pickRandomAnswer() {
    window.soundFx.playClick();
    const currentQ = activeQuestions[currentQIdx];
    const randomIndex = Math.floor(Math.random() * currentQ.quickPicks.length);
    answerInput.value = currentQ.quickPicks[randomIndex];
    answerInput.focus();
  }

  function getEffectiveModel() {
    if (selectedModel === 'custom' && customModelName.trim()) {
      return customModelName.trim();
    }
    return selectedModel;
  }

  // Trigger Roasting Pipeline
  async function triggerRoasting() {
    tts.stop();
    window.soundFx.playDamage();
    showView(viewCooking);

    const effectiveModel = getEffectiveModel();
    const isMallu = currentLanguage === 'manglish';
    const terminalLogs = isMallu ? [
      `> Connecting to Gemini (${effectiveModel}) for [${currentGender.toUpperCase()}]...`,
      "> Auditing your confessions for extreme durandham...",
      "> Calculating negative aura & cringe level...",
      "> Consulting the Kerala Gen-Z psychoanalysis council...",
      "> Synthesizing 100% Karinja Porotta level roast...",
      "> Finalizing lethal mic-drop..."
    ] : [
      `> Connecting to ${currentProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'} (${effectiveModel})...`,
      `> Extracting emotional leverage from [${currentGender.toUpperCase()}] answers...`,
      "> Calculating irreversible negative aura penalties...",
      "> Activating NUCLEAR ego death protocol...",
      "> Translating cope into raw, unadulterated reality check...",
      "> Finalizing lethal mic-drop one-liner..."
    ];

    let logIdx = 0;
    cookingTerminal.textContent = terminalLogs[0];
    cookingInterval = setInterval(() => {
      logIdx = (logIdx + 1) % terminalLogs.length;
      cookingTerminal.textContent = terminalLogs[logIdx];
    }, 850);

    try {
      const response = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: userAnswers,
          gender: currentGender,
          userKey: apiKey,
          provider: currentProvider,
          model: effectiveModel,
          language: currentLanguage,
          spiceLevel: currentSpice
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const roastResult = await response.json();
      currentRoastPayload = roastResult;

      // Coordinate: Only show roast result after voice is also ready!
      const userKey = apiKey || localStorage.getItem('cooked_api_key');
      if (userKey && userKey.trim() !== '') {
        const fullSpeech = `${roastResult.diagnosis || ''}. ${roastResult.deep_roast || ''}. Final verdict: ${roastResult.lethal_one_liner || ''}. Prescribed action: ${roastResult.prescribed_l || ''}`;
        cookingTerminal.textContent = "> Verdict reached! Synthesizing Durandham Jury voice audio...";

        // Wait for voice to finish generation and buffering (with 5.5s safety timeout)
        await Promise.race([
          tts.prewarmAsync(fullSpeech),
          new Promise(resolve => setTimeout(resolve, 5500))
        ]);
      }

      clearInterval(cookingInterval);
      displayRoastResult(roastResult);

    } catch (err) {
      clearInterval(cookingInterval);
      alert('Error during roasting: ' + err.message);
      showView(viewQuiz);
    }
  }

  // Display Result
  function displayRoastResult(data) {
    showView(viewResult);
    window.soundFx.playRandomRoastSound();

    demoBanner.style.display = data.isDemo ? 'block' : 'none';

    statAura.textContent = data.aura_score || '-500,000 Aura';
    statCooked.textContent = data.cooked_level || '100% Karinja Porotta';
    
    const spiceUpper = (data.spiceLevelUsed || currentSpice).toUpperCase();
    if (spiceUpper === 'SENSITIVE') {
      statSpice.textContent = 'SENSITIVE 🌸';
      statSpice.style.color = '#ec4899';
    } else if (spiceUpper === 'SAVAGE') {
      statSpice.textContent = 'SAVAGE 🔥';
      statSpice.style.color = 'var(--neon-yellow)';
    } else {
      statSpice.textContent = 'NUCLEAR ☢️';
      statSpice.style.color = 'var(--neon-red)';
    }

    statLang.textContent = (data.languageUsed || currentLanguage) === 'manglish' ? 'Manglish 🌴' : 'English 🌐';

    roastDiagnosis.textContent = data.diagnosis || 'Stage 5 Chronic Durandham';
    roastMicdrop.textContent = `"${data.lethal_one_liner || 'Nee oru durantham aanu.'}"`;
    roastPrescribed.textContent = data.prescribed_l || 'Achanodu poyi sorry para.';

    // Dynamic Council of Roasters Verdicts
    const verdictNamaste = document.getElementById('verdict-namaste');
    const verdictDramatic = document.getElementById('verdict-dramatic');
    const verdictField = document.getElementById('verdict-field');

    if (verdictNamaste && verdictDramatic && verdictField) {
      if (currentLanguage === 'manglish') {
        if (currentSpice === 'sensitive') {
          verdictNamaste.textContent = `"Pranaamam! You seem like a sweet person who just overthinks too much."`;
          verdictDramatic.textContent = `"Looking at the ceiling thinking about how wholesome your answers are."`;
          verdictField.textContent = `"Fresh air in this paddy field would do wonders for your peace of mind."`;
        } else if (currentSpice === 'savage') {
          verdictNamaste.textContent = `"Pranaamam. Even prayers might struggle to salvage this aura loss, mone."`;
          verdictDramatic.textContent = `"I stared at the ceiling for 10 minutes trying to recover from that confession."`;
          verdictField.textContent = `"Standing in this field wondering why you are wasting youth on your phone."`;
        } else {
          verdictNamaste.textContent = `"Pranaamam. Achanodu ippo thanne poyi kaalil veenu maappu para, mone."`;
          verdictDramatic.textContent = `"I had to look directly into the stage lights because your answers are an OSHA hazard."`;
          verdictField.textContent = `"Drop the phone, step out into this exact mud field, and apologize to the ecosystem."`;
        }
      } else {
        if (currentSpice === 'sensitive') {
          verdictNamaste.textContent = `"Blessings! You have a lovely heart, just remember to take a deep breath."`;
          verdictDramatic.textContent = `"Contemplating the ceiling while smiling at how relatable your quirks are."`;
          verdictField.textContent = `"A peaceful walk out here in the fields would do you wonders."`;
        } else if (currentSpice === 'savage') {
          verdictNamaste.textContent = `"Sending thoughts and prayers because your self-awareness is currently missing in action."`;
          verdictDramatic.textContent = `"I looked up at the ceiling to avoid making eye contact with your digital footprint."`;
          verdictField.textContent = `"I am standing in nature begging you to close your 87 open browser tabs."`;
        } else {
          verdictNamaste.textContent = `"Pranaamam. May history forget every confession you made today."`;
          verdictDramatic.textContent = `"Looking up at the heavens asking why you thought this was acceptable behavior."`;
          verdictField.textContent = `"Throw the phone directly into this muddy soil and touch grass immediately."`;
        }
      }
    }

    resetTTSPlayerState();
    
    // Background pre-warm voice pack audio to eliminate initial lag
    const fullSpeech = `${data.diagnosis || ''}. ${data.deep_roast || ''}. Final verdict: ${data.lethal_one_liner || ''}. Prescribed action: ${data.prescribed_l || ''}`;
    tts.prewarm(fullSpeech);

    typewriterRoast(data.deep_roast || '');
  }

  // Typewriter Effect
  function typewriterRoast(fullText) {
    roastBody.innerHTML = '';
    const paragraphs = fullText.split('\n\n');
    let pIdx = 0;

    function typeNextParagraph() {
      if (pIdx >= paragraphs.length) return;
      const p = document.createElement('p');
      p.style.marginBottom = '16px';
      roastBody.appendChild(p);

      let charIdx = 0;
      const currentParaText = paragraphs[pIdx];
      const speed = 7;

      function typeChar() {
        if (charIdx < currentParaText.length) {
          p.textContent += currentParaText.charAt(charIdx);
          charIdx++;
          setTimeout(typeChar, speed);
        } else {
          pIdx++;
          setTimeout(typeNextParagraph, 100);
        }
      }
      typeChar();
    }

    typeNextParagraph();
  }

  // TTS Readout Helpers (Clean UI - No Voice Pack Names)
  function resetTTSPlayerState() {
    tts.stop();
    ttsEqualizer.classList.remove('speaking');
    ttsStatusText.textContent = '🔊 Audio: Ready';
    btnTtsPlay.style.display = 'inline-block';
    btnTtsPlay.textContent = '▶ Read Out Loud';
    btnTtsPlay.disabled = false;
    btnTtsPause.style.display = 'none';
    btnTtsStop.style.display = 'none';
  }

  function handleTTSPlay() {
    if (!currentRoastPayload) return;
    window.soundFx.playClick();

    if (tts.isPaused) {
      tts.resume();
      ttsEqualizer.classList.add('speaking');
      ttsStatusText.textContent = '🔊 Speaking...';
      btnTtsPlay.style.display = 'none';
      btnTtsPause.style.display = 'inline-block';
      return;
    }

    const fullSpeech = `${currentRoastPayload.diagnosis}. ${currentRoastPayload.deep_roast}. Final verdict: ${currentRoastPayload.lethal_one_liner}. Prescribed action: ${currentRoastPayload.prescribed_l}`;

    btnTtsPlay.disabled = true;
    btnTtsPlay.textContent = '⏳ Loading...';

    tts.speak(
      fullSpeech,
      () => {
        btnTtsPlay.disabled = false;
        ttsEqualizer.classList.add('speaking');
        ttsStatusText.textContent = '🔊 Speaking...';
        btnTtsPlay.style.display = 'none';
        btnTtsPause.style.display = 'inline-block';
        btnTtsStop.style.display = 'inline-block';
      },
      () => {
        resetTTSPlayerState();
      },
      (loadingMsg) => {
        ttsStatusText.textContent = loadingMsg || '🔊 Buffering audio...';
      }
    );
  }

  function handleTTSPause() {
    window.soundFx.playClick();
    tts.pause();
    ttsEqualizer.classList.remove('speaking');
    ttsStatusText.textContent = '⏸ Paused';
    btnTtsPause.style.display = 'none';
    btnTtsPlay.style.display = 'inline-block';
    btnTtsPlay.textContent = '▶ Resume';
  }

  function handleTTSStop() {
    window.soundFx.playClick();
    resetTTSPlayerState();
  }

  // Copy Roast To Clipboard
  function copyRoast() {
    if (!currentRoastPayload) return;
    window.soundFx.playClick();

    const textToCopy = `🔥 COOKED AI ROAST REPORT 🔥
----------------------------------------
💀 DIAGNOSIS: ${currentRoastPayload.diagnosis}
📉 AURA PENALTY: ${currentRoastPayload.aura_score}
🍳 COOKED STATUS: ${currentRoastPayload.cooked_level}
👤 TARGET: ${currentGender.toUpperCase()}
🌶️ SPICE: ${currentRoastPayload.spiceLevelUsed || currentSpice}
🗣️ DIALECT: ${currentRoastPayload.languageUsed || currentLanguage}

💬 THE DEEP ROAST:
${currentRoastPayload.deep_roast}

☠️ MIC DROP:
"${currentRoastPayload.lethal_one_liner}"

🌱 PRESCRIBED REHABILITATION:
${currentRoastPayload.prescribed_l}
----------------------------------------
Cooked with CookedAI (Gemini 3.6)`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast('Roast copied to clipboard! 📋');
    }).catch(() => {
      showToast('Failed to copy. Check clipboard permissions.');
    });
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function updateToolbarUI() {
    if (currentLanguage === 'manglish') {
      pillLangManglish.classList.add('active');
      pillLangEnglish.classList.remove('active');
    } else {
      pillLangEnglish.classList.add('active');
      pillLangManglish.classList.remove('active');
    }

    pillSpiceSensitive.classList.remove('sensitive-active');
    pillSpiceSavage.classList.remove('active');
    pillSpiceNuclear.classList.remove('nuclear-active');

    if (currentSpice === 'sensitive') {
      pillSpiceSensitive.classList.add('sensitive-active');
    } else if (currentSpice === 'savage') {
      pillSpiceSavage.classList.add('active');
    } else {
      pillSpiceNuclear.classList.add('nuclear-active');
    }
  }

  function updateModelDropdown() {
    const provider = modalProviderSelect.value || currentProvider;
    const options = MODEL_OPTIONS[provider] || MODEL_OPTIONS.gemini;

    modalModelSelect.innerHTML = options.map(opt => `
      <option value="${opt.id}" ${opt.id === selectedModel ? 'selected' : ''}>
        ${opt.name}
      </option>
    `).join('');

    toggleCustomModelField();

    if (provider === 'gemini') {
      geminiHelpBox.style.display = 'block';
      labelApiKey.textContent = 'Google Gemini API Key (starts with AIza...)';
      modalApiKeyInput.placeholder = 'AIzaSy...';
    } else {
      geminiHelpBox.style.display = 'none';
      labelApiKey.textContent = 'OpenAI API Key (starts with sk-...)';
      modalApiKeyInput.placeholder = 'sk-proj-...';
    }
  }

  function toggleCustomModelField() {
    if (modalModelSelect.value === 'custom') {
      customModelGroup.style.display = 'block';
      customModelInput.value = customModelName;
    } else {
      customModelGroup.style.display = 'none';
    }
  }

  function updateKeyStatusIndicator() {
    const hasKey = Boolean(apiKey || serverHasKey);
    if (hasKey) {
      keyDot.classList.add('active');
      keyBtnLabel.textContent = `${currentProvider === 'gemini' ? 'Gemini 3.6' : 'OpenAI'} Key Active`;
      btnApiModal.title = `Active: ${currentProvider} (${getEffectiveModel()})`;
    } else {
      keyDot.classList.remove('active');
      keyBtnLabel.textContent = 'AI Key (Free Tier)';
      btnApiModal.title = 'No API Key set (Running Demo Mode)';
    }
  }

  // Event Listeners
  function setupEventListeners() {
    btnSound.addEventListener('click', () => {
      const isEnabled = window.soundFx.toggle();
      soundIcon.textContent = isEnabled ? '🔊' : '🔇';
      showToast(isEnabled ? 'Sound Effects Enabled 🔊' : 'Sound Effects Muted 🔇');
    });

    genderRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        window.soundFx.playClick();
        currentGender = e.target.value;
      });
    });

    // Shuffle questions button inside the quiz card
    btnShuffleQuestions.addEventListener('click', async () => {
      window.soundFx.playClick();
      await fetchGenderQuestions(true);
      if (activeQuestions.length) {
        currentQIdx = 0;
        loadQuestion(0);
      }
    });

    pillLangManglish.addEventListener('click', async () => {
      window.soundFx.playClick();
      currentLanguage = 'manglish';
      localStorage.setItem('cooked_lang', 'manglish');
      updateToolbarUI();
      showToast('Switched to Gen-Z Manglish (Mallu Mode) 🌴');
      if (activeQuestions.length) {
        await fetchGenderQuestions();
        loadQuestion(currentQIdx);
      }
    });

    pillLangEnglish.addEventListener('click', async () => {
      window.soundFx.playClick();
      currentLanguage = 'english';
      localStorage.setItem('cooked_lang', 'english');
      updateToolbarUI();
      showToast('Switched to Global English 🌐');
      if (activeQuestions.length) {
        await fetchGenderQuestions();
        loadQuestion(currentQIdx);
      }
    });

    pillSpiceSensitive.addEventListener('click', () => {
      window.soundFx.playClick();
      currentSpice = 'sensitive';
      localStorage.setItem('cooked_spice', 'sensitive');
      updateToolbarUI();
      showToast('Spice Level: Sensitive 🌸 (Gentle & Clean)');
    });

    pillSpiceSavage.addEventListener('click', () => {
      window.soundFx.playClick();
      currentSpice = 'savage';
      localStorage.setItem('cooked_spice', 'savage');
      updateToolbarUI();
      showToast('Spice Level: Savage 🔥 (Wild Aggressive)');
    });

    pillSpiceNuclear.addEventListener('click', () => {
      window.soundFx.playDamage();
      currentSpice = 'nuclear';
      localStorage.setItem('cooked_spice', 'nuclear');
      updateToolbarUI();
      showToast('Spice Level: NUCLEAR ☢️ (Absolutely Aggressive)');
    });

    btnTtsPlay.addEventListener('click', handleTTSPlay);
    btnTtsPause.addEventListener('click', handleTTSPause);
    btnTtsStop.addEventListener('click', handleTTSStop);

    btnApiModal.addEventListener('click', () => {
      modalProviderSelect.value = currentProvider;
      updateModelDropdown();
      modalApiKeyInput.value = apiKey;
      customModelInput.value = customModelName;
      apiModal.classList.add('open');
    });

    btnCloseModal.addEventListener('click', () => {
      apiModal.classList.remove('open');
    });

    apiModal.addEventListener('click', (e) => {
      if (e.target === apiModal) apiModal.classList.remove('open');
    });

    modalProviderSelect.addEventListener('change', () => {
      updateModelDropdown();
    });

    modalModelSelect.addEventListener('change', () => {
      toggleCustomModelField();
    });

    modalApiKeyInput.addEventListener('input', () => {
      const val = modalApiKeyInput.value.trim();
      if (val.startsWith('AIza') && modalProviderSelect.value !== 'gemini') {
        modalProviderSelect.value = 'gemini';
        updateModelDropdown();
        showToast('Detected Google Gemini Key! 💎');
      } else if (val.startsWith('sk-') && modalProviderSelect.value !== 'openai') {
        modalProviderSelect.value = 'openai';
        updateModelDropdown();
        showToast('Detected OpenAI ChatGPT Key! 🟢');
      }
    });

    btnSaveKey.addEventListener('click', () => {
      const newKey = modalApiKeyInput.value.trim();
      const newProvider = modalProviderSelect.value;
      const newModel = modalModelSelect.value;
      const newCustom = customModelInput.value.trim();

      apiKey = newKey;
      currentProvider = newProvider;
      selectedModel = newModel;
      customModelName = newCustom;

      if (newKey) {
        localStorage.setItem('cooked_api_key', newKey);
      } else {
        localStorage.removeItem('cooked_api_key');
      }
      localStorage.setItem('cooked_provider', newProvider);
      localStorage.setItem('cooked_model', newModel);
      localStorage.setItem('cooked_custom_model', newCustom);

      updateKeyStatusIndicator();
      apiModal.classList.remove('open');
      window.soundFx.playClick();
      showToast(newKey ? `${newProvider === 'gemini' ? 'Gemini 3.6' : 'OpenAI'} Saved! ⚡` : 'Running in Demo Mode');
    });

    btnClearKey.addEventListener('click', () => {
      apiKey = '';
      modalApiKeyInput.value = '';
      localStorage.removeItem('cooked_api_key');
      updateKeyStatusIndicator();
      apiModal.classList.remove('open');
      showToast('Key removed. Switched to Demo Mode.');
    });

    btnStartQuiz.addEventListener('click', startQuiz);
    btnNextQ.addEventListener('click', proceedNext);
    btnPrevQ.addEventListener('click', () => {
      if (currentQIdx > 0) {
        window.soundFx.playClick();
        loadQuestion(currentQIdx - 1);
      }
    });

    btnRandomPick.addEventListener('click', pickRandomAnswer);

    answerInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        proceedNext();
      }
    });

    btnCopyRoast.addEventListener('click', copyRoast);
    btnRestart.addEventListener('click', () => {
      tts.stop();
      window.soundFx.playClick();
      showView(viewWelcome);
    });
    btnVineBoom.addEventListener('click', () => {
      window.soundFx.playRandomRoastSound();
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
