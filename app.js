/**
 * Main Application & Game Loop Controller for UV Handwashing Game
 * Exposes global window handlers for 100% fail-proof HTML click responsiveness.
 */

// Global State
window.gameStarted = false;
window.easyMode = false; // Default: 6-step selection mode (~30% relaxed parameters)
window.selectedDuration = 45; // Default balanced 45 seconds
window.timerSeconds = 45;
window.timerInterval = null;
window.currentStepId = 1;
window.cleanPercent = 0;
window.feedbackTimeout = null;
window.completedSteps = new Set();

let canvasEngine = null;

function initGameApp() {
    if (window.gameAppInitialized) return;
    window.gameAppInitialized = true;

    // 1. Initialize Canvas Engine
    canvasEngine = new HandCanvasEngine('hand-canvas', 'canvas-container');
    window.canvasEngine = canvasEngine;

    // 2. Connect Canvas Callbacks
    canvasEngine.onScrubCallback = (zoneKey, x, y) => {
        if (!window.gameStarted) {
            window.startGame();
        }
        sounds.playScrubSound();

        if (window.easyMode) {
            const autoStepId = getStepIdForZone(zoneKey);
            if (autoStepId && autoStepId !== window.currentStepId) {
                window.selectStep(autoStepId);
            }
            return { allowed: true };
        }

        const allowed = isZoneAllowedInStep(zoneKey, window.currentStepId, false);
        if (!allowed) {
            sounds.playWarningSound();
            const warnMsg = getStepWarningMessage(zoneKey);
            window.showFeedback(warnMsg, true);
            return { allowed: false };
        }
        return { allowed: true };
    };

    canvasEngine.onProgressUpdateCallback = (percent, zonesData) => {
        window.cleanPercent = percent;
        const cleanPercentText = document.getElementById('clean-percent-text');
        const cleanBar = document.getElementById('clean-bar');
        if (cleanPercentText) cleanPercentText.textContent = `${percent}%`;
        if (cleanBar) cleanBar.style.width = `${percent}%`;

        // Check step completion (Relaxed threshold: 30% clean clears step)
        Object.keys(zonesData).forEach(zk => {
            const zd = zonesData[zk];
            if (zd && zd.count > 0) {
                const sId = getStepIdForZone(zk);
                const reqThreshold = 0.30;
                if ((zd.cleared / zd.count) >= reqThreshold) {
                    window.markStepCompleted(sId);
                }
            }
        });

        if (window.cleanPercent >= 100 && window.gameStarted) {
            window.endGame(true);
        }
    };

    // Bind event listeners as secondary backup
    bindUIEventListeners();

    window.hideResultModal();
    window.hideHelpModal();
    canvasEngine.setViewMode('palm');
    canvasEngine.setActiveZone(HANDWASHING_STEPS[1].targetZone);

    setTimeout(() => {
        if (canvasEngine) canvasEngine.initCanvasSize();
    }, 100);
    setTimeout(() => {
        if (canvasEngine) canvasEngine.initCanvasSize();
    }, 400);
}

// Global UI Action Methods attached to Window
window.setTimeDuration = function(duration) {
    window.selectedDuration = parseInt(duration, 10);
    window.timerSeconds = window.selectedDuration;

    const timeSelectBtns = document.querySelectorAll('.time-select-btn');
    const overlayTimeBtns = document.querySelectorAll('.overlay-time-btn');
    const overlayStartBtnText = document.getElementById('overlay-start-btn-text');

    timeSelectBtns.forEach(btn => {
        const t = parseInt(btn.getAttribute('data-time'), 10);
        if (t === window.selectedDuration) {
            btn.className = 'time-select-btn active px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-600 text-white';
        } else {
            btn.className = 'time-select-btn px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700 text-slate-300 hover:bg-slate-600';
        }
    });

    overlayTimeBtns.forEach(btn => {
        const t = parseInt(btn.getAttribute('data-time'), 10);
        if (t === window.selectedDuration) {
            btn.className = 'overlay-time-btn active px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 text-white shadow';
        } else {
            btn.className = 'overlay-time-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700';
        }
    });

    if (overlayStartBtnText) {
        overlayStartBtnText.textContent = window.selectedDuration === 0 ? '무제한 실습 시작하기' : `${window.selectedDuration}초 실습 시작하기`;
    }

    window.updateTimerDisplay();
};

