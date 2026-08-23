// =========================================================
// RUNTIME ENGINE STATE TRUCKING MANAGEMENT
// =========================================================
window.activeQuizSession = {
    quizData: null,
    flatQuestionsList: [],
    currentQuestionIndex: 0,
    studentResponses: {}, // Maps flatIndex -> { chosenAnswer: string, isCorrect: boolean, score: number, textSubmission: string }
    storageKey: ""
};

// =========================================================
// STUDENT PORTAL INTERACTIVE CLICK LAUNCH HANDLER 
// =========================================================
window.launchTargetAssessmentInstance = function(storageKey, itemIndex) {
    try {
        // 📸 THE BACKUP SNAPSHOT: Save exactly what is on the screen right now before the quiz destroys it
        const portalContainer = document.getElementById('active-quiz-questions-portal');
        if (portalContainer) {
            window.lastActivePapersHTMLSnapshot = portalContainer.innerHTML;
        }

        // 📡 DATABASE DATA SOURCE: Read from our live synchronized database memory cache instead of localStorage
        if (!window.cachedQuizBlueprints || !window.cachedQuizBlueprints[storageKey]) {
            console.error(`❌ Active cache allocation missing for target database footprint: ${storageKey}`);
            alert("⚠️ Failed to synchronize live question dataset. Please refresh the category tab workspace.");
            return;
        }

        let quizCollectionArray = window.cachedQuizBlueprints[storageKey];
        quizCollectionArray = Array.isArray(quizCollectionArray) ? quizCollectionArray : [quizCollectionArray];
        
        const targetQuizData = quizCollectionArray[itemIndex];
        if (!targetQuizData) {
            console.error(`❌ Index ${itemIndex} out of bounds for database cache matrix: ${storageKey}`);
            return;
        }

        // 💾 STATE PERSISTENCE: Cache storageKey globally for the Quit/Exit router track
        window.currentQuizStorageKey = storageKey;

        // Initialize Runtime Master Object Data safely
        window.activeQuizSession = window.activeQuizSession || {};
        window.activeQuizSession.quizData = targetQuizData;
        window.activeQuizSession.storageKey = storageKey;
        window.activeQuizSession.currentQuestionIndex = 0;
        window.activeQuizSession.studentResponses = {};
        window.activeQuizSession.flatQuestionsList = [];
        
        // 🌟 NEW SELECTION STATE TRACKERS INITIALIZED
        window.activeQuizSession.chosenQuestionIds = new Set();      // Holds global indices of checked questions
        window.activeQuizSession.completedPreSelections = new Set(); // Holds section IDs where "Proceed" was clicked

        // Compile multi-section questions or flat arrays into a direct sequential index list tracking structure
        if (targetQuizData.examDataStructure && targetQuizData.examDataStructure.length > 0) {
            targetQuizData.examDataStructure.forEach((section) => {
                if (!section.questions) return;
                
                // 🌟 Create a safe, unique section ID grouping handle
                const uniqueSectionId = `sec-${section.sectionHeading?.replace(/\s+/g, '').toLowerCase() || 'default'}`;
                
                section.questions.forEach(q => {
                    // 🎯 FIX: Intelligently detect if section details are present instead of checking targetQuizData.isSectionedExam
                    const hasSectionDetails = !!(section.sectionHeading || section.sectionLetter);

                    // Inject section tracking information directly onto the question object blueprint wrapper
                    window.activeQuizSession.flatQuestionsList.push({
                        ...q,
                        belongsToSectionHeading: hasSectionDetails ? section.sectionHeading : null,
                        belongsToSectionInstructions: hasSectionDetails ? section.sectionInstructions : null,
                        
                        // 🔮 NEW INTEGRATION PROPERTIES FOR THE CHOICE MATRIX ENGINE
                        // If no required count exists or it matches total items, it defaults to the full length (Answer All)
                        sectionRequiredCount: section.requiredQuestionCount ? parseInt(section.requiredQuestionCount) : section.questions.length,
                        totalSectionQuestionsCount: section.questions.length,
                        sectionId: uniqueSectionId
                    });
                });
            });
        }

        if (window.activeQuizSession.flatQuestionsList.length === 0) {
            alert("⚠️ This assessment blueprint contains no structured question data fields.");
            return;
        }

        // 1. ENTER DISTRACTION-FREE FULLSCREEN LOOK MODE
        // Force hide sidebar using high-priority inline overrides & standard utility classes
        const academicSidebar = document.getElementById('sidebar-container') || document.querySelector('aside, .academic-navigation-sidebar, [class*="sidebar"]');
        if (academicSidebar) {
            academicSidebar.style.setProperty('display', 'none', 'important');
            academicSidebar.classList.add('hidden');
        }
        
        // Expand the dashboard main wrapper to take 100% width and drop grid template columns
        const dashboardContent = document.getElementById('dashboard-content');
        if (dashboardContent) {
            dashboardContent.style.width = '100%';
            dashboardContent.style.maxWidth = '100%';
        }

        const mainLayoutGrid = dashboardContent?.parentElement || document.querySelector('main')?.parentElement;
        if (mainLayoutGrid) {
            mainLayoutGrid.style.gridTemplateColumns = '1fr';
            mainLayoutGrid.style.display = 'block'; // Prevents CSS Grid gaps from preserving left-side margin space
        }

        // Fire the individual question viewport rendering engine block loop
        window.renderActiveQuizEngineViewItem();

    } catch(e) {
        console.error("Failed to route active quiz card activation click profile", e);
    }
};
// =========================================================
// SEQUENTIAL QUESTION RENDERING VIEW ENGINE (UPDATED DESIGN)
// =========================================================
// Global handler to save text answers directly into active session state
window.handleQuizResponseInput = function(key, value) {
    const session = window.activeQuizSession;
    if (!session) return;
    if (!session.studentResponses) session.studentResponses = {};
    session.studentResponses[key] = value;
};


   // =========================================================
// SEQUENTIAL QUESTION RENDERING VIEW ENGINE (FIXED)
// =========================================================
window.renderActiveQuizEngineViewItem = function() {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // Override parent dashboard centering to allow top-aligned scrolling
    contentArea.classList.remove('items-center', 'justify-center');
    contentArea.classList.add('items-start', 'justify-start');

    // Hide main platform header bar during active quiz execution
    const mainPlatformHeader = document.querySelector('header') || document.getElementById('main-header') || document.querySelector('nav');
    if (mainPlatformHeader) {
        mainPlatformHeader.classList.add('hidden');
    }

    const session = window.activeQuizSession;
    const currentIndex = session.currentQuestionIndex;
    const totalQuestions = session.flatQuestionsList.length;
    const currentQuestion = session.flatQuestionsList[currentIndex];

    // Reset tracking pointers whenever switching to a new main question block
    if (session.lastTrackedParentIndex !== currentIndex) {
        session.currentSubQuestionIndex = 0;
        session.currentSubPartIndex = 0;
        session.lastTrackedParentIndex = currentIndex;
    } else {
        if (session.currentSubQuestionIndex === undefined) session.currentSubQuestionIndex = 0;
        if (session.currentSubPartIndex === undefined) session.currentSubPartIndex = 0;
    }

    // =========================================================================
    // STEP 2 INTERCEPTOR: PRE-SELECTION MATRIX RADAR GATE
    // =========================================================================
    if (currentQuestion.sectionRequiredCount < currentQuestion.totalSectionQuestionsCount) {
        const currentSectionId = currentQuestion.sectionId;

        if (!session.completedPreSelections.has(currentSectionId)) {
            const peerQuestions = session.flatQuestionsList.filter(q => q.sectionId === currentSectionId);
            const requiredCount = currentQuestion.sectionRequiredCount;

            let matrixQuestionsHTML = "";
            peerQuestions.forEach((q, idx) => {
                const globalIndex = session.flatQuestionsList.indexOf(q);
                const isChecked = session.chosenQuestionIds.has(globalIndex) ? "checked" : "";
                
                matrixQuestionsHTML += `
                    <label class="flex items-start space-x-4 p-4 bg-slate-900/40 border border-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-900/80 hover:border-purple-500/30 transition-all select-none group">
                        <div class="mt-0.5 flex items-center justify-center">
                            <input type="checkbox" 
                                name="matrix-choice" 
                                value="${globalIndex}" 
                                ${isChecked}
                                onchange="window.handleMatrixSelectionChange('${currentSectionId}', ${requiredCount})"
                                class="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-800 focus:ring-purple-500/50 focus:ring-2 accent-purple-500 cursor-pointer">
                        </div>
                        <div class="space-y-1">
                            <span class="text-[9px] font-mono font-black text-purple-400 uppercase tracking-widest block">Option 0${idx + 1}</span>
                            <p class="text-[11px] font-sans font-medium text-slate-200 leading-relaxed group-hover:text-white transition-colors">${q.questionText}</p>
                        </div>
                    </label>
                `;
            });

            contentArea.innerHTML = `
                <div class="absolute inset-0 w-full h-full overflow-y-auto bg-slate-950/20 custom-scrollbar-shell" style="scroll-behavior: smooth;">
                    <div class="w-full max-w-3xl mx-auto flex flex-col pt-12 px-6 pb-16 animate-in fade-in duration-300 space-y-6">
                        
                        <div class="p-5 rounded-xl border border-purple-500/10 bg-purple-950/5">
                            <h3 class="text-xs font-black text-purple-400 uppercase tracking-widest mb-1.5">
                                ${currentQuestion.belongsToSectionHeading || 'Section Choice Block'}
                            </h3>
                            <p class="text-[10px] text-slate-300 font-sans font-semibold uppercase tracking-wider leading-relaxed border-t border-slate-900/40 pt-2 mt-2">
                                ${currentQuestion.belongsToSectionInstructions || 'Please make your choices below.'}
                            </p>
                        </div>

                        <div class="flex items-center justify-between border-b border-slate-800/40 pb-3">
                            <h4 class="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">Available Layout Selection Matrix</h4>
                            <span id="matrix-counter-badge" class="px-3 py-1 bg-purple-600/10 border border-purple-600/20 text-purple-400 font-mono text-[9px] font-black rounded-lg uppercase tracking-wider">
                                Selected: 0 / ${requiredCount} Required
                            </span>
                        </div>

                        <div class="space-y-3 w-full">
                            ${matrixQuestionsHTML}
                        </div>

                        <div class="flex items-center justify-end pt-2">
                            <button id="matrix-proceed-btn" disabled 
                                onclick="window.confirmMatrixSelection('${currentSectionId}')"
                                class="px-5 py-2.5 bg-slate-800 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-not-allowed opacity-50">
                                Proceed to Selected Questions
                            </button>
                        </div>

                    </div>
                </div>
            `;

            window.handleMatrixSelectionChange(currentSectionId, requiredCount);
            if (window.lucide) window.lucide.createIcons();
            contentArea.scrollTop = 0;
            return; 
        }
    }
    
    // =========================================================================
    // DYNAMIC PROGRESS CALCULATORS
    // =========================================================================
    const activeRequiredQuestionsList = session.flatQuestionsList.filter((q, idx) => {
        if (q.sectionRequiredCount < q.totalSectionQuestionsCount) {
            return session.chosenQuestionIds.has(idx); 
        }
        return true; 
    });

    const currentFilteredIndex = activeRequiredQuestionsList.indexOf(currentQuestion);
    const totalRequiredQuestionsCount = activeRequiredQuestionsList.length;
    
    const progressBarPercent = totalRequiredQuestionsCount > 0 
        ? ((Math.max(0, currentFilteredIndex) + 1) / totalRequiredQuestionsCount) * 100 
        : 0;

    let hasMoreQuestionsAhead = false;
    if (currentQuestion.type === 'scenario' && session.currentSubQuestionIndex < currentQuestion.subQuestions.length - 1) {
        hasMoreQuestionsAhead = true;
    } else {
        for (let i = currentIndex + 1; i < session.flatQuestionsList.length; i++) {
            const aheadQ = session.flatQuestionsList[i];
            const aheadIsChoice = aheadQ.sectionRequiredCount < aheadQ.totalSectionQuestionsCount;
            if (!aheadIsChoice || session.chosenQuestionIds.has(i) || !session.completedPreSelections.has(aheadQ.sectionId)) {
                hasMoreQuestionsAhead = true;
                break;
            }
        }
    }

    // =========================================================================
    // TARGET EXTRACTOR: READ SUB-QUESTION & SUB-PART LAYERS WITH CASING FALLBACKS
    // =========================================================================
    let activeRenderingTarget = currentQuestion;
    let activeSubQuestion = null;
    let currentResponseKey = String(currentIndex);

    const subIndex = session.currentSubQuestionIndex || 0;
    const partIndex = session.currentSubPartIndex || 0;

    if (currentQuestion.type === 'scenario' && currentQuestion.subQuestions && currentQuestion.subQuestions[subIndex]) {
        activeSubQuestion = currentQuestion.subQuestions[subIndex];
        const subPartsList = activeSubQuestion.subParts || activeSubQuestion.parts;

        if (subPartsList && subPartsList[partIndex]) {
            activeRenderingTarget = subPartsList[partIndex];
            currentResponseKey = `${currentIndex}_sub_${subIndex}_part_${partIndex}`;
        } else {
            activeRenderingTarget = activeSubQuestion;
            currentResponseKey = `${currentIndex}_sub_${subIndex}`;
        }
    } else {
        const subPartsList = currentQuestion.subParts || currentQuestion.parts;
        if (subPartsList && subPartsList[partIndex]) {
            activeRenderingTarget = subPartsList[partIndex];
            currentResponseKey = `${currentIndex}_part_${partIndex}`;
        }
    }

    const savedResponse = session.studentResponses[currentResponseKey];

    // Lock state evaluation
    const isLocked = savedResponse !== undefined && 
                     typeof savedResponse === 'object' && 
                     (savedResponse.chosenAnswer !== undefined || savedResponse.textSubmission !== undefined || savedResponse.answers !== undefined);

    // Conditional Section Header
    let sectionHeaderHTML = "";
    if (currentQuestion.belongsToSectionHeading || currentQuestion.belongsToSectionInstructions) {
        sectionHeaderHTML = `
            <div class="mb-6 p-4 rounded-xl border border-purple-500/10 bg-purple-950/5 animate-in fade-in duration-200">
                ${currentQuestion.belongsToSectionHeading ? `<h3 class="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">${currentQuestion.belongsToSectionHeading}</h3>` : ''}
                ${currentQuestion.belongsToSectionInstructions ? `
                    <p class="text-[10px] text-slate-300 font-sans font-semibold uppercase tracking-wider leading-relaxed border-t border-slate-900/40 pt-2 mt-2">
                        ${currentQuestion.belongsToSectionInstructions}
                    </p>
                ` : ''}
            </div>
        `;
    }

    // =========================================================================
    // CASCADE PROPERTY RESOLUTION (Sub-Part -> Sub-Question -> Parent Question)
    // =========================================================================
    const effectiveType = (
        activeRenderingTarget.type || 
        (activeSubQuestion ? activeSubQuestion.type : null) || 
        currentQuestion.type || 
        'long_answer'
    ).toString().toLowerCase().trim();

    const effectiveOptions = activeRenderingTarget.options || 
                             (activeSubQuestion ? activeSubQuestion.options : null) || 
                             [];

    const normalizedType = effectiveType.replace(/[^a-z0-9]/g, '');

    // Categorize types safely
    const isMcq = (normalizedType === 'mcq') && effectiveOptions.length > 0;
    const isTf = normalizedType === 'tf' || effectiveType === 't/f';
    const isIdentifier = normalizedType === 'identifier' || normalizedType === 'identifiermatrix';
    const isMatching = normalizedType === 'matching';

    let optionsInteractionHTML = "";

    if (isMcq) {
        optionsInteractionHTML = `<div class="flex flex-col space-y-3 w-full mt-4">`;
        
        let correctLetter = "";
        let rawCorrect = activeRenderingTarget.correctAnswer !== undefined && activeRenderingTarget.correctAnswer !== null 
                           ? String(activeRenderingTarget.correctAnswer).trim().toUpperCase() 
                           : "";
        let correctIdxValue = activeRenderingTarget.correctOptionIndex !== undefined ? Number(activeRenderingTarget.correctOptionIndex) : null;

        effectiveOptions.forEach((opt, index) => {
            const loopLetter = String.fromCharCode(65 + index);
            const cleanOptText = String(opt).trim().toUpperCase();
            if (rawCorrect === loopLetter || rawCorrect === cleanOptText || index === correctIdxValue) {
                correctLetter = loopLetter;
            }
        });

        if (rawCorrect === 'ON' && !correctLetter) correctLetter = 'A';

        effectiveOptions.forEach((option, idx) => {
            const letter = String.fromCharCode(65 + idx);
            let cardColorsClass = "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80";
            
            if (isLocked) {
                const cleanChosen = savedResponse.chosenAnswer ? String(savedResponse.chosenAnswer).trim().toUpperCase() : "";
                const cleanOptionText = String(option).trim().toUpperCase();
                const isThisChosenCard = (letter === cleanChosen || cleanOptionText === cleanChosen);
                const isThisCorrectCard = (letter === correctLetter);
                
                if (isThisCorrectCard) {
                    cardColorsClass = "bg-emerald-950/20 border-emerald-500/40 text-emerald-400 font-bold";
                } else if (isThisChosenCard && !isThisCorrectCard) {
                    cardColorsClass = "bg-red-950/20 border-red-500/40 text-red-400";
                } else {
                    cardColorsClass = "bg-slate-900/20 border-slate-900/40 opacity-40 text-slate-500";
                }
            }

            let isLetterCorrectHighlight = isLocked && (letter === correctLetter);
            const escapedOptionText = String(option).replace(/'/g, "\\'").replace(/"/g, '&quot;');

            optionsInteractionHTML += `
                <div ${!isLocked ? `onclick="window.evaluateStudentAnswerSelection('${letter}', '${escapedOptionText}', '${currentResponseKey}')"` : ''} 
                    class="flex items-center space-x-3 p-3 border rounded-xl w-full transition-all font-sans text-[11px] ${cardColorsClass} ${!isLocked ? 'cursor-pointer active:scale-[0.995]' : 'cursor-default'}">
                    <span class="font-mono font-black ${isLetterCorrectHighlight ? 'text-emerald-400' : 'text-purple-400'}">${letter}.</span>
                    <span>${option}</span>
                </div>
            `;
        });
        optionsInteractionHTML += `</div>`;
    }
    else if (isTf) {
        optionsInteractionHTML = `<div class="flex flex-col space-y-3 w-full mt-4">`;
        ['True', 'False'].forEach((val) => {
            let cardColorsClass = "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80";
            
            if (isLocked) {
                const cleanChosen = String(savedResponse.chosenAnswer).trim().toUpperCase();
                const cleanCorrect = String(activeRenderingTarget.correctAnswer).trim().toUpperCase();
                const isThisCurrentVal = (val.toUpperCase() === cleanChosen);
                const isThisCurrentCorrect = (val.toUpperCase() === cleanCorrect);
                
                if (isThisCurrentCorrect) {
                    cardColorsClass = "bg-emerald-950/20 border-emerald-500/40 text-emerald-400 font-bold";
                } else if (isThisCurrentVal && !isThisCurrentCorrect) {
                    cardColorsClass = "bg-red-950/20 border-red-500/40 text-red-400";
                } else {
                    cardColorsClass = "bg-slate-900/20 border-slate-900 opacity-40 text-slate-500";
                }
            }

            optionsInteractionHTML += `
                <div ${!isLocked ? `onclick="window.evaluateStudentAnswerSelection('${val}', '${val}', '${currentResponseKey}')"` : ''} 
                    class="flex items-center p-3 border rounded-xl w-full transition-all font-sans text-[11px] uppercase tracking-wider pl-4 ${cardColorsClass} ${!isLocked ? 'cursor-pointer active:scale-[0.9]' : 'cursor-default'}">
                    <span>${val}</span>
                </div>
            `;
        });
        optionsInteractionHTML += `</div>`;
    }
    else if (isIdentifier) {
        let structuralAnswers = activeRenderingTarget.identifierLabels;
        if (!structuralAnswers && activeRenderingTarget.correctAnswer) {
            structuralAnswers = String(activeRenderingTarget.correctAnswer).split(',').map(s => s.trim());
        }
        if (!structuralAnswers || structuralAnswers.length === 0) {
            structuralAnswers = ["", "", "", ""];
        }

        const alphabetCaps = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
        const alphabetLow  = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"];
        const configuredStyle = activeRenderingTarget.markerType || 'numbers';

        const submitBtnHTML = !isLocked 
            ? `<button onclick="window.submitStudentIdentifierGridResponses('${currentResponseKey}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer">Submit Matrix</button>`
            : ``;

        optionsInteractionHTML = `
            <div class="mt-4 space-y-3 w-full">
                <label class="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <i data-lucide="binary" class="w-3.5 h-3.5"></i>
                    <span>Anatomical Matrix Label Fill</span>
                </label>
                <div id="${currentResponseKey}-student-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#070d19]/30 p-3 border border-slate-850/60 rounded-xl">
                    ${structuralAnswers.map((expectedVal, idx) => {
                        const slotNum = idx + 1;
                        let textValue = "";
                        let borderClasses = "border-slate-800/80 focus-within:border-purple-500/40 bg-[#050b18]";
                        
                        let badgeLabel = slotNum.toString().padStart(2, '0'); 
                        if (configuredStyle === 'alphabet-caps') {
                            badgeLabel = alphabetCaps[idx] || slotNum;
                        } else if (configuredStyle === 'alphabet-low') {
                            badgeLabel = alphabetLow[idx] || slotNum;
                        }

                        if (savedResponse && savedResponse.answers) {
                            const matchingSlot = savedResponse.answers.find(a => a.slot === slotNum);
                            textValue = matchingSlot ? matchingSlot.value : "";
                        }

                        if (isLocked) {
                            const cleanStudentValue = textValue.trim().toLowerCase();
                            const acceptedSynonyms = expectedVal.split('/').map(val => val.trim().toLowerCase());
                            
                            const isCorrect = cleanStudentValue !== "" && acceptedSynonyms.includes(cleanStudentValue);
                            if (isCorrect) {
                                borderClasses = "border-emerald-500/30 bg-emerald-950/10 text-emerald-400";
                            } else {
                                borderClasses = "border-red-500/30 bg-red-950/10 text-red-400";
                            }
                        }

                        return `
                            <div class="flex items-center space-x-2.5 border rounded-xl px-3 py-2 transition-colors group ${borderClasses}">
                                <span class="font-mono text-[10px] font-black text-slate-500 group-focus-within:text-purple-400 min-w-[14px]">
                                    ${badgeLabel}
                                </span>
                                <input type="text" 
                                    id="${currentResponseKey}-slot-${slotNum}"
                                    data-slot-idx="${slotNum}"
                                    placeholder="${isLocked ? 'No entry supplied' : 'Type identification...'}" 
                                    value="${textValue}"
                                    ${isLocked ? 'disabled' : ''}
                                    class="w-full bg-transparent border-none text-xs font-semibold text-slate-200 focus:outline-none placeholder-slate-700 transition-all">
                            </div>
                        `;
                    }).join('')}
                </div>
                ${submitBtnHTML}
            </div>
        `;
    }
    else if (isMatching) {
        let structuralPairs = activeRenderingTarget.pairs;
        
        if ((!structuralPairs || structuralPairs.length === 0) && activeRenderingTarget.correctAnswer) {
            structuralPairs = String(activeRenderingTarget.correctAnswer).split('||').map((pStr, i) => {
                const splitParts = pStr.split('->');
                return {
                    index: i + 1,
                    clueText: splitParts[0] ? splitParts[0].trim() : `Term Variant ${i+1}`,
                    correctMatch: splitParts[1] ? splitParts[1].trim() : ""
                };
            });
        }
        if (!structuralPairs) structuralPairs = [];

        const strategy = activeRenderingTarget.matchingStrategy || 'table';
        const rawPoolStr = activeRenderingTarget.rawOptionPoolString || '';
        
        const allPossibleMatches = structuralPairs
            .map(p => (p.correctMatch || '').trim())
            .filter(val => val !== '');
            
        const uniqueMatchesCollection = [...new Set(allPossibleMatches)];

        for (let i = uniqueMatchesCollection.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueMatchesCollection[i], uniqueMatchesCollection[j]] = [uniqueMatchesCollection[j], uniqueMatchesCollection[i]];
        }

        let poolSectionHTML = '';
        if (strategy === 'pool' && rawPoolStr) {
            poolSectionHTML = `
                <div class="w-full bg-[#070d19]/60 border border-slate-800 p-4 rounded-xl text-xs font-semibold tracking-wide text-slate-300 leading-relaxed font-mono">
                    <span class="text-purple-400 font-black uppercase text-[10px] block mb-1.5 tracking-widest">Available Option Key Pool:</span>
                    ${rawPoolStr}
                </div>
            `;
        }

        const submitMatchesBtnHTML = !isLocked 
            ? `<button onclick="window.submitStudentMatchingResponses('${currentResponseKey}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer mt-2">Submit Matches</button>`
            : ``;

        optionsInteractionHTML = `
            <div class="mt-4 space-y-3 w-full">
                <label class="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center space-x-1.5">
                    <i data-lucide="git-commit" class="w-3.5 h-3.5"></i>
                    <span>Correlation Matching Dropdown Workspace</span>
                </label>
                
                ${poolSectionHTML}

                <div id="${currentResponseKey}-matching-stack" class="space-y-2">
                    ${structuralPairs.map((pair, idx) => {
                        const pairIndex = pair.index || (idx + 1);
                        const expectedVal = pair.correctMatch || '';
                        let selectedValue = "";
                        let borderClasses = "border-slate-800/80 focus-within:border-purple-500/40 bg-[#050b18]";

                        if (savedResponse && savedResponse.answers) {
                            const matchingSlot = savedResponse.answers.find(a => a.pairIndex === pairIndex);
                            selectedValue = matchingSlot ? matchingSlot.value : "";
                        }

                        if (isLocked) {
                            const cleanStudentValue = selectedValue.trim().toLowerCase();
                            const cleanExpectedValue = expectedVal.trim().toLowerCase();
                            
                            const isCorrect = cleanStudentValue === cleanExpectedValue && cleanStudentValue !== "";
                            if (isCorrect) {
                                borderClasses = "border-emerald-500/30 bg-emerald-950/10 text-emerald-400";
                            } else {
                                borderClasses = "border-red-500/30 bg-red-950/10 text-red-400";
                            }
                        }

                        return `
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between border rounded-xl p-3 gap-3 transition-colors group ${borderClasses}">
                                <div class="text-xs font-bold text-slate-200 flex-1 flex items-start space-x-2">
                                    <span class="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900/60 mt-0.5 group-focus-within:text-purple-400">
                                        ${pairIndex.toString().padStart(2, '0')}
                                    </span>
                                    <p class="leading-relaxed pt-0.5">${pair.clueText || 'No clue description statement provided.'}</p>
                                </div>
                                
                                <div class="w-full sm:w-auto flex items-center space-x-2 shrink-0">
                                    <select 
                                        id="${currentResponseKey}-match-pair-${pairIndex}"
                                        data-pair-idx="${pairIndex}"
                                        ${isLocked ? 'disabled' : ''}
                                        class="w-full sm:w-72 bg-[#070d19] border border-slate-800 text-xs font-semibold text-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer appearance-none">
                                        
                                        <option value="" ${selectedValue === "" ? "selected" : ""}>Select matching target...</option>
                                        
                                        ${uniqueMatchesCollection.map(optionText => {
                                            const isSelected = selectedValue.trim().toLowerCase() === optionText.trim().toLowerCase();
                                            return `<option value="${optionText}" ${isSelected ? "selected" : ""}>${optionText}</option>`;
                                        }).join('')}
                                        
                                    </select>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                ${submitMatchesBtnHTML}
            </div>
        `;
    }
    else {
        // DEFAULT FALLBACK: Open-ended written answer for long answer, short answer, or unspecified sub-parts
        let textValue = "";
        if (isLocked) {
            textValue = savedResponse.textSubmission || savedResponse.chosenAnswer || "";
        } else if (typeof savedResponse === 'string') {
            textValue = savedResponse;
        } else if (session.studentResponses && typeof session.studentResponses[currentResponseKey] === 'string') {
            textValue = session.studentResponses[currentResponseKey];
        }
        
        const existingScore = (savedResponse && typeof savedResponse.score !== 'undefined') ? savedResponse.score : null;
        const badgeText = existingScore !== null 
            ? `AI EVALUATION SCORE: ${existingScore} / 10` 
            : `AI EVALUATION SCORE: -- / 10`;

        const actionBtnHTML = !isLocked 
            ? `<button onclick="if (typeof window.submitClinicalLongAnswerSubmission === 'function') { window.submitClinicalLongAnswerSubmission('${currentResponseKey}'); } else { window.navigateQuizNextItem(); }" class="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-pointer">Submit Answer</button>`
            : `<div class="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">🔒 Answer Locked</div>`;

        const badgeHTML = !isLocked 
            ? `<div id="badge-${currentResponseKey}" class="text-[10px] font-mono font-black text-purple-400 bg-purple-950/20 border border-purple-500/20 rounded-xl px-4 py-2">${badgeText}</div>`
            : ``;

        optionsInteractionHTML = `
            <div class="mt-4 space-y-4 w-full">
                <textarea id="clinical-long-answer-field" placeholder="Type your answer analysis here..." 
                    ${isLocked ? 'disabled' : ''} 
                    oninput="window.handleQuizResponseInput ? window.handleQuizResponseInput('${currentResponseKey}', this.value) : null"
                    class="w-full min-h-[120px] bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 text-slate-200 text-[11px] font-sans focus:outline-none focus:border-purple-500/50 focus:bg-slate-900/80 transition-all placeholder:text-slate-600 resize-none">${textValue}</textarea>
                
                <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                    ${actionBtnHTML}
                    ${badgeHTML}
                </div>
            </div>
        `;
    }

  // =======================================================================
    // RATIONALE & NEURAL INSIGHT EXTRACTOR
    // =======================================================================
    window.playedNeuralInsights = window.playedNeuralInsights || new Set();
    let insightPanelHTML = "";

    if (isLocked) {
        // -------------------------------------------------------------------
        // 1. TOP CARD: AI EVALUATION FEEDBACK (For Written / Long-Answers)
        // -------------------------------------------------------------------
        let aiEvaluationCardHTML = "";

        if (!isMcq && !isTf && !isIdentifier && !isMatching) {
            const displayScore = (savedResponse && typeof savedResponse.score !== 'undefined') 
                ? savedResponse.score 
                : 0; 
            const aiReasoningText = (savedResponse && savedResponse.aiReasoning) 
                ? savedResponse.aiReasoning 
                : "No evaluation feedback recorded.";

            aiEvaluationCardHTML = `
                <div class="mt-4 p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl w-full">
                    <div id="badge-${currentResponseKey}" class="mb-2.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[9px] font-black rounded-lg inline-block uppercase tracking-wider">
                        🧠 AI Evaluation Score: ${displayScore} / 10
                    </div>
                    <h4 class="text-[10px] font-mono font-black text-purple-300 uppercase tracking-widest mb-1.5 flex items-center space-x-1.5">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-400"></i>
                        <span>AI:Neural Assessment</span>
                    </h4>
                    <p class="text-[11px] text-purple-100/90 font-sans font-medium tracking-wide leading-relaxed whitespace-pre-wrap">${aiReasoningText.trim()}</p>
                </div>
            `;
        }

        // -------------------------------------------------------------------
        // 2. BOTTOM CARD: ORIGINAL NEURAL INSIGHT (Static Blueprint Rationale)
        // -------------------------------------------------------------------
        let liveTargetRationale = "";

        if (activeRenderingTarget.rationale && activeRenderingTarget.rationale !== "No base global scenario breakdown attached.") {
            liveTargetRationale = activeRenderingTarget.rationale;
        } else if (activeRenderingTarget.explanation) {
            liveTargetRationale = activeRenderingTarget.explanation;
        } else if (currentQuestion && currentQuestion.rationale) {
            liveTargetRationale = currentQuestion.rationale;
        } else {
            liveTargetRationale = "No high-yield rationale attached to this item.";
        }
                        
        const questionTrackingKey = activeRenderingTarget.subId || activeRenderingTarget.id || `q-${currentResponseKey}`;
        let neuralInsightCardHTML = "";

        if (window.playedNeuralInsights.has(questionTrackingKey)) {
            neuralInsightCardHTML = `
                <div class="mt-4 p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl w-full">
                    <h4 class="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1.5">
                        <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-purple-400"></i>
                        <span>AI:Neural Insight</span>
                    </h4>
                    <p class="text-[11px] text-slate-200 font-sans font-medium tracking-wide leading-relaxed whitespace-pre-wrap">${liveTargetRationale.trim()}</p>
                </div>
            `;
        } else {
            neuralInsightCardHTML = `
                <div class="mt-4 p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl w-full animate-in slide-in-from-bottom-2 duration-300">
                    <h4 class="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center space-x-1.5">
                        <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-purple-400"></i>
                        <span>AI:Neural Insight</span>
                    </h4>
                    <p id="neural-insight-text-target" class="text-[11px] text-slate-200 font-sans font-medium tracking-wide leading-relaxed whitespace-pre-wrap transition-opacity duration-200">
                        <span class="neural-loading-dots font-mono text-purple-400/80 font-bold tracking-widest animate-pulse">
                            Analyzing clinical parameters<span>.</span><span>.</span><span>.</span>
                        </span>
                    </p>
                </div>
            `;

            setTimeout(() => {
                const textTargetNode = document.getElementById('neural-insight-text-target');
                if (textTargetNode) {
                    textTargetNode.classList.add('opacity-0');
                    setTimeout(() => {
                        textTargetNode.innerHTML = liveTargetRationale.trim();
                        textTargetNode.classList.remove('opacity-0');
                        window.playedNeuralInsights.add(questionTrackingKey);
                        if (window.lucide) window.lucide.createIcons();
                    }, 200); 
                }
            }, 1200);
        }

        // Combine both cards sequentially
        insightPanelHTML = aiEvaluationCardHTML + neuralInsightCardHTML;
    }

    // =========================================================================
    // PRESERVE NUMBER MATRIX & SUB-PART UI ARCHITECTURE
    // =========================================================================
    const hasImage = (currentQuestion.imageSupplement && currentQuestion.imageSupplement.trim() !== "") || (currentQuestion.imageBase64 && currentQuestion.imageBase64.trim() !== "");
const resolvedImageSource = currentQuestion.imageSupplement || currentQuestion.imageBase64 || "";

const numberMatch = currentQuestion.questionText ? currentQuestion.questionText.match(/^(\d+)/) : null;
const originalDatabaseNumber = numberMatch ? numberMatch[1] : (currentIndex + 1);

const getPartLabel = (idx) => {
    const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
    return roman[idx] || `${idx + 1}`;
};

// Strict prefix stripper: only removes leading sequence identifiers (e.g., "7.", "a)", "(i)", "7.1.")
const stripPrefix = (str) => {
    if (!str) return "";
    return str.replace(/^(\s*(?:\d+(?:\.\d+)*|\(?[a-zA-Z0-9]{1,4}\)?)\s*[\.\)]\s*)+/, '').trim();
};

const cleanParentQuestionText = stripPrefix(currentQuestion.questionText);

let activeSubParts = null;
if (currentQuestion.type === 'scenario' && currentQuestion.subQuestions) {
    if (activeSubQuestion) {
        activeSubParts = activeSubQuestion.subParts || activeSubQuestion.parts;
    }
} else {
    activeSubParts = currentQuestion.subParts || currentQuestion.parts;
}

const isSubPartActive = Array.isArray(activeSubParts) && activeSubParts.length > 0 && activeSubParts[partIndex];

let activeQuestionPrefix = `${originalDatabaseNumber}.`;
if (currentQuestion.type === 'scenario') {
    activeQuestionPrefix = `${originalDatabaseNumber}.${subIndex + 1}.`;
    if (isSubPartActive) {
        activeQuestionPrefix = `${originalDatabaseNumber}.${subIndex + 1} (${getPartLabel(partIndex)})`;
    }
} else if (isSubPartActive) {
    activeQuestionPrefix = `${originalDatabaseNumber} (${getPartLabel(partIndex)})`;
}

// Read '.stem' first (used by DB sub-parts), then fall back to '.questionText'
const rawTargetText = activeRenderingTarget ? (activeRenderingTarget.stem || activeRenderingTarget.questionText || "") : "";
const cleanTargetText = stripPrefix(rawTargetText);

let rightColumnContentHTML = "";

if (currentQuestion.type === 'scenario') {
    const cleanSubQuestionPrompt = activeSubQuestion ? stripPrefix(activeSubQuestion.questionText) : "";

    // Check if sub-part has unique prompt text separate from parent sub-question
    const hasDistinctSubPartText = isSubPartActive && cleanTargetText && cleanTargetText !== cleanSubQuestionPrompt;
    const mainDisplayText = isSubPartActive ? (cleanTargetText || cleanSubQuestionPrompt) : cleanSubQuestionPrompt;

    rightColumnContentHTML = `
        <div class="p-4 rounded-xl border border-blue-500/10 bg-blue-500/5 mb-4 text-slate-100 font-sans text-xs font-bold tracking-wide leading-relaxed whitespace-pre-wrap w-full shadow-inner">
            <span class="text-[9px] font-mono font-black text-blue-400 uppercase block tracking-widest mb-1.5 border-b border-blue-500/10 pb-1">
                📖 CASE VIGNETTE CONTEXT:
            </span>
            ${cleanParentQuestionText}
        </div>
        
        <div key="${currentResponseKey}" class="w-full flex flex-col items-start bg-slate-900/10 border border-slate-900/60 p-4 rounded-xl animate-in slide-in-from-right-3 duration-200">
            <div class="flex items-center space-x-2 mb-2">
                <span class="text-[10px] font-black text-purple-400 font-mono uppercase bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                    Sub-Question (${activeSubQuestion?.prefix ? activeSubQuestion.prefix.toUpperCase() : subIndex + 1})
                </span>
                ${isSubPartActive ? `
                    <span class="text-[10px] font-black text-emerald-400 font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Part (${getPartLabel(partIndex)})
                    </span>
                ` : ''}
            </div>

            ${hasDistinctSubPartText && cleanSubQuestionPrompt ? `
                <div class="text-slate-300 font-sans text-xs font-semibold mb-3 pb-2 border-b border-slate-800/60 w-full">
                    ${cleanSubQuestionPrompt}
                </div>
            ` : ''}

            <div class="flex flex-row items-start space-x-2 text-slate-200 font-sans text-xs font-bold tracking-wide leading-relaxed whitespace-pre-wrap w-full text-left">
                <span class="select-none text-purple-400 font-mono font-black shrink-0">${activeQuestionPrefix}</span>
                <div class="flex-1">${mainDisplayText}</div>
            </div>

            ${optionsInteractionHTML}
            ${insightPanelHTML}
        </div>
    `;
} else {
    rightColumnContentHTML = `
        <div key="${currentResponseKey}" class="w-full flex flex-col items-start animate-in slide-in-from-right-3 duration-200">
            ${isSubPartActive ? `
                <div class="p-3 rounded-xl border border-purple-500/10 bg-purple-950/10 mb-3 text-slate-300 font-sans text-xs font-semibold leading-relaxed w-full">
                    <span class="text-[9px] font-mono font-black text-purple-400 uppercase block tracking-widest mb-1">
                        MAIN QUESTION STEM (${originalDatabaseNumber}):
                    </span>
                    ${cleanParentQuestionText}
                </div>
                <div class="flex items-center space-x-1.5 mb-2">
                    <span class="text-[10px] font-black text-emerald-400 font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        Sub-Part (${getPartLabel(partIndex)})
                    </span>
                </div>
            ` : ''}

            <div class="flex flex-row items-start space-x-2 text-slate-100 font-sans text-sm font-bold tracking-wide leading-relaxed whitespace-pre-wrap w-full mb-2 text-left">
                <span class="select-none text-purple-400 font-mono font-black shrink-0">${activeQuestionPrefix}</span>
                <div class="flex-1">${isSubPartActive ? cleanTargetText : cleanParentQuestionText}</div>
            </div>

            ${optionsInteractionHTML}
            ${insightPanelHTML}
        </div>
    `;
}

let mainLayoutBodyHTML = "";
if (hasImage) {
    // Reset image zoom scale tracking when a new question loads
    window.currentDiagramScale = 1;

    mainLayoutBodyHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
            
            <!-- LEFT COLUMN: Added 'group' to enable hover detection across the image area -->
            <div class="group relative w-full lg:col-span-7 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center overflow-hidden position-sticky top-4 shadow-xl">
                
                <!-- Floating Zoom Toolbar: Appears ONLY when hovering over the container -->
                <div class="absolute top-5 right-5 z-20 flex items-center gap-1 bg-slate-900/95 border border-slate-700/80 rounded-lg p-1 shadow-2xl backdrop-blur-md select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                    <button 
                        type="button" 
                        onclick="handleAssessmentImageZoom(0.25)" 
                        title="Zoom In" 
                        class="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors text-xs font-bold flex items-center justify-center w-7 h-7">
                        ➕
                    </button>
                    <button 
                        type="button" 
                        onclick="handleAssessmentImageZoom(-0.25)" 
                        title="Zoom Out" 
                        class="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors text-xs font-bold flex items-center justify-center w-7 h-7">
                        ➖
                    </button>
                    <div class="w-px h-4 bg-slate-700 mx-0.5"></div>
                    <button 
                        type="button" 
                        onclick="handleAssessmentImageZoom('reset')" 
                        title="Reset Zoom" 
                        class="px-2 py-1 hover:bg-slate-800 text-[11px] font-mono font-bold text-slate-400 hover:text-white rounded transition-colors">
                        Reset
                    </button>
                </div>

                <!-- Zoomable Image Frame (overflow-auto enables scrolling when zoomed in) -->
                <div class="w-full bg-slate-900/80 rounded-lg p-2 flex items-center justify-center overflow-auto min-h-[380px] max-h-[580px] relative">
                    <img 
                        id="assessment-active-diagram" 
                        src="${resolvedImageSource}" 
                        class="w-full h-auto max-h-[550px] object-contain rounded-lg shadow-md filter contrast-[1.03] transition-transform duration-200 ease-out origin-center shrink-0" 
                        alt="Clinical Supplemental Telemetry"
                    >
                </div>

                <!-- Footer Hint -->
                <div class="w-full text-center mt-2 text-[10px] font-mono text-slate-400 tracking-wide">
                    🔍 Hover over image to show zoom controls
                </div>
            </div>

            <!-- RIGHT COLUMN: Vignette & Sub-Question Container -->
            <div class="w-full lg:col-span-5 flex flex-col items-start">
                ${rightColumnContentHTML}
            </div>

        </div>
    `;
} else {
    mainLayoutBodyHTML = `
        <div class="w-full max-w-3xl mx-auto flex flex-col items-start">
            ${rightColumnContentHTML}
        </div>
    `;
}
    // PACK INTERFACE VIEWPORT INNER SHELL HTML FRAMEWORK
    const totalDisplayIndex = currentQuestion.type === 'scenario' 
        ? `${originalDatabaseNumber}.${session.currentSubQuestionIndex + 1}` 
        : `${originalDatabaseNumber}`;

    const isFirstItemOverall = currentIndex === 0 && (session.currentSubQuestionIndex === undefined || session.currentSubQuestionIndex === 0);

    contentArea.innerHTML = `
        <div class="absolute inset-0 w-full h-full overflow-y-auto bg-slate-950/20 custom-scrollbar-shell" style="scroll-behavior: smooth;">
            <div class="w-full max-w-5xl mx-auto flex flex-col pt-8 px-6 min-h-full pb-16 selection:bg-transparent animate-in fade-in duration-200">
                
                <div id="quiz-engine-top-header" class="flex items-center justify-between w-full pb-4 border-b border-slate-800/40 mb-5">
                    <div>
                        <span class="text-[9px] font-mono font-black bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-800 uppercase tracking-widest">
                            Item ${totalDisplayIndex} (Block ${currentIndex + 1}/${totalQuestions})
                        </span>
                        <span class="text-[9px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded uppercase tracking-widest ml-2">
                            ${effectiveType.toUpperCase()}
                        </span>
                    </div>
                    
                    <button onclick="window.quitActiveQuizEngineSession()" 
                        class="bg-slate-900/40 hover:bg-red-950/20 hover:text-red-400 text-slate-400 border border-slate-800/80 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95">
                        <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                        <span>Quit Session</span>
                    </button>
                </div>

                <div class="w-full h-1 bg-slate-900 rounded-full mb-5 overflow-hidden">
                    <div class="h-full bg-purple-600 transition-all duration-300" style="width: ${progressBarPercent}%"></div>
                </div>

                ${sectionHeaderHTML}
                
                <div class="w-full mb-6">
                    ${mainLayoutBodyHTML}
                </div>

                <div class="flex items-center justify-between w-full border-t border-slate-900 pt-5 mt-auto">
                    <button onclick="window.navigateQuizPrevItem()" 
                        ${isFirstItemOverall ? 'disabled class="opacity-20 cursor-not-allowed bg-slate-900/40 border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider"' : 'class="cursor-pointer hover:bg-slate-800 text-slate-300 bg-slate-900/40 border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-1"'} >
                        <span>&larr; Previous</span>
                    </button>

                    ${isLocked ? `
                        <button onclick="${!hasMoreQuestionsAhead ? 'window.compileQuizFinalDiagnosticsPerformance()' : 'window.navigateQuizNextItem()'}" 
                            class="bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/20 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-950/40 transition-all flex items-center space-x-1 cursor-pointer">
                            <span>${!hasMoreQuestionsAhead ? 'Finish & Grade' : 'Next Item &rarr;'}</span>
                        </button>
                    ` : `<div class="text-[10px] font-mono italic text-slate-600 tracking-wide">Please select or submit an answer response to proceed...</div>`}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    contentArea.scrollTop = 0;
};
/**
 * Dynamic scale controller for assessment images
 * Allows zooming from 0.75x up to 3.0x scale
 */
window.handleAssessmentImageZoom = function(delta) {
    const img = document.getElementById('assessment-active-diagram');
    if (!img) return;

    if (!window.currentDiagramScale) {
        window.currentDiagramScale = 1;
    }

    if (delta === 'reset') {
        window.currentDiagramScale = 1;
    } else {
        const nextScale = window.currentDiagramScale + delta;
        if (nextScale >= 0.75 && nextScale <= 3.0) {
            window.currentDiagramScale = nextScale;
        }
    }

    img.style.transform = `scale(${window.currentDiagramScale})`;
};
/**
 * Generates the student-facing HTML interface layout for matching questions.
 * Supports both standard 1-to-1 side-by-side tables and unified key pools.
 * * @param {Object} q - The question data bundle pulled from storage
 * @returns {string} - Renderable HTML layout template
 */
function generateMatchingStudentTemplate(q) {
    const isPoolStrategy = q.matchingStrategy === 'pool';
    let optionsMarkup = '';

    // Step 1: Handle formatting the choices presentation row if using a common definition key pool
    if (isPoolStrategy && q.rawOptionPoolString) {
        optionsMarkup = `
            <div class="w-full bg-[#070d19]/60 border border-slate-800 p-4 rounded-xl mb-4 text-xs font-semibold tracking-wide text-slate-300 leading-relaxed font-mono">
                <span class="text-purple-400 font-black uppercase text-[10px] block mb-1.5 tracking-widest">Available Option Key Pool:</span>
                ${q.rawOptionPoolString}
            </div>
        `;
    }

    // Step 2: Build matching workspace entry row fields dynamically
    let itemsRowsMarkup = '';
    
    if (Array.isArray(q.pairs)) {
        q.pairs.forEach((pair) => {
            const inputId = `student-match-answer-${q.id}-${pair.index}`;
            
            itemsRowsMarkup += `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-[#040812]/40 border border-slate-900 rounded-xl p-3 gap-3 hover:border-slate-800/60 transition-colors">
                    <div class="text-xs font-bold text-slate-200 flex-1 flex items-start space-x-2">
                        <span class="text-[10px] font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900 mt-0.5">${pair.index}</span>
                        <p class="leading-relaxed">${pair.clueText || 'No description item statement provided.'}</p>
                    </div>
                    
                    <div class="w-full sm:w-auto flex items-center space-x-2 shrink-0">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono hidden sm:inline">Match Suffix:</span>
                        <input type="text" id="${inputId}" 
                            data-matching-pair-index="${pair.index}"
                            data-parent-question-id="${q.id}"
                            placeholder="${isPoolStrategy ? 'Initials (e.g., CB)' : 'Exact matching answer...'}"
                            class="student-matching-input w-full sm:w-64 bg-[#070d19] border border-slate-800 focus:border-purple-500/50 text-xs font-medium text-white px-3 py-2 rounded-lg focus:outline-none transition-all placeholder-slate-700">
                    </div>
                </div>
            `;
        });
    }

    // Step 3: Bundle template wraps matching student view frame neatly inside interactive blocks
    return `
        <div class="matching-question-wrapper space-y-4" data-question-type="matching" data-question-id="${q.id}">
            ${optionsMarkup}

            <div class="space-y-2" id="student-matching-stack-${q.id}">
                ${itemsRowsMarkup || '<div class="text-center text-xs font-semibold text-slate-600 uppercase tracking-widest py-4">No matching items initialized.</div>'}
            </div>
        </div>
    `;
}
// =========================================================================
// 🚀 IDENTIFIER MATRIX ANSWER SUBMISSION ENGINE
// =========================================================================
window.submitStudentIdentifierGridResponses = function(responseKey) {
    const gridContainer = document.getElementById(`${responseKey}-student-grid`);
    if (!gridContainer) return;

    // 1. Scrape all active text input slots out of the DOM matrix
    const inputNodes = gridContainer.querySelectorAll('input[type="text"]');
    const gatheredAnswers = [];
    let completeFillFlag = true;

    inputNodes.forEach(input => {
        const slotNum = parseInt(input.getAttribute('data-slot-idx'), 10);
        const cleanValue = input.value.trim();

        if (!cleanValue) {
            completeFillFlag = false;
        }

        gatheredAnswers.push({
            slot: slotNum,
            value: cleanValue
        });
    });

    // 2. Strict validation guard: block submission and trigger warning toast if any slot is blank
    if (!completeFillFlag) {
        if (typeof window.showToast === 'function') {
            window.showToast(
                "SUBMISSION BLOCKED",
                "Identification grid submission contains empty fields. Please fill out all required matrix identification slots.",
                "warning"
            );
        } else {
            alert("SUBMISSION BLOCKED: Identification grid submission contains empty fields. Please fill out all required matrix identification slots.");
        }
        return; // Halt submission execution
    }

    // Ensure state object definitions are resilient
    if (!window.activeQuizSession) window.activeQuizSession = {};
    if (!window.activeQuizSession.studentResponses) window.activeQuizSession.studentResponses = {};

    // 3. Bind response package to our active telemetry session register tracking
    window.activeQuizSession.studentResponses[responseKey] = {
        chosenAnswer: gatheredAnswers.map(a => `${a.slot}:${a.value}`).join(' | '), // Flat string matching query engine layout logging
        answers: gatheredAnswers, // Preserved array mapping for the index evaluation lookups
        timestamp: Date.now()
    };

    // 4. Force state engine refresh layout to uncover correct answers and play neural insight
    window.renderActiveQuizEngineViewItem();
};
/**
 * Scrapes student inputs from the matching workspace and commits them to the state heap.
 * @param {string} responseKey - Unique identifier key for the question node response
 */
window.submitStudentMatchingResponses = function(responseKey) {
    const stackContainer = document.getElementById(`${responseKey}-matching-stack`);
    if (!stackContainer) return;

    // 1. 🎛️ Scrape all active select dropdown nodes out of the DOM matching stack
    const selectNodes = stackContainer.querySelectorAll('select[data-pair-idx]');
    const gatheredAnswers = [];
    let completeFillFlag = true;

    selectNodes.forEach(select => {
        const pairIndex = parseInt(select.getAttribute('data-pair-idx'), 10);
        const cleanValue = select.value.trim();

        if (!cleanValue) {
            completeFillFlag = false;
        }

        // Track pairs by pairIndex instead of grid slot for semantic lookup clarity
        gatheredAnswers.push({
            pairIndex: pairIndex,
            value: cleanValue
        });
    });

    // 2. Validation guard: block submission and trigger warning toast if any slot is blank
    if (!completeFillFlag) {
        if (typeof window.showToast === 'function') {
            window.showToast(
                "SUBMISSION BLOCKED",
                "Matching matrix submission contains unselected slots. Please select target pair items for all correlation entries.",
                "warning"
            );
        } else {
            alert("SUBMISSION BLOCKED: Please select target pair items for all correlation entries.");
        }
        return; // Halt submission execution
    }

    // Ensure state object definitions are resilient
    if (!window.activeQuizSession) window.activeQuizSession = {};
    if (!window.activeQuizSession.studentResponses) window.activeQuizSession.studentResponses = {};

    // 3. Bind response package to your active telemetry session register tracking
    window.activeQuizSession.studentResponses[responseKey] = {
        chosenAnswer: gatheredAnswers.map(a => `${a.pairIndex}:${a.value}`).join(' | '), // Flat string matching query engine layout logging
        answers: gatheredAnswers, // Preserved array mapping for matching evaluation lookups
        timestamp: Date.now()
    };

    // 4. Force state engine refresh layout to uncover correct answers and play neural insight
    window.renderActiveQuizEngineViewItem();
};
// =========================================================================
// 🌟 STEP 3: INTERACTIVE MATRIX SELECTION & CAP FREEZING ENGINE
// =========================================================================
window.handleMatrixSelectionChange = function(sectionId, requiredCount) {
    const session = window.activeQuizSession;
    if (!session) return;

    // 1. Gather all checkbox elements currently rendered inside our matrix view
    const checkboxes = document.querySelectorAll('input[name="matrix-choice"]');
    
    // 2. Count how many are currently checked by the student
    const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
    const currentCheckedCount = checkedBoxes.length;

    // 3. Update our global state tracking memory sets
    checkboxes.forEach(cb => {
        const globalIndex = parseInt(cb.value);
        if (cb.checked) {
            session.chosenQuestionIds.add(globalIndex);
        } else {
            session.chosenQuestionIds.delete(globalIndex);
        }
    });

    // 4. STRICT CAP ENFORCEMENT: Freeze (disable) unchecked boxes if limit reached
    checkboxes.forEach(cb => {
        if (!cb.checked) {
            // Disable if we hit the max requirement cap
            cb.disabled = (currentCheckedCount >= requiredCount);
            
            // Visual opacity shift to show it is frozen/disabled
            const labelWrapper = cb.closest('label');
            if (labelWrapper) {
                if (cb.disabled) {
                    labelWrapper.classList.add('opacity-40', 'cursor-not-allowed');
                    labelWrapper.classList.remove('hover:bg-slate-900/80', 'hover:border-purple-500/30');
                } else {
                    labelWrapper.classList.remove('opacity-40', 'cursor-not-allowed');
                    labelWrapper.classList.add('hover:bg-slate-900/80', 'hover:border-purple-500/30');
                }
            }
        }
    });

    // 5. UPDATE REALTIME TEXT COUNTER BADGE
    const counterBadge = document.getElementById('matrix-counter-badge');
    if (counterBadge) {
        counterBadge.innerHTML = `Selected: ${currentCheckedCount} / ${requiredCount} Required`;
        
        // Dynamic decorative color shift when target goal is met successfully
        if (currentCheckedCount === requiredCount) {
            counterBadge.className = "px-3 py-1 bg-emerald-600/10 border border-emerald-600/20 text-emerald-400 font-mono text-[9px] font-black rounded-lg uppercase tracking-wider animate-pulse";
        } else {
            counterBadge.className = "px-3 py-1 bg-purple-600/10 border border-purple-600/20 text-purple-400 font-mono text-[9px] font-black rounded-lg uppercase tracking-wider";
        }
    }

    // 6. THE GATEKEEPER PROCEED BUTTON ACTIVATION CONTROL
    const proceedBtn = document.getElementById('matrix-proceed-btn');
    if (proceedBtn) {
        if (currentCheckedCount === requiredCount) {
            // UNLOCKED STATE Spec Changes
            proceedBtn.disabled = false;
            proceedBtn.className = "px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/20 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-purple-950/40 cursor-pointer transition-all active:scale-95 animate-in fade-in duration-200";
        } else {
            // LOCKED STATE Spec Changes
            proceedBtn.disabled = true;
            proceedBtn.className = "px-5 py-2.5 bg-slate-800 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all cursor-not-allowed opacity-50";
        }
    }
};
// =========================================================================
// 🌟 STEP 4: THE POINT OF NO RETURN - LOCKING CHOICES & AUTO-NAVIGATION
// =========================================================================
window.confirmMatrixSelection = function(sectionId) {
    const session = window.activeQuizSession;
    if (!session) return;

    // 1. Permanently lock this section's pre-selection choice gate
    session.completedPreSelections.add(sectionId);

    // 2. Find all peer questions belonging to this section block
    const peerQuestions = session.flatQuestionsList.filter(q => q.sectionId === sectionId);

    // 3. Pinpoint the absolute global index of the first question they checked
    let firstSelectedGlobalIndex = -1;
    for (let i = 0; i < peerQuestions.length; i++) {
        const globalIndex = session.flatQuestionsList.indexOf(peerQuestions[i]);
        if (session.chosenQuestionIds.has(globalIndex)) {
            firstSelectedGlobalIndex = globalIndex;
            break; // Found the first item, snap out of the loop
        }
    }

    // 4. Fallback Safety Guard: If somehow nothing matched, default to the first peer item
    if (firstSelectedGlobalIndex === -1 && peerQuestions.length > 0) {
        firstSelectedGlobalIndex = session.flatQuestionsList.indexOf(peerQuestions[0]);
    }

    // 5. Shift the master state tracker pointer directly to their first chosen item
    session.currentQuestionIndex = firstSelectedGlobalIndex;

    // 6. Force-re-trigger the main viewport rendering pipeline smoothly
    window.renderActiveQuizEngineViewItem();
};


window.evaluateStudentAnswerSelection = function(chosenLetter, chosenText, currentResponseKey) {
    const session = window.activeQuizSession;
    if (!session) return;

    // 🛡️ Ensure safe fallback: use the provided unique target key, or default back to currentQuestionIndex string
    const responseKey = currentResponseKey || String(session.currentQuestionIndex);

    // If this item slot has already been locked in with a saved response, freeze the state
    if (session.studentResponses[responseKey] !== undefined) return; 

    const currentIndex = session.currentQuestionIndex;
    const currentQuestion = session.flatQuestionsList[currentIndex];

    // 🧬 CONTEXT TARGET EXTRACTOR: Look up the active nested node if this is part of a scenario run
    let activeRenderingTarget = currentQuestion;
    if (currentQuestion.type === 'scenario' && responseKey.includes('_sub_')) {
        const parts = responseKey.split('_sub_');
        const subIndex = parseInt(parts[1], 10);
        if (currentQuestion.subQuestions && currentQuestion.subQuestions[subIndex]) {
            activeRenderingTarget = currentQuestion.subQuestions[subIndex];
        }
    }

    let cleanCorrect = activeRenderingTarget.correctAnswer !== undefined && activeRenderingTarget.correctAnswer !== null 
                       ? String(activeRenderingTarget.correctAnswer).trim().toUpperCase() 
                       : "";
    
    // 🔍 INDEX-BASED CORRECTNESS FALLBACK: 
    // If correctAnswer is a raw index value (e.g. 0, 1, 2), convert it to its letter format (A, B, C)
    if (activeRenderingTarget.correctOptionIndex !== undefined) {
        cleanCorrect = String.fromCharCode(65 + Number(activeRenderingTarget.correctOptionIndex));
    }
    
    // 🛠️ Fallback mapping patch
    if (cleanCorrect === 'ON') {
        cleanCorrect = 'B'; 
    }

    const compareLetter = String(chosenLetter).trim().toUpperCase();
    const compareText = String(chosenText).trim().toUpperCase();

    // Check if matching via the letter identifier (e.g., "A") or the full option string text match
    const isCorrectAnswer = (cleanCorrect === compareLetter || cleanCorrect === compareText);

    // 💾 SAVE MUTATED TARGET STATE DEEP INTO REGISTRY
    session.studentResponses[responseKey] = {
        chosenAnswer: chosenLetter, 
        isCorrect: isCorrectAnswer,
        score: isCorrectAnswer ? 10 : 0,
        textSubmission: ""
    };

    // Re-render UI frame with locked states and active neural explanation insights
    window.renderActiveQuizEngineViewItem();
};
// =========================================================
// CLINICAL LONG ANSWER INPUT EXTRACTION CONTROLLER (Rule 1-g)
// =========================================================
/**
 * Helper utility to resolve evaluation archetype.
 * Prioritizes explicit DB configuration before falling back to stem keyphrase matching.
 */
function resolveQuestionType(explicitType, questionStem = "") {
    if (explicitType && ["RECALL", "DIRECTIONAL", "LIST", "EXPLANATION"].includes(String(explicitType).toUpperCase().trim())) {
        return String(explicitType).toUpperCase().trim();
    }

    const stemLower = String(questionStem || "").toLowerCase().trim();

    // 1. EXPLANATION: Check first for descriptive/narrative prompts
    if (/\b(explain|describe|discuss|mechanism|why|how does|compare|contrast)\b/i.test(stemLower)) {
        return "EXPLANATION";
    }

    // 2. LIST: Explicit list verbs or specific phrase counts (e.g., "list 3 causes", "name 2 factors")
    if (
        /\b(list|enumerate|outline|mention|name|identify)\b/i.test(stemLower) ||
        /\b(state|give|provide)\s+(the\s+)?(two|three|four|five|six|\d+)\b/i.test(stemLower)
    ) {
        return "LIST";
    }

    // 3. DIRECTIONAL: Physiological state vectors & trend changes
    if (/\b(how is|what happens to|effect on|level of|increase|decreased?|increased?|decrease|impact on)\b/i.test(stemLower)) {
        return "DIRECTIONAL";
    }

    // 4. Default fallback: Single-term recall
    return "RECALL";
}

window.submitClinicalLongAnswerSubmission = async function(currentResponseKey) {
    const inputTextArea = document.getElementById('clinical-long-answer-field');
    const writtenText = String(inputTextArea?.value || "").trim();

    if (!inputTextArea || !writtenText) {
        if (typeof window.showToast === 'function') {
            window.showToast(
                "Submission Blocked", 
                "Written response submission box cannot be submitted blank. Please input your comprehensive clinical analysis.", 
                "warning"
            );
        } else {
            alert("⚠️ Written response submission box cannot be submitted blank.");
        }
        return;
    }

    const session = window.activeQuizSession;
    if (!session) return;
// Dynamic backend URL mapped to central deployment configuration
    const apiBaseUrl = API_BASE_URL;

    // Safe fallback key resolution
    const responseKey = String(currentResponseKey ?? session.currentQuestionIndex);

    // Optimized DOM Image Scraper Fallback
    const getDomImageSrc = () => {
        const imgElement = document.querySelector('.quiz-image-container img, .vignette-image img, #quiz-diagram-img, img[src*="http"], img[src*="data:image"]');
        const src = imgElement?.src || "";
        return (src && !src.includes("null") && !src.includes("undefined")) ? src : "";
    };

    // Optimized Deep DOM Vignette Text Scraper
    const getDomVignetteText = () => {
        const vignetteEl = document.querySelector('.vignette-container, .vignette-card, [class*="vignette"], [id*="vignette"], [class*="case-context"]');
        if (vignetteEl) {
            return vignetteEl.innerText.replace(/CASE VIGNETTE CONTEXT:?/gi, '').trim();
        }

        const candidateElements = document.querySelectorAll('div, p, section, article');
        for (const el of candidateElements) {
            if (el.children.length === 0 && el.textContent.toUpperCase().includes('CASE VIGNETTE CONTEXT')) {
                const parentContainer = el.closest('div, section, article') || el.parentElement;
                if (parentContainer) {
                    const extracted = parentContainer.innerText.replace(/CASE VIGNETTE CONTEXT:?/gi, '').trim();
                    if (extracted) return extracted;
                }
            }
        }
        return "";
    };

    // Visual loading state on submit button
    const submitBtn = document.querySelector(`button[onclick*="submitClinicalLongAnswerSubmission"]`) || document.activeElement;
    const isButton = submitBtn && submitBtn.tagName === "BUTTON";
    const originalBtnText = isButton ? submitBtn.innerText : "SUBMIT ANSWER";
    if (isButton) {
        submitBtn.disabled = true;
        submitBtn.innerText = "EVALUATING...";
        submitBtn.style.opacity = "0.6";
    }

    // Dynamic feedback on score badge
    const targetBadge = document.getElementById(`badge-${responseKey}`);
    if (targetBadge) {
        targetBadge.innerText = "AI EVALUATING SCORE: ... / 10";
        targetBadge.style.opacity = "0.7";
    }

    // Safely extract question context, case vignette, & image URL
    let targetQuestion = null;
    let vignetteContext = "";
    let imageUrl = "";

    if (responseKey.includes("_sub_")) {
        const [parentIdx, subIdx] = responseKey.split("_sub_").map(Number);
        const parentQ = session.flatQuestionsList?.[parentIdx];

        vignetteContext = 
            parentQ?.vignette || 
            parentQ?.caseVignette || 
            parentQ?.case_vignette || 
            parentQ?.vignette_context || 
            parentQ?.vignetteContext || 
            parentQ?.scenario || 
            parentQ?.context || 
            parentQ?.passage || 
            parentQ?.description || 
            getDomVignetteText();

        if (parentQ && Array.isArray(parentQ.subQuestions)) {
            targetQuestion = parentQ.subQuestions[subIdx];
        }

        imageUrl = 
            targetQuestion?.imageUrl || 
            targetQuestion?.image_url || 
            targetQuestion?.image || 
            targetQuestion?.diagramUrl ||
            targetQuestion?.mediaUrl ||
            parentQ?.imageUrl || 
            parentQ?.image_url || 
            parentQ?.image || 
            parentQ?.diagramUrl ||
            parentQ?.mediaUrl ||
            getDomImageSrc();

    } else {
        targetQuestion = session.flatQuestionsList?.[Number(responseKey)];
        
        vignetteContext = 
            targetQuestion?.vignette || 
            targetQuestion?.caseVignette || 
            targetQuestion?.case_vignette || 
            targetQuestion?.vignette_context || 
            targetQuestion?.vignetteContext || 
            targetQuestion?.scenario || 
            targetQuestion?.context || 
            targetQuestion?.passage || 
            targetQuestion?.description || 
            getDomVignetteText();
        
        imageUrl = 
            targetQuestion?.imageUrl || 
            targetQuestion?.image_url || 
            targetQuestion?.image || 
            targetQuestion?.diagramUrl ||
            targetQuestion?.mediaUrl ||
            getDomImageSrc();
    }

    const questionStem = String(
        targetQuestion?.question || 
        targetQuestion?.stem || 
        targetQuestion?.prompt || 
        targetQuestion?.questionText || 
        targetQuestion?.title || 
        "Evaluate the clinical scenario."
    ).trim();

    const rawAnswerKey = String(
        targetQuestion?.correctAnswer || 
        targetQuestion?.answerKey || 
        targetQuestion?.answer_key || 
        targetQuestion?.answer || 
        "No reference criteria defined."
    ).trim();

    const explicitType = 
        targetQuestion?.questionType || 
        targetQuestion?.question_type || 
        targetQuestion?.type || 
        targetQuestion?.category;

    const questionType = resolveQuestionType(explicitType, questionStem);

    let aiEvaluatedScore = 0;
    let aiReasoningText = "";
    let requestSuccessful = false;

    try {
        console.log(`📡 Sending [${responseKey}] (${questionType}) [Image Attached: ${!!imageUrl}] written analysis to FastAPI endpoint...`);
        
        const response = await fetch(`${apiBaseUrl}/assessments/evaluate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question_stem: questionStem,
                student_response: writtenText,
                ai_answer_key: rawAnswerKey,
                question_type: questionType,
                vignette_context: vignetteContext && vignetteContext.trim() ? vignetteContext.trim() : null,
                image_url: imageUrl && imageUrl.trim() && imageUrl !== "null" ? imageUrl.trim() : null
            })
        });

        if (!response.ok) {
            throw new Error(`AI Engine HTTP failure status: ${response.status}`);
        }

        const data = await response.json();
        aiEvaluatedScore = typeof data.score === 'number' ? data.score : 0;
        aiReasoningText = data.reasoning || "Evaluation completed successfully.";
        requestSuccessful = true;

        console.log(`🎯 AI grading completed: ${aiEvaluatedScore}/10 [Type: ${questionType}] returned for key [${responseKey}]`);

        if (typeof window.showToast === 'function') {
            window.showToast(
                "Clinical Insight Unlocked", 
                `AI evaluation successfully complete! Your score: ${aiEvaluatedScore}/10`, 
                "success"
            );
        }

    } catch (error) {
        console.error("Critical AI Grading Pipeline Fault:", error);
        aiReasoningText = "Failed to reach AI grading service. Please check backend connection and retry.";
        
        if (targetBadge) {
            targetBadge.innerText = "EVALUATION FAILED";
            targetBadge.style.opacity = "1";
        }

        if (typeof window.showToast === 'function') {
            window.showToast(
                "AI Grader Error", 
                "FastAPI connection failed. Submission was not recorded.", 
                "error"
            );
        }
    } finally {
        if (isButton) {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
            submitBtn.style.opacity = "1";
        }
    }

    if (requestSuccessful) {
        session.studentResponses = session.studentResponses || {};
        
        // Preserve pre-existing session attributes while appending evaluation data
        const existingRecord = session.studentResponses[responseKey] || {};
        session.studentResponses[responseKey] = {
            ...existingRecord,
            chosenAnswer: "Written Analysis Form Payload Item",
            isCorrect: aiEvaluatedScore >= 7,
            score: aiEvaluatedScore,
            textSubmission: writtenText,
            aiReasoning: aiReasoningText,
            questionType: questionType,
            evaluatedAt: new Date().toISOString()
        };

        if (typeof window.renderActiveQuizEngineViewItem === 'function') {
            window.renderActiveQuizEngineViewItem();
        }
    }
};
// =========================================================================
// NAVIGATION ENGINE: FORWARD STEPPING THROUGH PARTS, SUBS, & PARENTS
// =========================================================================
window.navigateQuizNextItem = function() {
    const session = window.activeQuizSession;
    if (!session) return;

    const currentQuestion = session.flatQuestionsList[session.currentQuestionIndex];
    const subIndex = session.currentSubQuestionIndex || 0;
    const partIndex = session.currentSubPartIndex || 0;

    let activeSubQuestion = null;
    let subPartsList = null;

    if (currentQuestion.type === 'scenario' && currentQuestion.subQuestions) {
        activeSubQuestion = currentQuestion.subQuestions[subIndex];
        if (activeSubQuestion) {
            subPartsList = activeSubQuestion.subParts || activeSubQuestion.parts;
        }
    } else {
        subPartsList = currentQuestion.subParts || currentQuestion.parts;
    }

    // 1. Advance to next sub-part if present
    if (Array.isArray(subPartsList) && partIndex + 1 < subPartsList.length) {
        session.currentSubPartIndex = partIndex + 1;
        window.renderActiveQuizEngineViewItem();
        return;
    }

    // 2. No remaining sub-parts; reset part index and check for next sub-question (scenario)
    session.currentSubPartIndex = 0;

    if (currentQuestion.type === 'scenario' && currentQuestion.subQuestions && subIndex + 1 < currentQuestion.subQuestions.length) {
        session.currentSubQuestionIndex = subIndex + 1;
        window.renderActiveQuizEngineViewItem();
        return;
    }

    // 3. No remaining sub-questions; reset sub index and advance to next main question block
    session.currentSubQuestionIndex = 0;

    if (session.currentQuestionIndex + 1 < session.flatQuestionsList.length) {
        session.currentQuestionIndex++;
        window.renderActiveQuizEngineViewItem();
    } else {
        if (typeof window.triggerQuizFinalSubmissionFlow === 'function') {
            window.triggerQuizFinalSubmissionFlow();
        }
    }
};