window.startGame = function(initialStep = 1) {
    window.gameStarted = true;
    window.timerSeconds = window.selectedDuration;
    window.cleanPercent = 0;
    window.completedSteps.clear();

    const startOverlay = document.getElementById('start-overlay');
    const startBtnLabel = document.getElementById('start-btn-label');
    const stepBtns = document.querySelectorAll('.step-btn');

    if (startOverlay) startOverlay.style.display = 'none';
    if (startBtnLabel) startBtnLabel.textContent = '실습 재시작';
    window.hideResultModal();

    stepBtns.forEach(btn => btn.classList.remove('completed'));

    if (canvasEngine) {
        canvasEngine.generateGermParticles();
        canvasEngine.render();
    }

    window.updateTimerDisplay();

    clearInterval(window.timerInterval);
    if (window.selectedDuration > 0) {
        window.timerInterval = setInterval(() => {
            window.timerSeconds--;
            window.updateTimerDisplay();

            if (window.timerSeconds <= 0) {
                window.endGame(false);
            }
        }, 1000);
    }

    window.selectStep(initialStep);
};

window.endGame = function(isPerfect = false) {
    window.gameStarted = false;
    clearInterval(window.timerInterval);

    if (isPerfect) {
        sounds.playVictorySound();
    }
    window.showResults();
};

window.updateTimerDisplay = function() {
    const timerText = document.getElementById('timer-text');
    const timerRing = document.getElementById('timer-progress-ring');
    if (!timerText || !timerRing) return;

    if (window.selectedDuration === 0) {
        timerText.textContent = '∞';
        timerRing.style.strokeDashoffset = 0;
        timerRing.classList.remove('text-rose-500');
        timerRing.classList.add('text-cyan-400');
        return;
    }

    timerText.textContent = window.timerSeconds;
    const totalDash = 106.8;
    const offset = totalDash - (window.timerSeconds / window.selectedDuration) * totalDash;
    timerRing.style.strokeDashoffset = offset;

    if (window.timerSeconds <= 10) {
        timerRing.classList.remove('text-cyan-400');
        timerRing.classList.add('text-rose-500');
    } else {
        timerRing.classList.remove('text-rose-500');
        timerRing.classList.add('text-cyan-400');
    }
};