// =========================================================================
// NAVIGATION ENGINE: BACKWARD STEPPING THROUGH PARTS, SUBS, & PARENTS
// =========================================================================
window.navigateQuizPrevItem = function() {
    const session = window.activeQuizSession;
    if (!session) return;

    const currentQuestion = session.flatQuestionsList[session.currentQuestionIndex];
    const subIndex = session.currentSubQuestionIndex || 0;
    const partIndex = session.currentSubPartIndex || 0;

    // 1. Step backward to previous sub-part if available
    if (partIndex > 0) {
        session.currentSubPartIndex = partIndex - 1;
        window.renderActiveQuizEngineViewItem();
        return;
    }

    // 2. Step backward to previous sub-question if scenario
    if (currentQuestion.type === 'scenario' && subIndex > 0) {
        session.currentSubQuestionIndex = subIndex - 1;
        const prevSubQuestion = currentQuestion.subQuestions[session.currentSubQuestionIndex];
        const prevParts = prevSubQuestion ? (prevSubQuestion.subParts || prevSubQuestion.parts) : null;
        session.currentSubPartIndex = Array.isArray(prevParts) && prevParts.length > 0 ? prevParts.length - 1 : 0;
        window.renderActiveQuizEngineViewItem();
        return;
    }

    // 3. Step backward to previous main question block
    if (session.currentQuestionIndex > 0) {
        session.currentQuestionIndex--;
        const prevQuestion = session.flatQuestionsList[session.currentQuestionIndex];

        if (prevQuestion.type === 'scenario' && Array.isArray(prevQuestion.subQuestions) && prevQuestion.subQuestions.length > 0) {
            session.currentSubQuestionIndex = prevQuestion.subQuestions.length - 1;
            const prevSubQuestion = prevQuestion.subQuestions[session.currentSubQuestionIndex];
            const prevParts = prevSubQuestion ? (prevSubQuestion.subParts || prevSubQuestion.parts) : null;
            session.currentSubPartIndex = Array.isArray(prevParts) && prevParts.length > 0 ? prevParts.length - 1 : 0;
        } else {
            session.currentSubQuestionIndex = 0;
            const prevParts = prevQuestion.subParts || prevQuestion.parts;
            session.currentSubPartIndex = Array.isArray(prevParts) && prevParts.length > 0 ? prevParts.length - 1 : 0;
        }

        window.renderActiveQuizEngineViewItem();
    }
};