window.selectStep = function(stepId) {
    window.currentStepId = parseInt(stepId, 10);
    const config = HANDWASHING_STEPS[window.currentStepId];
    if (!config) return;

    if (config.requiredView === 'back' && canvasEngine.viewMode !== 'back') {
        window.switchViewMode('back');
    } else if (config.requiredView === 'palm' && canvasEngine.viewMode !== 'palm') {
        window.switchViewMode('palm');
    }

    if (canvasEngine) {
        canvasEngine.setActiveZone(config.targetZone);
    }

    const stepBtns = document.querySelectorAll('.step-btn');
    stepBtns.forEach(btn => {
        if (parseInt(btn.getAttribute('data-step'), 10) === window.currentStepId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const stepBadge = document.getElementById('step-badge');
    const stepTitle = document.getElementById('step-title');
    const stepDesc = document.getElementById('step-desc');
    const stepTargetTag = document.getElementById('step-target-tag');

    if (stepBadge) stepBadge.textContent = config.id;
    if (stepTitle) stepTitle.textContent = config.title;
    if (stepDesc) stepDesc.textContent = config.desc;
    if (stepTargetTag) stepTargetTag.textContent = `Target: ${config.targetLabel}`;

    sounds.playSwitchSound();
};

window.markStepCompleted = function(stepId) {
    if (!window.completedSteps.has(stepId)) {
        window.completedSteps.add(stepId);
        const btn = document.querySelector(`.step-btn[data-step="${stepId}"]`);
        if (btn) {
            btn.classList.add('completed');
        }
        sounds.playStepChime();
        window.showFeedback(`✨ ${HANDWASHING_STEPS[stepId].shortTitle} 완료!`, false);
    }
};

window.showFeedback = function(msg, isWarning = false) {
    const feedbackBubble = document.getElementById('feedback-bubble');
    const feedbackBubbleText = document.getElementById('feedback-bubble-text');
    if (!feedbackBubble || !feedbackBubbleText) return;

    feedbackBubbleText.textContent = msg;
    if (isWarning) {
        feedbackBubble.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500/90 text-slate-900 px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 border border-amber-300 opacity-100 shake-bubble transition-all duration-300 z-30';
    } else {
        feedbackBubble.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500/90 text-white px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 border border-emerald-300 opacity-100 transition-all duration-300 z-30';
    }

    clearTimeout(window.feedbackTimeout);
    window.feedbackTimeout = setTimeout(() => {
        feedbackBubble.classList.add('opacity-0');
        feedbackBubble.classList.remove('opacity-100');
    }, 2200);
};

window.switchViewMode = function(mode) {
    const viewPalmBtn = document.getElementById('view-palm-btn');
    const viewBackBtn = document.getElementById('view-back-btn');

    if (mode === 'palm') {
        if (viewPalmBtn) viewPalmBtn.className = 'px-3 py-1.5 rounded-md font-bold transition bg-cyan-600 text-white shadow';
        if (viewBackBtn) viewBackBtn.className = 'px-3 py-1.5 rounded-md font-bold transition text-slate-400 hover:text-white';
        if (canvasEngine) canvasEngine.setViewMode('palm');
    } else {
        if (viewBackBtn) viewBackBtn.className = 'px-3 py-1.5 rounded-md font-bold transition bg-cyan-600 text-white shadow';
        if (viewPalmBtn) viewPalmBtn.className = 'px-3 py-1.5 rounded-md font-bold transition text-slate-400 hover:text-white';
        if (canvasEngine) canvasEngine.setViewMode('back');
    }
};

window.toggleUV = function() {
    if (!canvasEngine) return;
    const isON = canvasEngine.uvLightOn;
    canvasEngine.setUVMode(!isON);
    const uvStatusText = document.getElementById('uv-status-text');
    if (uvStatusText) {
        uvStatusText.textContent = !isON ? 'ON' : 'OFF';
        uvStatusText.className = !isON ? 'text-emerald-400' : 'text-rose-400';
    }
    sounds.playSwitchSound();
};

window.toggleSound = function() {
    const enabled = sounds.toggleSound();
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) {
        soundIcon.className = enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark text-rose-400';
    }
};

window.toggleEasyMode = function() {
    window.easyMode = !window.easyMode;
    const easyModeStatusText = document.getElementById('easy-mode-status-text');
    const easyModeBtn = document.getElementById('easy-mode-btn');

    if (window.easyMode) {
        if (easyModeStatusText) {
            easyModeStatusText.textContent = '✨ 쉬운 모드 (자유 문지르기)';
            easyModeStatusText.className = 'text-amber-300';
        }
        if (easyModeBtn) {
            easyModeBtn.className = 'px-3 py-2 rounded-lg bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-500/60 text-emerald-200 text-xs font-bold transition flex items-center gap-1.5 shadow-inner';
        }
        window.showFeedback('✨ 쉬운 모드: 어디든 문지르면 세균이 지워집니다!', false);
    } else {
        if (easyModeStatusText) {
            easyModeStatusText.textContent = '🎯 6단계 실습 모드';
            easyModeStatusText.className = 'text-cyan-300';
        }
        if (easyModeBtn) {
            easyModeBtn.className = 'px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-inner';
        }
        window.showFeedback('🎯 6단계 실습 모드: 6단계를 순서대로 선택하여 닦으세요!', false);
    }
    sounds.playSwitchSound();
};

window.showResults = function() {
    const finalCleanRate = document.getElementById('final-clean-rate');
    const finalRating = document.getElementById('final-rating');
    const finalZoneList = document.getElementById('final-zone-list');
    const finalEvalMsg = document.getElementById('final-eval-msg');
    const resultModal = document.getElementById('result-modal');

    if (finalCleanRate) finalCleanRate.textContent = `${window.cleanPercent}%`;

    if (finalRating && finalEvalMsg) {
        if (window.cleanPercent >= 90) {
            finalRating.textContent = '⭐⭐⭐ 손씻기 왕!';
            finalEvalMsg.textContent = '👏 대단합니다! 6단계를 완벽하게 지켜 세균을 구석구석 100% 제거했습니다. 교실과 일상생활에서도 올바른 손씻기를 실천해 감염병을 예방하세요!';
        } else if (window.cleanPercent >= 50) {
            finalRating.textContent = '⭐⭐ 우수함!';
            finalEvalMsg.textContent = '👍 참 잘했습니다! 대부분의 세균을 지웠으나 손톱 밑이나 손가락 사이에 세균이 조금 남아있습니다. 6단계를 조금 더 꼼꼼히 문질러보세요!';
        } else {
            finalRating.textContent = '⭐ 노력 필요!';
            finalEvalMsg.textContent = '💡 손을 더 꼼꼼히 씻어야 해요! 단순히 문지르기만 하면 손톱 밑 세균이 남아있습니다. 다시 한번 6단계를 맞춰 도전해보세요!';
        }
    }

    if (finalZoneList && canvasEngine) {
        finalZoneList.innerHTML = '';
        Object.keys(canvasEngine.zonesData).forEach(k => {
            const zd = canvasEngine.zonesData[k];
            const rate = zd.count > 0 ? Math.round((zd.cleared / zd.count) * 100) : 100;
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-700/60';
            item.innerHTML = `
                <span>${zd.label}</span>
                <span class="${rate >= 50 ? 'text-emerald-400 font-bold' : 'text-amber-400'}">${rate}% 제거</span>
            `;
            finalZoneList.appendChild(item);
        });
    }

    if (resultModal) {
        resultModal.style.display = 'flex';
        resultModal.classList.remove('opacity-0', 'pointer-events-none', 'hidden-modal');
        resultModal.classList.add('opacity-100', 'show-modal');
    }
};

window.hideResultModal = function() {
    const resultModal = document.getElementById('result-modal');
    if (resultModal) {
        resultModal.style.display = 'none';
        resultModal.classList.add('opacity-0', 'pointer-events-none', 'hidden-modal');
        resultModal.classList.remove('opacity-100', 'show-modal');
    }
};

window.showHelpModal = function() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.style.display = 'flex';
        helpModal.classList.remove('opacity-0', 'pointer-events-none', 'hidden-modal');
        helpModal.classList.add('opacity-100', 'show-modal');
    }
};