// =========================================================
// SESSION TERMINATOR: EXIT WORKSPACE LOOK RESTORATION FRAME
// =========================================================
window.quitActiveQuizEngineSession = function() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = "custom-quiz-quit-modal";
    modalOverlay.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200";

    modalOverlay.innerHTML = `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-purple-950/20 transform animate-in zoom-in-95 duration-200">
            <div class="flex items-center space-x-3 mb-4">
                <div class="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
                <h3 class="text-slate-200 text-sm font-black uppercase tracking-wider">Terminate Session?</h3>
            </div>

            <p class="text-slate-400 text-[11px] font-sans leading-relaxed mb-6">
                Are you sure you want to terminate this assessment track session? All active <span class="text-purple-400 font-semibold">runtime progress</span> will be permanently discarded.
            </p>

            <div class="flex items-center justify-end space-x-3">
                <button id="modal-cancel-quit" 
                    class="px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-slate-300 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95">
                    Cancel
                </button>
                
                <button id="modal-confirm-quit" 
                    class="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-950/50 transition-all cursor-pointer active:scale-95">
                    Terminate
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    document.getElementById('modal-cancel-quit').onclick = function() {
        modalOverlay.remove();
    };

    document.getElementById('modal-confirm-quit').onclick = function() {
        modalOverlay.remove();
        
        if (window.playedNeuralInsights) {
            window.playedNeuralInsights.clear();
        }
        
        const contentArea = document.getElementById('dashboard-content');
        if (contentArea) {
            contentArea.classList.remove('items-start', 'justify-start');
            contentArea.classList.add('items-center', 'justify-center');
            contentArea.style.width = '';
            contentArea.style.maxWidth = '';
        }

        const mainPlatformHeader = document.querySelector('header') || document.getElementById('main-header') || document.querySelector('nav');
        if (mainPlatformHeader) {
            mainPlatformHeader.classList.remove('hidden');
        }

        // 🎯 RESTORE SIDEBAR & GRID TEMPLATE LAYOUT
        const academicSidebar = document.getElementById('sidebar-container') || document.querySelector('aside, .academic-navigation-sidebar, [class*="sidebar"]');
        if (academicSidebar) {
            academicSidebar.style.removeProperty('display');
            academicSidebar.classList.remove('hidden');
            academicSidebar.style.display = 'flex';
            academicSidebar.style.flexDirection = 'column';
            academicSidebar.style.justifyContent = 'space-between';
        }

        const mainLayoutGrid = contentArea?.parentElement || document.querySelector('main')?.parentElement;
        if (mainLayoutGrid) {
            mainLayoutGrid.style.gridTemplateColumns = ''; // Resets inline styles back to CSS grid rules
            mainLayoutGrid.style.display = ''; // Restores default CSS grid layout
        }

        window.activeQuizSession = null;

        // ⚡ EXECUTE THE MATRIX CONTROL:
        if (typeof window.forceExitQuizViewUIMatrixShell === 'function') {
            window.forceExitQuizViewUIMatrixShell();
        }
    };
};
window.forceExitQuizViewUIMatrixShell = function() {
    // 🔓 HEADER RECOVERY GATE: Bring back the main platform header and logout layouts instantly
    const mainPlatformHeader = document.querySelector('header') || document.getElementById('main-header') || document.querySelector('nav');
    if (mainPlatformHeader) {
        mainPlatformHeader.classList.remove('hidden');
    }

    // 1. Restore sidebar layout configuration rules instantly
    const academicSidebar = document.getElementById('sidebar-container') || document.querySelector('aside, .academic-navigation-sidebar, [class*="sidebar"]');
    if (academicSidebar) {
        academicSidebar.style.removeProperty('display');
        academicSidebar.classList.remove('hidden');
        academicSidebar.style.display = 'flex';
        academicSidebar.style.flexDirection = 'column';
        academicSidebar.style.justifyContent = 'space-between';
    }

    const contentArea = document.getElementById('dashboard-content');
    if (contentArea) {
        contentArea.style.width = '';
        contentArea.style.maxWidth = '';
    }

    const mainLayoutGrid = contentArea?.parentElement || document.querySelector('main')?.parentElement;
    if (mainLayoutGrid) {
        mainLayoutGrid.style.gridTemplateColumns = '';
        mainLayoutGrid.style.display = '';
    }

    // 2. Align high-level navigation view modes
    if (typeof window.selectViewMode === 'function') {
        window.selectViewMode('assessments');
    } else if (typeof selectViewMode === 'function') {
        selectViewMode('assessments');
    }

    // 🚀 3. THE EXPLICIT CALL: Run your papers card generator deck!
    if (typeof window.renderAvailableLibraryPapers === "function") {
        console.log("🔄 Matrix Shell: Running global renderAvailableLibraryPapers engine...");
        window.renderAvailableLibraryPapers();
    } else {
        console.error("❌ Critical Error: window.renderAvailableLibraryPapers is NOT found on the global window scope. Check script loading order!");
    }
};
// =========================================================================
// 🌟 STEP 6: CLEANING UP THE GRADEPASS OMITTED ITEM ARTIFACTS
// =========================================================================
window.sanitizeSkippedQuestionsBeforeGrading = function() {
    const session = window.activeQuizSession;
    if (!session) return;

    session.flatQuestionsList.forEach((q, idx) => {
        const isChoiceSection = q.sectionRequiredCount < q.totalSectionQuestionsCount;
        
        // If it's a choice question and the student DID NOT select it in the matrix:
        if (isChoiceSection && !session.chosenQuestionIds.has(idx)) {
            
            // Inject a structured placeholder response so your analytics won't crash
            session.studentResponses[idx] = {
                chosenAnswer: "OMITTED",
                textSubmission: "This question option was discarded by choice in the selection matrix.",
                score: 0,
                isDiscardedOption: true // High-yield metadata flag for reporting templates
            };
        }
    });
};

// =======================================================================
// 🧠 CLINICAL NEURAL LINK: LIVE AI EVALUATION & STATE BINDER
// =======================================================================

/**
 * Resolves evaluation archetype.
 * Safely strips question numbers (e.g. "1. List...") and handles explicit DB types.
 */
function resolveQuestionType(explicitType, questionStem = "") {
    if (explicitType && ["RECALL", "DIRECTIONAL", "LIST", "EXPLANATION"].includes(String(explicitType).toUpperCase().trim())) {
        return String(explicitType).toUpperCase().trim();
    }

    const stemLower = String(questionStem).toLowerCase().trim();

    // 1. EXPLANATION: Check first to capture narrative/descriptive prompts
    if (/\b(explain|describe|discuss|mechanism|why|how does|compare|contrast)\b/i.test(stemLower)) {
        return "EXPLANATION";
    }

    // 2. LIST: Matches explicit list action verbs or structured phrase counts (prevents "1.2" or "5th" from triggering LIST)
    if (
        /\b(list|mention|outline|enumerate|name|identify)\b/i.test(stemLower) ||
        /\b(state|give|provide)\s+(the\s+)?(two|three|four|five|six|\d+)\b/i.test(stemLower)
    ) {
        return "LIST";
    }

    // 3. DIRECTIONAL: Vector change, physiological state impact
    if (/\b(how is|what happens to|effect on|level of|increase|decrease|impact on)\b/i.test(stemLower)) {
        return "DIRECTIONAL";
    }

    // 4. Default fallback: Single-term recall
    return "RECALL";
}

/**
 * Dispatches a student's long answer to your FastAPI backend, saves the resulting
 * score to the active quiz session memory, and dynamically updates the UI.
 * 
 * @param {string|number} responseKey - The key in session.studentResponses (e.g., "1" or "2_sub_0")
 * @param {string} questionStem - The question text / sub-question prompt
 * @param {string} studentResponse - The student's typed text
 * @param {string} aiAnswerKey - Evaluation criteria defined in the Admin Hub
 * @param {HTMLElement} scoreBadgeElement - The badge element to show the score
 * @param {HTMLElement} neuralInsightElement - The card containing the Neural Insight
 * @param {string} [questionType=null] - Optional explicit type ("RECALL" | "DIRECTIONAL" | "LIST" | "EXPLANATION")
 * @param {HTMLElement} [reasoningTextElement=null] - Optional UI element to display AI feedback reasoning
 * @param {string} [vignetteContext=null] - Optional case vignette / scenario context for DeepSeek routing
 * @param {string} [imageUrl=null] - Optional diagram / visual image URL for Multimodal AI Vision
 */
window.evaluateLongAnswerWithAI = async function(
    responseKey, 
    questionStem, 
    studentResponse, 
    aiAnswerKey, 
    scoreBadgeElement, 
    neuralInsightElement,
    questionType = null,
    reasoningTextElement = null,
    vignetteContext = null,
    imageUrl = null
) {
    if (!studentResponse || studentResponse.trim() === "") {
        alert("Please type a response before evaluating.");
        return;
    }

    // Determine target prompt strategy for the AI evaluator
    const resolvedType = resolveQuestionType(questionType, questionStem);

   // Dynamic API host resolution mapped to central deployment configuration
    const apiBaseUrl = API_BASE_URL;
    // Visual feedback: Transition badge to loading state
    if (scoreBadgeElement) {
        scoreBadgeElement.innerText = `AI EVALUATING (${resolvedType})...`;
        scoreBadgeElement.style.opacity = "0.7";
    }

    try {
        console.log(`📡 Sending [${responseKey}] | Type: ${resolvedType} | Scenario: ${!!vignetteContext} | Image Attached: ${!!imageUrl} to AI Evaluator...`);

        const response = await fetch(`${apiBaseUrl}/assessments/evaluate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question_stem: questionStem,
                student_response: studentResponse,
                ai_answer_key: aiAnswerKey,
                question_type: resolvedType,
                vignette_context: vignetteContext && vignetteContext.trim() ? vignetteContext.trim() : null,
                image_url: imageUrl && imageUrl.trim() ? imageUrl.trim() : null
            })
        });

        if (!response.ok) {
            throw new Error(`AI Engine rejected grading query. Status: ${response.status}`);
        }

        const data = await response.json();
        const aiScore = data.score;         // Integer 0–10
        const aiReasoning = data.reasoning; // Direct clinical feedback

        // Lock score and feedback safely into active quiz session memory
        if (window.activeQuizSession) {
            window.activeQuizSession.studentResponses = window.activeQuizSession.studentResponses || {};
            if (!window.activeQuizSession.studentResponses[responseKey]) {
                window.activeQuizSession.studentResponses[responseKey] = {};
            }
            window.activeQuizSession.studentResponses[responseKey].score = aiScore;
            window.activeQuizSession.studentResponses[responseKey].reasoning = aiReasoning;
            window.activeQuizSession.studentResponses[responseKey].type = resolvedType;
        }

        console.log(`🎯 AI Evaluation Locked: ${aiScore}/10 (${resolvedType}) for key [${responseKey}]`);

        // Dynamically update UI score badge
        if (scoreBadgeElement) {
            scoreBadgeElement.innerText = `AI EVALUATION SCORE: ${aiScore} / 10`;
            scoreBadgeElement.style.opacity = "1";
        }

        // Display clinical feedback text in the DOM if element exists
        if (reasoningTextElement) {
            reasoningTextElement.innerText = aiReasoning;
        }

        // Reveal Neural Insight container
        if (neuralInsightElement) {
            neuralInsightElement.style.display = "block";
            neuralInsightElement.classList.add("animate-in", "fade-in", "duration-300");
        }

    } catch (error) {
        console.error("Critical AI grading pipeline failure:", error);
        if (scoreBadgeElement) {
            scoreBadgeElement.innerText = "ERROR - TRY AGAIN";
            scoreBadgeElement.style.opacity = "1";
        }
    }
};
// =========================================================================
// GRADINGS & DIAGNOSTICS PIPELINE: SUB-PART & NESTED EVALUATION ENGINE
// =========================================================================
window.compileQuizFinalDiagnosticsPerformance = function() {
    // 🧽 STEP 6 SANITIZER RUNTIME INITIALIZED
    if (typeof window.sanitizeSkippedQuestionsBeforeGrading === 'function') {
        window.sanitizeSkippedQuestionsBeforeGrading();
    }

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    const session = window.activeQuizSession;
    if (!session || !session.flatQuestionsList) return;
    
    // 📊 DYNAMIC MATHEMATICS MATRIX RE-BALANCED
    let totalPossibleScoreMax = 0;
    let combinedScoreSum = 0;

    // Helper utility to safely match answers that might contain multiple slash-separated alternatives
    const checkStringMatchWithAlternatives = (studentVal, referenceVal) => {
        if (!studentVal || !referenceVal) return false;
        const cleanStudent = studentVal.trim().toLowerCase();
        // Split by '/' to accommodate items like "neck of the rib/neck/collum costae"
        const allowedOptions = referenceVal.split('/').map(opt => opt.trim().toLowerCase());
        return allowedOptions.includes(cleanStudent);
    };

    // Helper utility to evaluate any node (question, sub-question, or sub-part)
    const evaluateItemNode = (itemNode, responseKey, inheritedType) => {
        const resp = session.studentResponses[responseKey];
        const normalizedType = (itemNode.type ? itemNode.type : inheritedType || '').toLowerCase();
        
        // Increment max points per evaluated node
        totalPossibleScoreMax += 10;

        if (resp) {
            if (normalizedType === 'longanswer' || normalizedType === 'long_answer') {
                combinedScoreSum += resp.score || 0;
            } 
            else if (normalizedType === 'identifier') {
                const expectedLabels = itemNode.identifierLabels || [];
                if (expectedLabels.length > 0 && resp.answers) {
                    let matches = 0;
                    expectedLabels.forEach((expected, labelIdx) => {
                        const studentSlot = resp.answers.find(a => a.slot === (labelIdx + 1));
                        if (studentSlot && checkStringMatchWithAlternatives(studentSlot.value, expected)) {
                            matches++;
                        }
                    });
                    const itemScoreAllocation = (matches / expectedLabels.length) * 10;
                    resp.score = itemScoreAllocation; // Save back to object for UI consistency
                    combinedScoreSum += itemScoreAllocation;
                }
            }
            else if (normalizedType === 'matching') {
                const expectedPairs = itemNode.pairs || [];
                if (expectedPairs.length > 0 && resp.answers) {
                    let matches = 0;
                    expectedPairs.forEach((pair) => {
                        const pairIdx = pair.index;
                        const expectedVal = pair.correctMatch || '';
                        const studentSlot = resp.answers.find(a => a.pairIndex === pairIdx);
                        if (studentSlot && checkStringMatchWithAlternatives(studentSlot.value, expectedVal)) {
                            matches++;
                        }
                    });
                    const itemScoreAllocation = (matches / expectedPairs.length) * 10;
                    resp.score = itemScoreAllocation; // Save back to object
                    combinedScoreSum += itemScoreAllocation;
                }
            }
            else {
                // Catch-all for standard objective types (MCQ, True/False)
                if (resp.score !== undefined) {
                    combinedScoreSum += resp.score;
                } else if (resp.isCorrect && !resp.isDiscardedOption) {
                    combinedScoreSum += 10;
                }
            }
        }
    };

    // 🧠 ITERATE DIRECTLY BY ACTIVE MACRO BLOCKS 
    session.flatQuestionsList.forEach((q, idx) => {
        const isChoiceSection = q.sectionRequiredCount < q.totalSectionQuestionsCount;
        
        if (isChoiceSection && !(session.chosenQuestionIds && session.chosenQuestionIds.has(idx))) {
            return;
        }

        const normalizedParentType = q.type ? q.type.toLowerCase() : '';

        if (normalizedParentType === 'scenario' && q.subQuestions && q.subQuestions.length > 0) {
            // 🧬 CASE SCENARIO LINEAR GRADER
            q.subQuestions.forEach((subQ, subIdx) => {
                const subParts = subQ.subParts || subQ.parts;
                
                // 1. Check if the sub-question has deeper parts (e.g., 7.2 i b)
                if (Array.isArray(subParts) && subParts.length > 0) {
                    subParts.forEach((part, partIdx) => {
                        const responseKey = `${idx}_sub_${subIdx}_part_${partIdx}`;
                        evaluateItemNode(part, responseKey, subQ.type || q.type);
                    });
                } 
                // 2. Otherwise grade the sub-question directly
                else {
                    const responseKey = `${idx}_sub_${subIdx}`;
                    evaluateItemNode(subQ, responseKey, q.type);
                }
            });

        } else {
            // 🚂 STANDARD SINGLE BLOCK GRADER
            const subParts = q.subParts || q.parts;
            
            // 1. Check if the standard block has nested parts
            if (Array.isArray(subParts) && subParts.length > 0) {
                subParts.forEach((part, partIdx) => {
                    const responseKey = `${idx}_part_${partIdx}`;
                    evaluateItemNode(part, responseKey, q.type);
                });
            } 
            // 2. Otherwise grade the standard block directly
            else {
                const responseKey = String(idx);
                evaluateItemNode(q, responseKey, q.type);
            }
        }
    });

    const finalPercentageRate = totalPossibleScoreMax > 0 
        ? Math.round((combinedScoreSum / totalPossibleScoreMax) * 100) 
        : 0;

    let diagnosticTitle = "CRITICAL METRIC REVIEW REQUIRED";
    let diagnosticAdviceText = "Critical baseline accuracy gaps identified. We highly recommend re-reading primary lecture materials and checking detailed item breakdowns to clear foundational clinical errors before attempting another block checklist.";
    let metricAccentColorClass = "text-red-400 border-red-500/20 bg-red-950/10";

    if (finalPercentageRate >= 80) {
        diagnosticTitle = "EXCELLENT CLINICAL ACUMEN LOCKED";
        diagnosticAdviceText = "Exceptional structural knowledge base profile verified. You demonstrate accurate differential deduction paths and complete clarity on the diagnostic criteria under review. Maintain this standard.";
        metricAccentColorClass = "text-emerald-400 border-emerald-500/20 bg-emerald-950/10";
    } else if (finalPercentageRate >= 50) {
        diagnosticTitle = "STABLE COMPETENCY BENCHMARK VERIFIED";
        diagnosticAdviceText = "Solid structural concept capture profile verified. Good baseline metrics, though a few blindspots remain. Go back and check individual item insights to patch secondary processing gaps before progressing.";
        metricAccentColorClass = "text-amber-400 border-amber-500/20 bg-amber-950/10";
    }

    contentArea.innerHTML = `
        <div class="w-full max-w-2xl mx-auto text-center pt-10 pb-16 px-4 animate-in zoom-in-95 duration-300 selection:bg-transparent">
            
            <div class="w-20 h-20 mx-auto rounded-2xl border flex items-center justify-center mb-6 ${metricAccentColorClass}">
                <i data-lucide="activity" class="w-10 h-10"></i>
            </div>

            <h2 class="text-xl font-black text-white uppercase tracking-wider mb-1">Assessment Session Compiled</h2>
            <p class="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-6">Unified Metrics & Performance Analysis Framework</p>

            <div class="bg-[#050b18]/40 border border-slate-800/80 rounded-2xl p-8 max-w-md mx-auto mb-6">
                <div class="text-5xl font-mono font-black text-white tracking-tighter mb-2">
                    ${finalPercentageRate}<span class="text-purple-500 text-2xl">%</span>
                </div>
                <div class="text-[9px] font-mono font-black uppercase tracking-widest text-slate-400 mb-6">Overall Competency Score</div>
                
                <div class="border-t border-slate-900/60 pt-4 text-left p-3 border rounded-xl ${metricAccentColorClass}">
                    <h4 class="text-[10px] font-black uppercase tracking-wider mb-1">${diagnosticTitle}</h4>
                    <p class="text-[11px] font-sans font-medium leading-relaxed opacity-90">${diagnosticAdviceText}</p>
                </div>
            </div>

            <button onclick="window.forceExitQuizViewUIMatrixShell()" 
                class="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-xl border border-purple-400/20 transition-all transform active:scale-98 shadow-md cursor-pointer inline-block mx-auto">
                Return to Workspace
            </button>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
};