window.hideHelpModal = function() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.style.display = 'none';
        helpModal.classList.add('opacity-0', 'pointer-events-none', 'hidden-modal');
        helpModal.classList.remove('opacity-100', 'show-modal');
    }
};

function bindUIEventListeners() {
    const startGameBtn = document.getElementById('start-game-btn');
    const overlayStartBtn = document.getElementById('overlay-start-btn');
    const easyModeBtn = document.getElementById('easy-mode-btn');
    const uvToggleBtn = document.getElementById('uv-toggle-btn');
    const soundBtn = document.getElementById('sound-btn');
    const viewPalmBtn = document.getElementById('view-palm-btn');
    const viewBackBtn = document.getElementById('view-back-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const retryBtn = document.getElementById('retry-btn');
    const printBtn = document.getElementById('print-btn');
    const helpBtn = document.getElementById('help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const confirmHelpBtn = document.getElementById('confirm-help-btn');

    if (startGameBtn) startGameBtn.addEventListener('click', () => window.startGame());
    if (overlayStartBtn) overlayStartBtn.addEventListener('click', () => window.startGame());
    if (easyModeBtn) easyModeBtn.addEventListener('click', () => window.toggleEasyMode());
    if (uvToggleBtn) uvToggleBtn.addEventListener('click', () => window.toggleUV());
    if (soundBtn) soundBtn.addEventListener('click', () => window.toggleSound());
    if (viewPalmBtn) viewPalmBtn.addEventListener('click', () => window.switchViewMode('palm'));
    if (viewBackBtn) viewBackBtn.addEventListener('click', () => window.switchViewMode('back'));
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => window.hideResultModal());
    if (retryBtn) retryBtn.addEventListener('click', () => { window.hideResultModal(); window.startGame(); });
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    if (helpBtn) helpBtn.addEventListener('click', () => window.showHelpModal());
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => window.hideHelpModal());
    if (confirmHelpBtn) confirmHelpBtn.addEventListener('click', () => window.hideHelpModal());

    document.querySelectorAll('.time-select-btn, .overlay-time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const time = btn.getAttribute('data-time');
            window.setTimeDuration(time);
        });
    });

    document.querySelectorAll('.step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.getAttribute('data-step'), 10);
            if (!window.gameStarted) {
                window.startGame(step);
            } else {
                window.selectStep(step);
            }
        });
    });
}

// Instant Execution + DOMContentLoaded + window.onload guarantees initialization
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initGameApp();
} else {
    document.addEventListener('DOMContentLoaded', initGameApp);
    window.addEventListener('load', initGameApp);
}
