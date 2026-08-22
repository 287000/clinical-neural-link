
// 1. When the page first loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("System Initialized...");
    initApp();
    
    // 🎯 STEP 2.2 WIRE UP: Instantly map milestones when an admin selects a course module
    document.getElementById('quiz-course')?.addEventListener('change', synchronizeQuizLibrarySlotsDropdown);
});
// GLOBAL SYSTEM STATE: Must sit at the very top of js/app.js
let currentSelection = {
    program: null,
    year: null,
    course: null,
    viewMode: null, // NEW: Tracks if looking at 'notes' or 'assessments'
    term: null      // NEW: Tracks if looking at term 1, 2, or 3
};
// Master Dynamic Memory Heap for Quiz Compilation
let currentQuizQuestionsHeap = [];

// Change your current initApp function to this:
async function initApp() {
    console.log("🚀 Initializing Neural Link System Engine via Supabase...");
    
    // Pull active node session configuration directly out of sessionStorage
    const savedSession = sessionStorage.getItem('neural_link_active_session');

    if (savedSession) {
        try {
            window.currentUserSession = JSON.parse(savedSession);
            const targetStudentNumber = window.currentUserSession.student_number || window.currentUserSession.studentNumber;

            if (targetStudentNumber && window.supabase) {
                try {
                    // 🔒 STEP 1: Fetch live student profile data directly from Supabase matrix
                    const { data: studentProfile, error } = await window.supabase
                        .from('authorized_students_registry') 
                        .select('*')
                        .eq('student_number', targetStudentNumber)
                        .maybeSingle(); // Safely fetches zero or one matching student profile

                    if (error) throw error;

                    if (studentProfile) {
                        // Merge fresh backend data (containing updated payment_status / expiry traits)
                        window.currentUserSession = {
                            ...window.currentUserSession,
                            ...studentProfile,
                            student_number: targetStudentNumber
                        };
                        
                        // Sync fresh verification array back into sessionStorage
                        sessionStorage.setItem('neural_link_active_session', JSON.stringify(window.currentUserSession));
                    } else {
                        // 🚨 CACHE INVALIDATION: Profile record no longer exists in database matrix
                        console.warn("🔒 Session invalidated by backend Supabase matrix. Directing to interface fallback.");
                        sessionStorage.removeItem('neural_link_active_session');
                        window.currentUserSession = null;
                        
                        if (typeof window.renderLogin === 'function') {
                            window.renderLogin();
                        }
                        return; // Halt logic tree execution completely
                    }
                } catch (e) {
                    console.warn("⚠️ Database cloud ledger sync unreachable. Proceeding with cache safely.", e);
                }
            }

            // =========================================================================
            // 📡 SUPABASE REAL-TIME DATABASE SYNC ENGINE INITIALIZATION
            // =========================================================================
            if (targetStudentNumber && typeof window.initializeHeartbeatMonitor === 'function') {
                // 🚀 Dynamic pipeline connector handles stale channel cleaning automatically on reload
                window.initializeHeartbeatMonitor(targetStudentNumber);
            } 
            else if (targetStudentNumber && window.supabase && !window.currentPusherInstance) {
                console.log(`📡 Linking real-time notification node for student: ${targetStudentNumber}`);
                
                // Fallback baseline update channel listener matching this user row
                const channel = window.supabase
                    .channel(`public:authorized_students_registry:init_student_number=eq.${targetStudentNumber}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'authorized_students_registry',
                            filter: `student_number=eq.${targetStudentNumber}`
                        },
                        (payload) => {
                            const freshData = payload.new;
                            console.log("⚡ [Supabase Real-time Event Received]: Status shifted to:", freshData.payment_status);
                            
                            window.currentUserSession.payment_status = freshData.payment_status;
                            window.currentUserSession.payment_expiry = freshData.payment_expiry;
                            sessionStorage.setItem('neural_link_active_session', JSON.stringify(window.currentUserSession));
                            
                            if (typeof window.applyPaymentStatusUI === 'function') {
                                window.applyPaymentStatusUI(freshData.payment_status);
                            } else {
                                console.log("🔄 Triggering view refresh to reconcile state parameters...");
                                if (typeof showDashboard === 'function') showDashboard();
                            }
                        }
                    )
                    .subscribe();
                
                window.currentPusherInstance = channel;
            }
            // =========================================================================

            // 🟢 Authorized entry directly to the main workspace.
            if (typeof showDashboard === 'function') {
                await showDashboard();

                // 🎯 FIX: Manually reveal the dashboard viewport elements and mask the login container
                const appViewport = document.getElementById('app-viewport');
                const loginContainer = document.getElementById('login-container') || document.querySelector('.login-phase-wrapper');
                
                if (appViewport) {
                    appViewport.classList.remove('hidden');
                    appViewport.style.opacity = "1";
                    appViewport.style.filter = "none";
                }
                if (loginContainer) {
                    loginContainer.classList.add('hidden');
                    loginContainer.style.display = 'none';
                }
                return; 
            }
        } catch (error) {
            console.error("💥 Session parse error. Clearing corrupted session token:", error);
            sessionStorage.removeItem('neural_link_active_session');
            window.currentUserSession = null;
        }
    }

    // Fallback if no session exists at all
    if (typeof window.renderLogin === 'function') {
        window.renderLogin();
    }
}
// Global memory state for the active quiz session
window.activeQuizSession = {
    questions: [],       // Holds the array of questions pulled from localStorage
    storageKey: "",      // Saves the active slot key (e.g., 'quiz_mbchb_2_slot1')
    currentIndex: 0,     // Tracks the active question number (starts at 0)
    userAnswers: {},     // Stores student selections -> MCQ indices or Long Answer strings
    aiEvaluations: {}    // Stores the dynamic AI grading feedback responses for Long Answers
};

// 4. Temporary placeholder for the Dashboard

async function selectProgram(programKey) {
    console.log("Program chosen:", programKey);

    // ==========================================
    // 🛡️ PROGRAM ACADEMIC BOUNDARY GUARD RAIL
    // ==========================================
    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        const userProgram = window.currentUserSession ? window.currentUserSession.program : '';
        
        // Match incoming profile strings cleanly (e.g., 'biomedical' === 'biomedical')
        if (userProgram.toLowerCase().trim() !== programKey.toLowerCase().trim()) {
            if (typeof window.showToast === 'function') {
                window.showToast(
                    "Access Denied", 
                    `Your academic profile is locked to the ${programKey.toUpperCase()} registry portal.`, 
                    "error"
                );
            } else {
                alert("Security Error: You are not authorized to view this academic program track.");
            }
            return; // Hard stop
        }

        // ==========================================
        // 💳 PAYMENT GATEWAY SECURITY SHIELD (PART 1)
        // ==========================================
        const paymentStatus = window.currentUserSession ? window.currentUserSession.payment_status : 'UNPAID';

        if (paymentStatus !== 'PAID') {
            // 🌟 DYNAMICALLY RESOLVE MAINTENANCE FEE FROM SYSTEM SETTINGS
            let maintenanceFee = "65.00"; // Fallback default matching system_settings table

            try {
                // Read from memory cache if available, otherwise query system_settings engine
                if (window.systemSettings && window.systemSettings.registry_maintenance_fee) {
                    maintenanceFee = window.systemSettings.registry_maintenance_fee;
                } else if (window.supabase) {
                    const { data: settingRow } = await window.supabase
                        .from('system_settings')
                        .select('value')
                        .eq('key', 'registry_maintenance_fee')
                        .maybeSingle();

                    if (settingRow && settingRow.value) {
                        maintenanceFee = settingRow.value;
                    }
                }
            } catch (err) {
                console.warn("⚠️ Could not fetch dynamic maintenance fee setting, using default:", err);
            }

            // Format clean output display (e.g., 65.00 -> K65.00, 30 -> K30)
            const formattedFee = `K${parseFloat(maintenanceFee) || maintenanceFee}`;

            if (typeof window.showToast === 'function') {
                window.showToast(
                    "Access Locked", 
                    `Subscription Pending: ${formattedFee} registry maintenance fee required.`, 
                    "warning"
                );
            }
            
            // 🚀 Trigger the simulated checkout flow/modal
            if (typeof window.openPaymentModal === 'function') {
                window.openPaymentModal();
            } else {
                alert(`Access Restricted: Please complete your ${formattedFee} program maintenance fee configuration.`);
            }
            return; // Hard stop! Prevents the layout grid from injecting below.
        }
    }

    currentSelection.program = programKey;
    currentSelection.year = null;    // Reset children states on parent shift
    currentSelection.course = null;  // Reset children states on parent shift

    // 🎯 THE TRACE CLEANER: Instantly delete the stale course from browser storage!
    localStorage.removeItem('active_course');

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;
    
    // 2. Unlocked Program Name Mappings for Display Titles (Synchronized Keys)
    const programNames = {
        'mbchb': 'MBCHB, BDS and CM',
        'biomedical': 'Biomedical Science',
        'public_health': 'Public Health',
        'environmental': 'Environmental Health'
    };

    // 3. Unlocked Academic Year Mappings (Synchronized Keys)
    const programYears = {
        'mbchb': [ 2, 3 ], 
        'biomedical': [ 2, 3, 4, 5 ],   
        'public_health': [ 2, 3, 4, 5 ], 
        'environmental': [ 2, 3, 4, 5 ]  
    };

    const years = programYears[programKey] || [];
    const displayName = programNames[programKey] || programKey;

    // 4. Inject the premium dynamic grid layout into the right panel canvas
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4">
                <h2 class="text-xl font-black text-white uppercase tracking-wider">${displayName}</h2>
                <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Select Academic Year Portfolio</p>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                ${years.map(year => `
                    <button onclick="selectYear(${year})" 
                        class="bg-slate-900/30 hover:bg-blue-600/10 border border-slate-800/80 hover:border-blue-500/30 rounded-2xl p-8 text-center transition-all duration-300 group flex flex-col items-center justify-center space-y-4 shadow-lg">
                        
                        <div class="w-12 h-12 bg-slate-800/80 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-400 border border-slate-700/30 group-hover:border-blue-500/20 transition-all duration-300">
                            <i data-lucide="layers" class="w-5 h-5"></i>
                        </div>
                        
                        <div class="flex flex-col space-y-1">
                            <span class="text-sm font-black text-white tracking-wide uppercase">Year 0${year}</span>
                            <span class="text-[9px] text-slate-500 font-black uppercase tracking-wider">Academic Level</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    // 5. Instantly compile Lucide icons for the newly injected cards
    if (window.lucide) lucide.createIcons();
}
function selectYear(yearNumber) {
    console.log("Year Selected:", yearNumber);

    // ==========================================
    // 🛡️ YEAR TERMINAL LEVEL GUARD RAIL
    // ==========================================
    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        const userYear = window.currentUserSession ? String(window.currentUserSession.year).replace(/\D/g, '') : '';
        const incomingYearClean = String(yearNumber).replace(/\D/g, '');

        if (userYear !== incomingYearClean) {
            if (typeof window.showToast === 'function') {
                window.showToast(
                    "Clearance Restriction", 
                    `Your identity signature is assigned exclusively to Year 0${userYear} access points.`, 
                    "error"
                );
            } else {
                alert(`Security Error: Restricted access. You are only cleared for Year 0${userYear}.`);
            }
            return; // Hard stop
        }
    }

    currentSelection.year = yearNumber;
    currentSelection.course = null; 

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // THE COURSE DATABASE: Synchronized keys matching active session names perfectly
    const courseDatabase = {
        // MBCHB Tracks
        'mbchb_2': ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Therapeutics', 'Clinical Science', 'Laboratory Science', 'Diagnostics', 'Society and Medicine', 'Public Health'],
        'mbchb_3': ['Anatomy-(iii)', 'Physiology-(iii)', 'Biochemistry-(iii)', 'Pathology-(iii)', 'Therapeutics-(iii)', 'Clinical Science-(iii)', 'Laboratory Science-(iii)', 'Diagnostics-(iii)', 'Society and Medicine-(iii)', 'Public Health-(iii)'],
        
        // Biomedical Science Tracks (✅ Fixed Keys)
        'biomedical_2': ['Introduction to Biomedical Science', 'Introduction to Human Anatomy', 'Introduction to Medical Physiology', 'Introduction to Medical Microbiology', 'General Biochemistry'],
        'biomedical_3': ['Society and Medicine-(ii)', 'Histology', 'Physiology-(ii)', 'Parasitology', 'Virology/Mycology', 'Biochemistry-(ii)', 'Molecular and Cell Biology', 'Bacteriology'],
        'biomedical_4': ['Public Health-(iv)', 'General and Systematic Pathology', 'Pharmacology, Therapeutics and Toxicology', 'Immunology', 'Medical Genetics', 'Biostatics', 'Haematology and Blood Transfusion', 'Research and Methodology'],
        'biomedical_5': ['Skills in Laboratory Management', 'Medical Teaching Methodology', 'Cellular Pathology', 'Clinical Biochemistry', 'Research Project'],
        
        // Public Health Tracks (✅ Fixed Keys)
        'public_health_2': ['Primary Health Care-(ii)', 'Microbiology-(ii)', 'Health Promotion-(ii)', 'Human Anatomy-(ii) ', 'Human Physiology-(ii)', 'Environmental Health-(ii)'],
        'public_health_3': ['Psychology and Medicine', 'Epidemiology-(iii)', 'Food Technology and Hygiene-(iii)', 'Monitoring and Evaluation', 'Research and Biostatistics'],
        'public_health_4': ['Emerging Public Health Issues', 'Occupational Health and Ergonomics-(vi)', 'Food and Nutrition-(iv)', 'Research Project and Data Management-(iv)', 'Industrial Attachment'],
        'public_health_5': ['Global Health', 'Health Policies and Economics', 'Medical Parasitology-(v)', 'Health System, Management II and Health Promotion II', 'Basic Pharmacology and Toxicology-(v)'],
        
        // Environmental Health Tracks (✅ Fixed Keys)
        'environmental_2': ['Principles of Building and Construction', 'Primary Health Care', 'Environmental Health', 'Microbiology', 'Human Anatomy', 'Human Physiology'],
        'environmental_3': ['Biostatistics and Research', 'Food Animal Anatomy and Slaughter Houses', 'Epidemiology', 'Food Technology and Hygiene', 'Building Development and Planning'],
        'environmental_4': ['Occupational Health and Ergonomics', 'Industrial Training', 'Food Animal Pathology and Meat Inspection', 'Food and Nutrition', 'Inspection of Premises and Reporting', 'Research Project and Data Management'],
        'environmental_5': ['Environmental Economics, Management, Laws and Policies', 'Medical Parasitology', 'Occupational Health and Risk Analysis', 'Food Processing and Inspection', 'Basic Pharmacology and Toxicology', 'Environmental Health', 'Introduction to Public Health']
    };

    // Create the unique finder key based on current system state (e.g., "biomedical_2")
    const searchKey = `${currentSelection.program}_${yearNumber}`;
    
    // Fetch courses, or default to an empty list if we haven't added data for that year yet
    const activeCourses = courseDatabase[searchKey] || [];

    // Header layout configurations
    const displayYear = `Year 0${yearNumber}`;

    // If no courses are found for this specific year yet
    if (activeCourses.length === 0) {
        contentArea.innerHTML = `
            <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
                <div class="mb-8 flex items-center justify-between border-b border-slate-800/40 pb-4">
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${displayYear} Modules</h2>
                    <button onclick="selectProgram('${currentSelection.program}')" class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors">← Back to Years</button>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                    <i data-lucide="folder-open" class="w-8 h-8 text-slate-700 mb-3"></i>
                    <p class="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Curriculum Database Empty</p>
                    <p class="text-slate-600 text-xs mt-1 text-center">No modules are currently mapped to this specific academic terminal.</p>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Render the completely customized curriculum course block
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${displayYear} — Curriculum Modules</h2>
                    <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Select standard module to launch active file banks</p>
                </div>
                <button onclick="selectProgram('${currentSelection.program}')" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2">
                    <span>← Back to Years</span>
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${activeCourses.map((courseName, index) => {
                    const moduleCode = `${courseName.substring(0, 3).toUpperCase()}-0${index + 1}`;
                    return `
                        <button onclick="selectCourse('${courseName}', '${currentSelection.program}', ${yearNumber})" 
                            class="bg-slate-900/30 hover:bg-blue-600/10 border border-slate-800/80 hover:border-blue-500/30 rounded-2xl p-5 text-left transition-all duration-300 flex items-center justify-between group shadow-lg cursor-pointer">
                            
                            <div class="flex items-center space-x-4">
                                <div class="w-11 h-11 bg-slate-800/80 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-400 border border-slate-700/30 group-hover:border-blue-500/20 transition-all duration-300">
                                    <i data-lucide="book-open" class="w-5 h-5"></i>
                                </div>
                                <div>
                                    <div class="flex items-center space-x-2">
                                        <h4 class="text-sm font-black text-white uppercase tracking-wide">${courseName}</h4>
                                    </div>
                                    <p class="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Module ID: ${moduleCode}</p>
                                </div>
                            </div>
                            
                            <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600 group-hover:text-blue-400 translate-x-0 group-hover:translate-x-1 transition-all"></i>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}
// =======================================================================
// 📡 TRIPLE-MATRIX CENTRAL ROUTING CONTROLLER
// =======================================================================
window.resolveCurrentDatabaseKey = function() {
    // 1. Extract what the user currently has selected from states or memory storage
    const activeProgramRaw = ((window.currentSelection && window.currentSelection.program) || localStorage.getItem('active_program') || 'mbchb').toLowerCase().trim();
    const activeCourseRaw = ((window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Anatomy').trim();
    
    // Normalization logic for matching variations in sidebar string names
    let computedPrefix = "mbchb";
    if (activeProgramRaw.includes("biomed")) computedPrefix = "biomed";
    else if (activeProgramRaw.includes("public") || activeProgramRaw.includes("pub")) computedPrefix = "pubhealth";
    else if (activeProgramRaw.includes("env")) computedPrefix = "envhealth";

    console.log(`🔍 Mapping Active State Context Vector: Program [${computedPrefix}] | Course [${activeCourseRaw}]`);

    // 2. Loop directly through your new database to find an exact structural match
    for (const trackingKey in courseDatabase) {
        // Only look at keys belonging to the active program prefix
        if (trackingKey.startsWith(computedPrefix)) {
            const coursesInTrack = courseDatabase[trackingKey];
            
            // Clean strings to do an accurate match across text casings or hidden characters
            const cleanActiveCourse = activeCourseRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const matchFound = coursesInTrack.some(courseName => {
                const cleanDbCourse = courseName.toLowerCase().replace(/[^a-z0-9]/g, '');
                return cleanDbCourse === cleanActiveCourse || cleanDbCourse.includes(cleanActiveCourse);
            });

            if (matchFound) {
                // Extract out the exact academic year digit embedded in the matched key
                const extractedYear = trackingKey.split('_')[1] || "2";
                
                console.log(`✅ MATCH SECURED! Target Route Key resolved to: "${trackingKey}" (Year ${extractedYear})`);
                
                // Keep everything dynamically updated in memory so the views read it correctly
                localStorage.setItem('active_year', extractedYear);
                if (window.currentSelection) {
                    window.currentSelection.year = extractedYear;
                }
                
                return trackingKey; // Returns "biomed_3", "pubhealth_2", etc.
            }
        }
    }

    // 3. Fallback Route: If an exact course lookup fails, build an educated guess using tracking states
    const fallbackYear = String((window.currentSelection && window.currentSelection.year) || localStorage.getItem('active_year') || '2').replace(/\D/g, '') || "2";
    console.warn(`⚠️ Course name match not found in registry matrix. Constructing standard fallback route key: ${computedPrefix}_${fallbackYear}`);
    return `${computedPrefix}_${fallbackYear}`;
};

// Temporary placeholder function for Step 4 so the program doesn't throw errors on course clicks
function selectCourse(courseName, explicitProgramKey = null, explicitYearNumber = null) {
    console.log("Course Selected:", courseName);
    
    // 🎯 GLOBAL STATE ALIGNMENT: Establish and explicitly normalize state tracking keys
    if (!window.currentSelection) window.currentSelection = {};
    
    // 🛡️ RE-ANCHOR PARAMETERS: If explicitly passed down from the button element, save them over stale context metrics
    if (explicitProgramKey) {
        window.currentSelection.program = explicitProgramKey;
    }
    if (explicitYearNumber) {
        window.currentSelection.year = explicitYearNumber;
    }
    
    window.currentSelection.course = courseName;
    
    // Lock accurate contextual states into browser storage frames immediately for fallback resilience
    localStorage.setItem('active_course', courseName.trim()); 
    if (window.currentSelection.year) {
        localStorage.setItem('active_year', window.currentSelection.year);
    }
    if (window.currentSelection.program) {
        localStorage.setItem('active_program', window.currentSelection.program);
    }
    
    window.currentSelection.viewMode = null; 
    window.currentSelection.term = null;

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // 1. Draw the Course Hub Layout workspace container
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${courseName} Hub</h2>
                    <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Select preparation matrix or execute performance assessment</p>
                </div>
               <button onclick="selectYear((window.currentSelection && window.currentSelection.year) || (typeof currentSelection !== 'undefined' && currentSelection.year) || localStorage.getItem('active_year') || 2)" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2">
                    <span>← Back to Modules</span>
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                
                <button onclick="selectViewMode('notes')" 
                    class="bg-slate-900/20 hover:bg-blue-600/[0.04] border border-slate-800/80 hover:border-blue-500/30 rounded-2xl p-8 text-left transition-all duration-300 group flex flex-col justify-between space-y-12 shadow-lg h-64">
                    <div class="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 transition-all duration-300 group-hover:scale-105">
                        <i data-lucide="book-open-check" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-white uppercase tracking-wide group-hover:text-blue-400 transition-colors">Course Topic Notes</h3>
                        <p class="text-slate-500 text-[10px] uppercase tracking-wider mt-1 normal-case leading-relaxed">Review condensed high-yield summary notes organized into portfolios before testing.</p>
                    </div>
                </button>

                <button onclick="selectViewMode('assessments')" 
                    class="bg-slate-900/20 hover:bg-amber-600/[0.04] border border-slate-800/80 hover:border-amber-500/30 rounded-2xl p-8 text-left transition-all duration-300 group flex flex-col justify-between space-y-12 shadow-lg h-64">
                    <div class="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20 transition-all duration-300 group-hover:scale-105">
                        <i data-lucide="activity" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-white uppercase tracking-wide group-hover:text-amber-400 transition-colors">Interactive Assessments</h3>
                        <p class="text-slate-500 text-[10px] uppercase tracking-wider mt-1 normal-case leading-relaxed">Launch clinical library data files to run custom question banks and evaluate domain expertise.</p>
                    </div>
                </button>

            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}
function selectViewMode(mode) {
    currentSelection.viewMode = mode;
    
    if (mode === 'assessments') {
        renderAssessmentsView();
    } else if (mode === 'notes') {
        // We will build this layout engine in Step 4!
        renderTermsView(); 
    }
}


// 🎯 PASS CONTEXT DIRECTLY: Add courseName as an explicit second argument
window.navigateToSlotWorkspace = function(slotId) {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // Maintain tracking in memory quietly for structural filtering
    const activeCourse = (window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Anatomy';

    if (!window.currentSelection) window.currentSelection = {};
    
    // 🎯 RE-MAPPED TO STRING IDENTIFIER: Capture the precise milestone signature (e.g., "Term 1-An")
    const cleanSlotId = String(slotId).trim();
    window.currentSelection.slotId = cleanSlotId;
    window.currentSelection.course = activeCourse.trim();

    // 1. Overwrite the layout to display the simplified view
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${cleanSlotId} Bank — Available Papers</h2>
                    <p class="text-[10px] text-purple-500 font-bold uppercase tracking-widest mt-1">Review and execute published data records inside this repository</p>
                </div>
                
                <button onclick="if(typeof renderAssessmentsView === 'function') renderAssessmentsView();" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2">
                    <span>← Back to Slots</span>
                </button>
            </div>

            <div id="active-quiz-questions-portal" class="w-full space-y-3 mt-2"></div>
        </div>
    `;

    // 2. Trigger the blueprint compiler to draw the quiz cards
    if (typeof window.renderTargetQuizBlueprintCards === 'function') {
        window.renderTargetQuizBlueprintCards();
    }
};
window.renderTermsView = function() {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // 1. Gather descriptive title parameters with reliable string state fallbacks
    const activeCourseName = ((window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Course Module').trim();
    
    // Track view state to allow immersive reader windows to close cleanly back to this terminal point
    if (typeof window.renderActiveModulePortalView !== 'function') {
        window.renderActiveModulePortalView = window.renderTermsView;
    }

    // 2. Inject structural elements using purple accents to isolate the PDF sub-modules
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${activeCourseName.toUpperCase()} — Summary Portfolios</h2>
                    <p class="text-[10px] text-purple-500 font-bold uppercase tracking-widest mt-1">Select academic term to unlock high-yield topics index</p>
                </div>
                <button onclick="selectCourse('${activeCourseName.replace(/'/g, "\\'")}')" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer">
                    <span>← Back to Hub</span>
                </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                ${[1, 2, 3].map(termNum => `
                    <button onclick="window.selectTermPortfolio(${termNum})" 
                        class="bg-slate-900/30 hover:bg-purple-600/[0.03] border border-slate-800/80 hover:border-purple-500/20 hover:shadow-purple-950/10 rounded-2xl p-6 text-center transition-all duration-300 group flex flex-col items-center justify-center space-y-4 shadow-lg cursor-pointer">
                        
                        <div class="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-slate-950 border border-purple-500/20 transition-all duration-300 shadow-inner">
                            <i data-lucide="archive" class="w-5 h-5 transition-transform group-hover:scale-110"></i>
                        </div>
                        
                        <div class="flex flex-col space-y-1">
                            <span class="text-sm font-black text-white tracking-wide uppercase">Academic Term 0${termNum}</span>
                            <span class="text-[9px] text-slate-500 font-black uppercase tracking-wider">Summary Handouts Index</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
};
window.selectTermPortfolio = function(termNumber) {
    console.log("🎬 Term Content Portals Active. Selected Key Id Index:", termNumber);
    
    // Attach values to global state so they are universally accessible
    window.termNumber = termNumber;
    if (window.currentSelection) {
        window.currentSelection.term = termNumber;
    }
    localStorage.setItem('active_viewing_term', String(termNumber));

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // Gather baseline path keys safely from current program tracking states
    window.activeCourseRaw = ((window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Anatomy').trim();
    const explicitProgram = ((window.currentSelection && window.currentSelection.program) || localStorage.getItem('active_program') || 'mbchb').toLowerCase().trim();

    // =======================================================================
    // 🗃️ COURSE DATABASE REPOSITORY MATRIX (SYNCHRONIZED SPELLINGS)
    // =======================================================================
    const courseDatabase = {
        'mbchb_2': ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Therapeutics', 'Clinical Science', 'Laboratory Science', 'Diagnostics', 'Society and Medicine', 'Public Health'],
        'mbchb_3': ['Anatomy-(iii)', 'Physiology-(iii)', 'Biochemistry-(iii)', 'Pathology-(iii)', 'Therapeutics-(iii)', 'Clinical Science-(iii)', 'Laboratory Science-(iii)', 'Diagnostics-(iii)', 'Society and Medicine-(iii)', 'Public Health-(iii)'],
        'biomed_2': ['Introduction to Biomedical Science', 'Introduction to Human Anatomy', 'Introduction to Medical Physiology', 'Introduction to Medical Microbiology', 'General Biochemistry'],
        'biomed_3': ['Society and Medicine-(ii)', 'Histology', 'Physiology-(ii)', 'Parasitology', 'Virology/Mycology', 'Biochemistry-(ii)', 'Molecular and Cell Biology', 'Bacteriology'],
        'biomed_4': ['Public Health-(iv)', 'General and Systematic Pathology', 'Pharmacology, Therapeutics and Toxicology', 'Immunology', 'Medical Genetics', 'Biostatistics and Research', 'Haematology and Blood Transfusion', 'Research and Methodology'],
        'biomed_5': ['Skills in Laboratory Management', 'Medical Teaching Methodology', 'Cellular Pathology', 'Clinical Biochemistry', 'Research Project'],
        'pubhealth_2': ['Primary Health Care-(ii)', 'Microbiology-(ii)', 'Health Promotion-(ii)', 'Human Anatomy-(ii)', 'Human Physiology-(ii)', 'Environmental Health-(ii)'],
        'pubhealth_3': ['Psychology and Medicine', 'Epidemiology-(iii)', 'Food Technology and Hygiene-(iii)', 'Monitoring and Evaluation', 'Research and Biostatistics'],
        'pubhealth_4': ['Emerging Public Health Issues', 'Occupational Health and Ergonomics-(vi)', 'Food and Nutrition-(iv)', 'Research Project and Data Management-(iv)', 'Industrial Attachment'],
        'pubhealth_5': ['Global Health', 'Health Policies and Economics', 'Medical Parasitology-(v)', 'Health System, Management II and Health Promotion II', 'Basic Pharmacology and Toxicology-(v)'],
        'envhealth_2': ['Principles of Building and Construction', 'Primary Health Care', 'Environmental Health', 'Microbiology', 'Human Anatomy', 'Human Physiology'],
        'envhealth_3': ['Biostatistics and Research', 'Food Animal Anatomy and Slaughter Houses', 'Epidemiology', 'Food Technology and Hygiene', 'Building Development and Planning'],
        'envhealth_4': ['Occupational Health and Ergonomics', 'Industrial Training', 'Food Animal Pathology and Meat Inspection', 'Food and Nutrition', 'Inspection of Premises and Reporting', 'Research Project and Data Management'],
        'envhealth_5': ['Environmental Economics, Management, Laws and Policies', 'Medical Parasitology', 'Occupational Health and Risk Analysis', 'Food Processing and Inspection', 'Basic Pharmacology and Toxicology', 'Environmental Health', 'Introduction to Public Health']
    };

    let programPrefix = explicitProgram;
    if (programPrefix.includes("biomedical") || programPrefix.includes("biomed")) {
        programPrefix = "biomed";
    } else if (programPrefix.includes("public health") || programPrefix.includes("public-health") || programPrefix.includes("pubhealth") || programPrefix.includes("pub")) {
        programPrefix = "pubhealth";
    } else if (programPrefix.includes("environmental") || programPrefix.includes("envhealth") || programPrefix.includes("env")) {
        programPrefix = "envhealth";
    } else if (programPrefix.includes("mbchb") || programPrefix.includes("bds") || programPrefix.includes("medicine") || programPrefix.includes("cm") || programPrefix === "all") {
        programPrefix = "mbchb";
    }

    // Determine current Viewport Key Matrix
    window.activeCurrentViewportKey = "";

    for (const trackingKey in courseDatabase) {
        if (trackingKey.startsWith(programPrefix)) {
            const strictIdentityMatch = courseDatabase[trackingKey].some(courseName => courseName.trim() === window.activeCourseRaw.trim());
            if (strictIdentityMatch) {
                window.activeCurrentViewportKey = trackingKey;
                break;
            }
        }
    }
    if (!window.activeCurrentViewportKey) {
        const cleanActiveCourse = window.activeCourseRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const trackingKey in courseDatabase) {
            if (trackingKey.startsWith(programPrefix)) {
                const strictMatchFound = courseDatabase[trackingKey].some(courseName => courseName.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanActiveCourse);
                if (strictMatchFound) {
                    window.activeCurrentViewportKey = trackingKey;
                    break;
                }
            }
        }
    }
    if (!window.activeCurrentViewportKey) {
        const cleanActiveCourse = window.activeCourseRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const trackingKey in courseDatabase) {
            if (trackingKey.startsWith(programPrefix)) {
                const looseMatchFound = courseDatabase[trackingKey].some(courseName => {
                    const cleanDbCourse = courseName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanDbCourse.includes(cleanActiveCourse) || cleanActiveCourse.includes(cleanDbCourse);
                });
                if (looseMatchFound) {
                    window.activeCurrentViewportKey = trackingKey;
                    break;
                }
            }
        }
    }

    if (!window.activeCurrentViewportKey) {
        const rawYear = String((window.currentSelection && window.currentSelection.year) || localStorage.getItem('active_year') || '2').trim();
        const cleanYearDigits = rawYear.replace(/\D/g, '') || "2";
        window.activeCurrentViewportKey = `${programPrefix}_${cleanYearDigits}`;
    } else {
        const resolvedYearDigit = window.activeCurrentViewportKey.split('_')[1];
        localStorage.setItem('active_year', resolvedYearDigit);
        if (window.currentSelection) window.currentSelection.year = resolvedYearDigit;
    }

    function compileBaseDashboardShellMarkup(innerContentMarkup) {
        return `
            <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
                <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-black text-white uppercase tracking-wider">Term 0${termNumber} — Summary Topics</h2>
                        <p class="text-[10px] text-purple-500 font-bold uppercase tracking-widest mt-1">Select an administrator-published document to launch high-yield reading module</p>
                    </div>
                    <button onclick="renderTermsView()" 
                        class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer">
                        <span>← Back to Terms</span>
                    </button>
                </div>
                <div id="portfolio-runtime-render-slot">
                    ${innerContentMarkup}
                </div>
            </div>
        `;
    }

    contentArea.innerHTML = compileBaseDashboardShellMarkup(`
        <div class="w-full h-full flex items-center justify-center p-20 min-h-[200px]">
            <div class="flex flex-col items-center space-y-3">
                <div class="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest animate-pulse">Querying Central Notes Matrix...</span>
            </div>
        </div>
    `);

    if (window.lucide) window.lucide.createIcons();

    // Fetch the notes immediately now that the framework structure is appended
    window.fetchLiveDatabaseNotes();
};

function processAndRenderNotesCollection(collectionArray, isUsingFallbackLocalCache = false) {
    const renderSlot = document.getElementById('portfolio-runtime-render-slot');
    if (!renderSlot) return;

    // Safely draw from global runtime windows to avoid initialization faults
    const activeCourseRaw = window.activeCourseRaw || "Anatomy";
    const activeCurrentViewportKey = window.activeCurrentViewportKey || "";
    const termNumber = window.termNumber || "1";

    const cleanActiveCourseForFilter = activeCourseRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const verifiedFilteredTopics = collectionArray.map((recordItem, nativeIdx) => {
        let parsedStructure = {};
        try {
            if (recordItem.content && !recordItem.noteDataStructure) {
                parsedStructure = typeof recordItem.content === 'string' ? JSON.parse(recordItem.content) : recordItem.content;
            } else if (recordItem.noteDataStructure) {
                parsedStructure = typeof recordItem.noteDataStructure === 'string' ? JSON.parse(recordItem.noteDataStructure) : recordItem.noteDataStructure;
            } else {
                parsedStructure = recordItem;
            }
        } catch(e) {
            console.error("Payload corruption exception handled gracefully on index:", nativeIdx);
        }
        return { 
            ...recordItem, 
            _parsedData: parsedStructure, 
            _globalArrayIndex: nativeIdx 
        };
    }).filter(item => {
        if (!item || !item._parsedData) return false;
        
        const targetTrackingKey = item.storageKey || item.trackingKey || item._parsedData.storageKey || item._parsedData.trackingKey;
        const trackMatch = (String(targetTrackingKey) === String(activeCurrentViewportKey));
        
        const itemCourseModule = item.courseModule || item._parsedData.courseModule || "";
        const cleanItemCourse = itemCourseModule.toLowerCase().replace(/[^a-z0-9]/g, '');
        const courseMatch = (itemCourseModule.trim() === activeCourseRaw.trim()) || 
                            cleanItemCourse.includes(cleanActiveCourseForFilter) || 
                            cleanActiveCourseForFilter.includes(cleanItemCourse);
        
        const targetTerm = item.term || item._parsedData.term;
        const termMatch = (String(targetTerm) === String(termNumber));
        
        return trackMatch && courseMatch && termMatch;
    });

    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    const isAdminActive = (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN');
    const globalNotesStorageKey = "clinical_neural_notes_registry";

    let finalMarkup = "";

    if (verifiedFilteredTopics.length === 0) {
        finalMarkup = `
            <div class="border border-dashed border-slate-800 bg-slate-900/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-200">
                <span class="text-amber-500 font-bold text-lg">⚠️</span>
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Portfolio Empty</span>
                <p class="text-[11px] text-slate-500 max-w-xs normal-case leading-relaxed mb-4">
                    There are currently no summarized study files deployed for Term 0${termNumber} in this module.
                </p>
                <div class="w-full max-w-md p-4 rounded-xl bg-slate-950/80 border border-purple-500/10 text-left font-mono text-[10px] text-slate-400 space-y-1.5 shadow-inner">
                    <div class="text-purple-400 font-bold border-b border-slate-800 pb-1 mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>📡 System Router Diagnostics</span>
                        <span class="text-[8px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20 text-emerald-300">
                            ${isUsingFallbackLocalCache ? 'Local Mock Cache' : 'Python FastAPI DB'}
                        </span>
                    </div>
                    <div><span class="text-slate-500">Target storageKey prefix:</span> <span class="text-emerald-400 font-bold">"${activeCurrentViewportKey}"</span></div>
                    <div><span class="text-slate-500">Expected courseModule slot:</span> <span class="text-blue-400 font-bold">"${activeCourseRaw}"</span></div>
                    <div><span class="text-slate-500">Expected Explicit term:</span> <span class="text-amber-400 font-bold">"${termNumber}"</span></div>
                </div>
            </div>
        `;
    } else {
        finalMarkup = `
            <div class="flex flex-col space-y-2 animate-in fade-in duration-200" id="active-notes-content-portal">
                ${verifiedFilteredTopics.map((noteObject, idx) => {
                    const displayTitle = (noteObject.title || noteObject.topicTitle || "Untitled Document Handout").toUpperCase();
                    const nativeTargetIdx = noteObject._globalArrayIndex;
                    
                    // Use database sequential 'id' parameter for live API routing, fall back to structural sequence index
                    const primaryDatabaseIdentityKey = noteObject.id !== undefined ? noteObject.id : nativeTargetIdx;

                    return `
                        <div class="w-full flex items-center space-x-2 group">
                            <button onclick="window.launchFullScreenPDFReader('${globalNotesStorageKey}', ${nativeTargetIdx})" 
                                class="flex-1 bg-slate-900/20 hover:bg-purple-600/[0.02] border border-slate-800/80 hover:border-purple-500/20 p-4 rounded-xl text-left transition-all duration-300 flex items-center justify-between shadow-sm cursor-pointer">
                                <div class="flex items-center space-x-3.5">
                                    <span class="text-xs font-bold text-slate-300 group-hover:text-white transition-colors uppercase tracking-wide">
                                        0${idx + 1}. ${displayTitle}
                                    </span>
                                </div>
                                <span class="text-[9px] text-purple-400 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300">Read Handout →</span>
                            </button>

                            ${isAdminActive ? `
                                <button onclick="window.deleteNoteFromSystem(event, ${isUsingFallbackLocalCache}, ${primaryDatabaseIdentityKey}, '${displayTitle.replace(/'/g, "\\'")}')"
                                    title="Delete Document Portfolio Entry"
                                    class="bg-red-950/20 hover:bg-red-600 border border-red-900/40 hover:border-red-500 p-4 rounded-xl text-red-400 hover:text-white transition-all duration-200 flex items-center justify-center flex-shrink-0 group/btn shadow-sm cursor-pointer">
                                    <i data-lucide="trash-2" class="w-4 h-4 transform group-hover/btn:scale-110 transition-transform"></i>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    renderSlot.innerHTML = finalMarkup;
    if (window.lucide) window.lucide.createIcons();
}

window.fetchLiveDatabaseNotes = function() {
    console.log("📡 Initializing Live Sync Pipeline against Python FastAPI Database...");

    fetch(`http://127.0.0.1:8000/notes`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
        return response.json();
    })
    .then(databaseCollection => {
        console.log("📡 Live Python FastAPI notes collection synchronized successfully.", databaseCollection);
        window.currentCourseNotesList = databaseCollection;
        processAndRenderNotesCollection(databaseCollection, false);
    })
    .catch(error => {
        console.warn("⚠️ FastAPI fallback mode active:", error.message);
        const localRegistryKey = "clinical_neural_notes_registry";
        let localNotesArray = [];
        try {
            const rawLocalData = localStorage.getItem(localRegistryKey);
            localNotesArray = rawLocalData ? JSON.parse(rawLocalData) : [];
        } catch(e) {
            localNotesArray = [];
        }
        window.currentCourseNotesList = localNotesArray;
        processAndRenderNotesCollection(localNotesArray, true);
    });
};

// =========================================================================
// 📡 REAL-TIME PUSHER LISTENER FOR NOTES
// =========================================================================
(function initNotesPusherListener() {
    // ⚠️ Replace with your actual Pusher Key and Cluster values
    const PUSHER_KEY = "2b95caa0e04ac6e6a50c"; 
    const PUSHER_CLUSTER = "mt1";

    if (typeof window.Pusher !== "undefined") {
        const pusher = new window.Pusher(PUSHER_KEY, {
            cluster: PUSHER_CLUSTER,
            forceTLS: true
        });

        const channel = pusher.subscribe("notes-channel");

        channel.bind("note_published", function(data) {
            console.log("⚡ Real-Time Signal Received: New Note Event", data);

            // Trigger live re-sync from Python FastAPI database
            if (typeof window.fetchLiveDatabaseNotes === "function") {
                window.fetchLiveDatabaseNotes();
            }
        });
    } else {
        console.warn("⚠️ Pusher library not ready.");
    }
})();
    // Secondary inline helper method to filter and process array maps into HTML blocks
   

// 🗑️ CLEAN PURGE AND UNMOUNT ENGINE: REMOVES PDF ENTRIES FROM LOGICAL SLOT MATRICES
window.deleteNoteFromSystem = function(event, isFallbackCache, referenceIdentityKey, noteTitle) {
    // Stop click events from bubbling outward and accidentally opening the document viewer
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }

    // 🔒 ROLE SECURITY CLEARANCE CHECK
    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        if (typeof window.showToast === 'function') {
            window.showToast(
                "Security Violation", 
                "Your student security clearance profile node cannot execute document deletion sequences.", 
                "error"
            );
        } else {
            alert("Security Error: Access Denied. Administrative clearance required.");
        }
        return;
    }

    // Safety Prompt Guard Rail Verification
    const confirmVerification = confirm(`Are you absolutely sure you want to permanently delete the document portfolio entry:\n"${noteTitle.toUpperCase()}"?\n\nThis action cannot be undone.`);
    if (!confirmVerification) return;

    // Helper method to refresh user viewport seamlessly
    const triggerViewportHotReload = function() {
        const activeViewingTermRaw = localStorage.getItem('active_viewing_term');
        const fallbackTermNumber = (window.currentSelection && window.currentSelection.term) || 1;
        
        let targetTermNumber = fallbackTermNumber;
        if (activeViewingTermRaw) {
            targetTermNumber = activeViewingTermRaw.replace(/\D/g, '') || fallbackTermNumber;
        }

        if (typeof window.selectTermPortfolio === 'function') {
            console.log(`🔄 Triggering hot-reload viewport update for Term: ${targetTermNumber}`);
            window.selectTermPortfolio(targetTermNumber);
        } else if (typeof window.renderActiveModulePortalView === 'function') {
            window.renderActiveModulePortalView();
        } else {
            window.location.reload();
        }
    };

    // Helper method to purge the item from Local Storage fallback cache
    const performLocalStoragePurge = function() {
        try {
            const targetStorageKey = "clinical_neural_notes_registry";
            const rawExistingRecords = localStorage.getItem(targetStorageKey);
            if (!rawExistingRecords) return;

            let unifiedNotesArray = JSON.parse(rawExistingRecords);
            if (!Array.isArray(unifiedNotesArray)) return;

            // Find either by index (if numeric) or matching title/id
            let itemIndex = -1;
            if (typeof referenceIdentityKey === 'number') {
                itemIndex = referenceIdentityKey;
            } else {
                itemIndex = unifiedNotesArray.findIndex(note => 
                    note.id == referenceIdentityKey || 
                    (note.title && note.title.toLowerCase() === noteTitle.toLowerCase())
                );
            }

            if (itemIndex < 0 || itemIndex >= unifiedNotesArray.length) {
                console.warn("Could not target matching array index for local cache cleanup.");
                return;
            }

            unifiedNotesArray.splice(itemIndex, 1);

            if (unifiedNotesArray.length > 0) {
                localStorage.setItem(targetStorageKey, JSON.stringify(unifiedNotesArray));
            } else {
                localStorage.removeItem(targetStorageKey);
            }

            if (typeof window.showToast === 'function') {
                window.showToast(
                    "Local Ledger Updated",
                    `Document "${noteTitle.toUpperCase()}" has been removed from browser cache memory.`,
                    "success"
                );
            } else {
                alert(`🎉 Cleaned: "${noteTitle.toUpperCase()}" successfully removed.`);
            }
            triggerViewportHotReload();
        } catch (error) {
            console.error("Local storage update failure:", error);
        }
    };

    console.log(`🎬 Operational deletion sequence fired. Cache Fallback State: ${isFallbackCache} | Target ID Key: ${referenceIdentityKey}`);

    // =======================================================================
    // 📡 PATH A: LIVE PYTHON FASTAPI POSTGRESQL DELETION DRIVER
    // =======================================================================
    if (!isFallbackCache && referenceIdentityKey && !isNaN(parseInt(referenceIdentityKey, 10))) {
        const BACKEND_URL = `http://127.0.0.1:8000/notes/${referenceIdentityKey}`;
        
        fetch(BACKEND_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
            // 🧠 Hybrid Fallback: If 404 (doesn't exist in DB), try clearing localStorage cache
            if (response.status === 404) {
                console.warn("⚠️ Server returned 404. Falling back to clearing browser memory...");
                performLocalStoragePurge();
                return null;
            }
            if (!response.ok) throw new Error(`Server status code: ${response.status}`);
            return response.json();
        })
        .then(apiFeedback => {
            if (apiFeedback) {
                console.log("🎯 Live FastAPI backend drop transaction committed:", apiFeedback);
                
                // Keep local storage synced with DB removals
                performLocalStoragePurge(); 
                
                if (typeof window.showToast === 'function') {
                    window.showToast(
                        "Database Ledger Updated",
                        `Document "${noteTitle.toUpperCase()}" scrubbed successfully from the server.`,
                        "success"
                    );
                }
                triggerViewportHotReload();
            }
        })
        .catch(err => {
            console.error("Database deletion pipeline failure:", err);
            // Backup prompt if connection fails completely
            const forceLocal = confirm("Connection to server failed. Force delete this note from your browser locally anyway?");
            if (forceLocal) {
                performLocalStoragePurge();
            }
        });

    // =======================================================================
    // 💾 PATH B: DIRECT LOCAL STORAGE MUTATION
    // =======================================================================
    } else {
        performLocalStoragePurge();
    }
};
// 🖥️ REFACTORED STUDENT VIEW SHEET ENGINE: EMBEDDED PDF SANDBOX PREVIEWER
// 🖥️ IMMERSIVE FULL-FRAME DOCUMENT VIEWER ENGINE
// 🌍 GLOBAL SCOPE HOLDER FOR INITIAL STYLES
window._originalViewportClassName = "";

// 🖥️ IMMERSIVE FULL-FRAME DOCUMENT VIEWER ENGINE
window.launchFullScreenPDFReader = function(storageKey, index) {
    console.log(`📡 Opening Immersive Document View Matrix. Address/Source: ${storageKey} | Target Node Index: ${index}`);
    
    let activeDocumentNode = null;
    let base64PdfDataStream = "";
    let documentTitle = "ASSIGNED ASSESSMENT LECTURE NOTE";

    // 🎯 NEW DB DESERIALIZATION ENGINE & MULTI-PATH FALLBACK
    if (storageKey === "clinical_neural_notes_registry") {
        const activeNotesList = window.currentCourseNotesList || [];
        const dbRecord = activeNotesList[index];
        
        if (dbRecord) {
            documentTitle = dbRecord.title || "LECTURE COURSE NOTE";
            activeDocumentNode = dbRecord; // Flag found state

            // Handle structure normalization matches from processAndRenderNotesCollection
            let parsedStructure = {};
            try {
                if (dbRecord.content && !dbRecord.noteDataStructure) {
                    parsedStructure = typeof dbRecord.content === 'string' ? JSON.parse(dbRecord.content) : dbRecord.content;
                } else if (dbRecord.noteDataStructure) {
                    parsedStructure = typeof dbRecord.noteDataStructure === 'string' ? JSON.parse(dbRecord.noteDataStructure) : dbRecord.noteDataStructure;
                } else {
                    parsedStructure = dbRecord;
                }
            } catch (jsonErr) {
                console.error("Failure unpacking note payload infrastructure structural layers:", jsonErr);
                parsedStructure = dbRecord;
            }

            // Extract stream target from any potential field match layout
            base64PdfDataStream = parsedStructure.fileData || parsedStructure.pdfData || dbRecord.pdfData || dbRecord.fileData || "";
        }
    } else {
        // Path B: Fallback to traditional local storage arrays for your traditional quizzes
        let recordCollectionArray = [];
        try {
            recordCollectionArray = JSON.parse(localStorage.getItem(storageKey)) || [];
        } catch(e) { 
            console.error("Critical fault parsing storage array token map stream", e);
            recordCollectionArray = []; 
        }
        activeDocumentNode = recordCollectionArray[index];
        if (activeDocumentNode) {
            base64PdfDataStream = activeDocumentNode.fileData || activeDocumentNode.pdfData || "";
            documentTitle = activeDocumentNode.topicTitle || activeDocumentNode.title || "ASSIGNED ASSESSMENT LECTURE NOTE";
        }
    }
    
    // Fail-safe validation check
    if (!activeDocumentNode || !base64PdfDataStream) {
        alert("Execution Error: The targeted document instance or binary data stream could not be resolved from active database memory.");
        return;
    }

    // 🌟 ENFORCED APPLICATION PROTOCOL FORMATTING
    // If the data string does not contain the data-URI layout prefix, apply it safely
    if (!base64PdfDataStream.startsWith("data:application/pdf;base64,")) {
        // Strip out any trailing newline characters or spaces that leak from raw text dumps
        base64PdfDataStream = `data:application/pdf;base64,${base64PdfDataStream.trim()}`;
    }
    
    // 1. Check if a dedicated reader layer already exists, if not, spawn it safely onto the body
    let readerOverlay = document.getElementById('document-reader-overlay');
    if (!readerOverlay) {
        readerOverlay = document.createElement('div');
        readerOverlay.id = 'document-reader-overlay';
        document.body.appendChild(readerOverlay);
    }
    
    // 2. Set full screen overlay layouts strictly over everything else (z-[99999])
    readerOverlay.className = "fixed inset-0 w-screen h-screen bg-[#02060f] z-[99999] flex flex-col m-0 p-0 overflow-hidden animate-in fade-in duration-200";
    
    // 3. Inject the clean document panel view directly inside the overlay container
    readerOverlay.innerHTML = `
        <div class="w-full flex justify-between items-center bg-[#050b18] border-b border-slate-800/80 px-6 py-4 flex-shrink-0 z-50">
            <div class="flex items-center space-x-3">
                <div class="w-7 h-7 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400 border border-purple-500/20">
                    <i data-lucide="file-text" class="w-4 h-4"></i>
                </div>
                <div>
                    <span class="text-[9px] font-mono text-purple-400 block uppercase tracking-widest">Neural Link Document Viewsheet</span>
                    <h2 class="text-xs font-black text-white uppercase tracking-wider">${documentTitle.toUpperCase()}</h2>
                </div>
            </div>
            
            <button onclick="window.exitFullScreenReaderMode()" 
                class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-2 cursor-pointer">
                <i data-lucide="minimize-2" class="w-3.5 h-3.5"></i>
                <span>Close Document Session</span>
            </button>
        </div>

        <div class="flex-1 w-full h-full min-h-0 bg-[#02060f] p-0 m-0 overflow-hidden block">
            <iframe src="${base64PdfDataStream}" 
                    class="w-full h-full border-none block m-0 p-0" 
                    style="display: block; width: 100%; height: 100%; min-height: 100%;"
                    type="application/pdf">
            </iframe>
        </div>
    `;
    
    if (window.lucide) window.lucide.createIcons();
};

// Simple clean exit handler helper implementation to wipe the structural DOM element cleanly out of action
window.exitFullScreenReaderMode = function() {
    const readerOverlay = document.getElementById('document-reader-overlay');
    if (readerOverlay) {
        readerOverlay.remove();
    }
};

// 🔲 COMPANION WINDOW EXIT FUNCTION
window.exitFullScreenReaderMode = function() {
    console.log("♻️ Demolishing document reader layer matrix overlay...");
    
    // 1. Locate and remove the overlay node from the living document body tree
    const readerOverlay = document.getElementById('document-reader-overlay');
    if (readerOverlay) {
        readerOverlay.innerHTML = ""; // Kill iframe instances and bindings completely
        readerOverlay.remove();       // Erase node completely
    }
    
    // 2. Refresh active dashboard screen modules gently without disturbing any layout class properties
    if (typeof window.renderActiveModulePortalView === 'function') {
        window.renderActiveModulePortalView(); 
    } else if (typeof window.selectTermPortfolio === 'function') {
        const lastActiveTerm = localStorage.getItem('active_viewing_term') || '1';
        const termDigits = lastActiveTerm.replace(/\D/g, '') || "1";
        window.selectTermPortfolio(Number(termDigits));
    }
};
// 6. Full-Screen Handout Document Session Exit Router (No Refresh Fix)
function closeDocumentSession() {
    console.log("Terminating active reading session. Restoring original layout architecture...");
    
    // 1. Reset the core viewport class locks back to standard application parameters
    const viewport = document.getElementById('app-viewport');
    if (viewport) {
        viewport.className = "min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans";
    }

    // 2. REBUILD DASHBOARD INNER MARKS:
    // Instead of reloading, we call your core function that draws the sidebar/header frame.
    // Replace 'renderMainLayout' below with the name of your dashboard frame function if it differs!
    if (typeof renderMainLayout === 'function') {
        renderMainLayout(); 
    } else if (typeof showDashboard === 'function') {
        showDashboard();
    } else {
        // Fallback: If we can't find the master template generator, let's look at how your app
        // navigates programs to force the main screen back on line
        const activeProgram = currentSelection && currentSelection.program ? currentSelection.program : 'mbchb';
        if (typeof selectProgram === 'function') selectProgram(activeProgram);
    }
    
    // 3. Drop back into the active term directory matching your current filter path selection
    const activeTerm = currentSelection && currentSelection.term ? currentSelection.term : 1;
    if (typeof selectTermPortfolio === 'function') {
        selectTermPortfolio(activeTerm);
    }
}

// Alias bridge to capture the legacy template click handler name seamlessly
function exitFullScreenReaderMode() {
    closeDocumentSession();
}
window.logout = function(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    // 1. 🛡️ Set intentional logout flag & stop watchdog interval immediately
    window.isLoggingOut = true;
    if (window.watchdogInterval) {
        clearInterval(window.watchdogInterval);
        window.watchdogInterval = null;
    }

    console.log("🔒 Terminating active session matrices...");

    const runLocalSignoutCleanup = () => {
        window.currentUserSession = null;
        sessionStorage.removeItem('neural_link_active_session');
        localStorage.removeItem('active_course'); 
        localStorage.removeItem('portal_active_sessions_ledger');

        const viewport = document.getElementById('app-viewport');
        if (viewport) {
            viewport.style.transition = "opacity 0.3s ease-in-out, filter 0.3s ease-in-out";
            viewport.style.opacity = "0";
            viewport.style.filter = "blur(10px)";
        }

        setTimeout(() => {
            if (viewport) {
                viewport.innerHTML = '';
                viewport.className = ""; 
                viewport.style.opacity = "1";
                viewport.style.filter = "none";
            }

            const mainPlatformHeader = document.querySelector('header') || document.getElementById('main-header') || document.querySelector('nav');
            if (mainPlatformHeader) {
                mainPlatformHeader.classList.remove('hidden');
            }

            if (typeof window.renderLogin === 'function') {
                console.log("🔄 Re-rendering login panel canvas natively...");
                window.renderLogin();
            } else if (typeof window.showLoginPhaseUI === 'function') {
                console.log("🔄 Re-rendering login panel via alternate hook...");
                window.showLoginPhaseUI();
            } else {
                const loginContainer = document.getElementById('login-container') || document.querySelector('.login-phase-wrapper');
                if (loginContainer) {
                    console.log("🔄 Native container fallback swap executed.");
                    loginContainer.classList.remove('hidden');
                    loginContainer.style.display = 'flex';
                } else {
                    console.log("🔄 No native login renderer found. Final fallback reload...");
                    window.location.reload();
                }
            }

            // Reset logout flag after navigation finishes
            setTimeout(() => {
                window.isLoggingOut = false;
            }, 1000);
        }, 300);
    };

    try {
        const activeSessionData = sessionStorage.getItem('neural_link_active_session');
        if (activeSessionData) {
            const parsedSession = JSON.parse(activeSessionData);
            const studentNum = parsedSession.studentNumber || parsedSession.student_number;

            if (studentNum && (parsedSession.role === "STUDENT" || !parsedSession.role)) {
                console.log(`📡 Sending deletion request to Supabase ledger for student: ${studentNum}`);
                
                window.supabase
                    .from('portal_active_sessions_ledger')
                    .delete()
                    .eq('student_number', studentNum.trim())
                    .then(({ error }) => {
                        if (error) {
                            console.error("❌ Failed to clean session ledger from Supabase:", error);
                        } else {
                            console.log("🧼 Session ledger successfully cleaned on database cloud ledger.");
                        }
                        runLocalSignoutCleanup();
                    })
                    .catch(err => {
                        console.error("❌ Database connection error during logout execution:", err);
                        runLocalSignoutCleanup();
                    });
                return;
            }
        }
    } catch (e) {
        console.error("⚠️ Watchdog could not process local session token during logout cleanup:", e);
    }
    
    runLocalSignoutCleanup();
};

// Fire up the engine as soon as the window finishes loading up the workspace assets
window.addEventListener('DOMContentLoaded', startSessionWatchdog);
// 📡 REAL-TIME SUBSCRIPTION LISTENER FOR SYSTEM SETTINGS
// Global timer reference to manage live expiry countdowns
window.studentExpiryTimer = null;

// Function to handle live session expiration
window.handleSessionExpired = async function(studentNumber) {
    console.warn(`🔒 Session expired for student node: ${studentNumber}. Locking access...`);
    
    // Aligned fallback to K35.00 to match live database setting
    const formattedFee = window.currentSystemFee || "35.00";

    // 1. Immediately revert header badge UI to UNPAID
    const identityRack = document.querySelector('#terminal-identity-rack');
    if (identityRack) {
        identityRack.innerHTML = `
            <span class="px-3 py-1 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                Subscription Pending (K${formattedFee})
            </span>
        `;
    }

    // 2. Synchronize local storage & memory sessions to UNPAID
    if (window.currentUserSession) {
        window.currentUserSession.payment_status = 'UNPAID';
        window.currentUserSession.isSubscribed = false;
    }

    const sessionKey = "neural_link_active_session";
    const rawSession = sessionStorage.getItem(sessionKey) || localStorage.getItem("neural_link_session");
    if (rawSession) {
        try {
            const currentSession = JSON.parse(rawSession);
            currentSession.payment_status = 'UNPAID';
            currentSession.isSubscribed = false;
            sessionStorage.setItem(sessionKey, JSON.stringify(currentSession));
            localStorage.setItem("neural_link_session", JSON.stringify(currentSession));
        } catch (e) {
            console.warn("⚠️ Error updating session on expiry:", e);
        }
    }

    // 3. Lock UI & Bring back the payment overlay modal
    if (typeof window.openPaymentModal === 'function') {
        window.openPaymentModal(true);
    }

    // 4. Persist UNPAID status directly to Supabase DB
    try {
        await window.supabase
            .from('authorized_students_registry')
            .update({ payment_status: 'UNPAID' })
            .eq('student_number', studentNumber);
    } catch (err) {
        console.error("⚠️ Failed to update DB on expiry:", err);
    }
};

// Helper function to calculate remaining time and start the timer
window.startExpiryCountdown = function(studentData) {
    // Clear any previous scheduled countdown
    if (window.studentExpiryTimer) {
        clearTimeout(window.studentExpiryTimer);
        window.studentExpiryTimer = null;
    }

    if (!studentData || studentData.payment_status !== 'PAID' || !studentData.payment_expiry) {
        return;
    }

    const expiryMs = new Date(studentData.payment_expiry).getTime();
    const nowMs = Date.now();
    const timeRemainingMs = expiryMs - nowMs;

    console.log(`⏱️ Realtime Expiry Manager: ${Math.round(timeRemainingMs / 1000)} seconds remaining until access expiration.`);

    if (timeRemainingMs <= 0) {
        // Already expired! Trigger lock instantly
        window.handleSessionExpired(studentData.student_number);
    } else {
        // Schedule auto-expiry right when time runs out
        window.studentExpiryTimer = setTimeout(() => {
            window.handleSessionExpired(studentData.student_number);
        }, timeRemainingMs);
    }
};
window.subscribeToSystemSettingsChanges = function() {
    // 1. Prevent duplicate channel subscriptions and clean up active sockets
    if (window.systemSettingsChannel) {
        window.supabase.removeChannel(window.systemSettingsChannel);
    }

    // 2. Resolve Active Student Number for row-level real-time listener
    let activeStudentNumber = "23130155";
    try {
        const sessionData = sessionStorage.getItem("neural_link_active_session") || localStorage.getItem("neural_link_session");
        if (sessionData) {
            const parsedSession = JSON.parse(sessionData);
            if (parsedSession && (parsedSession.student_number || parsedSession.studentNumber)) {
                activeStudentNumber = parsedSession.student_number || parsedSession.studentNumber;
            }
        }
    } catch (e) {
        console.warn("⚠️ Failed to parse session storage for realtime filter:", e);
    }

    // 3. Create a single multiplexed Realtime Channel
    window.systemSettingsChannel = window.supabase
        .channel('public:realtime_app_sync')
        
        // A. System Fee updates
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'system_settings'
            },
            (payload) => {
                console.log('⚡ Realtime System Setting Change:', payload);
                const newRow = payload.new;

                if (newRow) {
                    const rawVal = newRow.value || newRow.maintenance_fee || newRow.fee || newRow.amount;
                    if (rawVal !== undefined) {
                        const formattedFee = isNaN(parseFloat(rawVal)) ? rawVal : parseFloat(rawVal).toFixed(2);
                        window.currentSystemFee = formattedFee;

                        const modalDisplay = document.getElementById('payment-amount-display');
                        if (modalDisplay) {
                            modalDisplay.textContent = formattedFee;
                        }

                        // 🎯 Update badge fee if currently unpaid
                        const currentStatus = window.currentUserSession?.payment_status || "UNPAID";
                        if (currentStatus.toUpperCase() === "UNPAID") {
                            window.updatePaymentBadgeUI('UNPAID', formattedFee);
                        }
                    }
                }
            }
        )
        
        // B. Student Registry Realtime Updates (Payment Status & Security PIN State)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'authorized_students_registry',
                filter: `student_number=eq.${activeStudentNumber}`
            },
            (payload) => {
                console.log('⚡ Realtime Student Registry State Change:', payload.new);
                const updatedStudent = payload.new;

                if (!updatedStudent) return;

                // B1: REALTIME SECURITY PIN / NODE SECURED SYNC
                if (updatedStudent.pin_required === false || updatedStudent.security_pin) {
                    if (window.currentUserSession) {
                        window.currentUserSession.pin_required = false;
                        window.currentUserSession.security_pin = updatedStudent.security_pin;
                    }

                    const sessionKey = "neural_link_active_session";
                    const rawSession = sessionStorage.getItem(sessionKey) || localStorage.getItem("neural_link_session");
                    if (rawSession) {
                        const currentSession = JSON.parse(rawSession);
                        currentSession.pin_required = false;
                        currentSession.security_pin = updatedStudent.security_pin;
                        sessionStorage.setItem(sessionKey, JSON.stringify(currentSession));
                        localStorage.setItem("neural_link_session", JSON.stringify(currentSession));
                    }

                    const triggerBtn = document.getElementById('header-pin-trigger');
                    if (triggerBtn) {
                        const securedBadge = document.createElement('div');
                        securedBadge.id = 'header-pin-secured';
                        securedBadge.className = 'flex items-center space-x-1.5 bg-slate-900/80 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider cursor-default shadow-sm select-none';
                        securedBadge.innerHTML = `
                            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>NODE SECURED</span>
                        `;
                        triggerBtn.replaceWith(securedBadge);
                    }
                }

                // B2: PAYMENT STATUS SYNC
                if (updatedStudent.payment_status) {
                    const status = updatedStudent.payment_status.toUpperCase();
                    window.updatePaymentBadgeUI(status);

                    if (status === 'PAID') {
                        const expiryMs = updatedStudent.payment_expiry ? new Date(updatedStudent.payment_expiry).getTime() : Infinity;
                        const isExpired = Date.now() >= expiryMs;

                        if (isExpired) {
                            if (typeof window.handleSessionExpired === 'function') {
                                window.handleSessionExpired(updatedStudent.student_number);
                            }
                        } else {
                            if (window.currentUserSession) {
                                window.currentUserSession.isSubscribed = true;
                            }

                            const sessionKey = "neural_link_active_session";
                            const rawSession = sessionStorage.getItem(sessionKey) || localStorage.getItem("neural_link_session");
                            if (rawSession) {
                                const currentSession = JSON.parse(rawSession);
                                currentSession.payment_status = 'PAID';
                                currentSession.isSubscribed = true;
                                sessionStorage.setItem(sessionKey, JSON.stringify(currentSession));
                                localStorage.setItem("neural_link_session", JSON.stringify(currentSession));
                            }

                            if (typeof window.showToast === 'function') {
                                window.showToast("PAYMENT VERIFIED", "Payment successfully processed! Registry access granted.", "success");
                            }

                            if (typeof window.openPaymentModal === 'function') {
                                window.openPaymentModal(false);
                            }

                            if (typeof window.startExpiryCountdown === 'function') {
                                window.startExpiryCountdown(updatedStudent);
                            }

                            if (typeof window.showDashboard === 'function') {
                                window.showDashboard();
                            }
                        }
                    }
                }
            }
        )

        // C. Billboard Slide updates
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'billboard_slides'
            },
            (payload) => {
                console.log('⚡ Realtime Billboard Slide Update:', payload);
                if (typeof window.initializeDashboardBillboard === 'function') {
                    window.initializeDashboardBillboard();
                }
            }
        )

        .subscribe((status) => {
            console.log('📡 Supabase Multi-Channel Realtime Status:', status);
        });
};
// 🎯 Global Payment Badge UI Synchronizer Helper
window.updatePaymentBadgeUI = function(status, fee) {
    const activeFee = fee || window.currentSystemFee || "35.00";
    const normalizedStatus = String(status || 'UNPAID').toUpperCase();

    // 1. Sync Memory and Storage State
    if (window.currentUserSession) {
        window.currentUserSession.payment_status = normalizedStatus;
    }
    try {
        const sessionKey = "neural_link_active_session";
        const rawSession = sessionStorage.getItem(sessionKey) || localStorage.getItem("neural_link_session");
        if (rawSession) {
            const parsed = JSON.parse(rawSession);
            parsed.payment_status = normalizedStatus;
            sessionStorage.setItem(sessionKey, JSON.stringify(parsed));
            localStorage.setItem("neural_link_session", JSON.stringify(parsed));
        }
    } catch (e) {
        console.warn("⚠️ Memory state sync warning:", e);
    }

    // 2. Locate Target Badge Element
    const badgeContainer = document.getElementById('payment-status-badge') || document.getElementById('terminal-identity-rack');
    if (!badgeContainer) return;

    // 3. Render Status Badge HTML
    if (normalizedStatus === 'PAID') {
        badgeContainer.innerHTML = `
            <span class="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg uppercase flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Subscribed
            </span>`;
    } else if (normalizedStatus === 'PROCESSING') {
        badgeContainer.innerHTML = `
            <span class="px-3 py-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg uppercase flex items-center gap-1.5 shadow-lg shadow-amber-950/40">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                Verifying Payment...
            </span>`;
    } else {
        badgeContainer.innerHTML = `
            <span class="px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg uppercase flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                Subscription Pending (K${activeFee})
            </span>`;
    }
};

window.showDashboard = async function() {
    // 🧠 DATA STORAGE INITIALIZATION
    const defaultSlides = [
        { imgUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1200", text: "Strive for excellence. The white coat is earned through dedication and discipline." },
        { imgUrl: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=1200", text: "Precision in practice. Every module you master brings you closer to saving lives." },
        { imgUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200", text: "Innovation meets healthcare. Welcome to the future of clinical data linking." },
        { imgUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?q=80&w=1200", text: "Your research today shapes the medical breakthroughs of tomorrow." },
        { imgUrl: "https://images.unsplash.com/photo-1584515901367-f1c57e5ef505?q=80&w=1200", text: "Stay focused, remain resilient. The medical core demands absolute consistency." }
    ];

    if (!localStorage.getItem('design_hub_slides')) {
        localStorage.setItem('design_hub_slides', JSON.stringify(defaultSlides));
    }

    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;
    
    viewport.className = "w-full h-full flex bg-[#050b18] relative pt-16 overflow-hidden";

    const isAdminHub = (window.currentUserSession && window.currentUserSession.accessMode === "ADMIN_HUB");

    if (isAdminHub && typeof showAdminWorkspace === 'function') {
        showAdminWorkspace();
        return; 
    }

    let displayFee = "35.00"; 
    try {
        const { data: configRows, error } = await window.supabase
            .from('system_settings')
            .select('key, value');
        
        if (error) throw error;

        if (configRows && configRows.length > 0) {
            const feeSetting = configRows.find(item => 
                item.key && (
                    item.key.includes('registry_mainte') || 
                    item.key.includes('maintenance_fee') || 
                    item.key.includes('fee')
                )
            );

            if (feeSetting && feeSetting.value) {
                displayFee = feeSetting.value;
            } else if (configRows[0].value) {
                displayFee = configRows[0].value;
            }
        }
    } catch (error) {
        console.warn("⚠️ System configuration matrix unreachable, falling back to local state baseline:", error);
    }

    const activeSessionRaw = sessionStorage.getItem('neural_link_active_session');
    const workingSession = activeSessionRaw ? JSON.parse(activeSessionRaw) : window.currentUserSession;

    const sessionRole = String(workingSession?.role || workingSession?.userRole || workingSession?.type || '').toUpperCase();
    const sessionAccess = String(workingSession?.accessMode || '').toUpperCase();
    const usernameStr = String(workingSession?.username || workingSession?.user || '').toUpperCase();
    const hasStudentNumber = Boolean(workingSession?.student_number || workingSession?.studentNumber);

    const isAdminUser = 
        sessionRole.includes("ADMIN") || 
        sessionAccess.includes("ADMIN") || 
        usernameStr.includes("ADMIN") ||
        workingSession?.isAdmin === true || 
        (!hasStudentNumber && sessionRole !== "STUDENT");

    let identityRackHTML = '';

    if (isAdminUser) {
        identityRackHTML = `
            <div class="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3.5 py-1.5 rounded-xl font-mono text-[10px] font-bold tracking-widest uppercase shadow-sm select-none">
                <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-blue-400"></i>
                <span>ADMIN ACCESS</span>
            </div>
        `;
    } else {
        const targetStudentNumber = workingSession?.student_number || workingSession?.studentNumber;
        if (targetStudentNumber && typeof window.initializePusherRealTime === 'function') {
            window.initializePusherRealTime(targetStudentNumber);
        }

        const paymentStatus = String(workingSession?.payment_status || 'UNPAID').toUpperCase();
        const needsPin = workingSession?.pin_required;

        identityRackHTML = `<div class="flex items-center space-x-3 font-mono text-[10px] font-bold tracking-wider">`;

        // 1. Subscription Status Badge Wrapper with dedicated ID
        identityRackHTML += `<div id="payment-status-badge">`;
        if (paymentStatus === "PAID") {
            identityRackHTML += `
                <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Subscribed</span>
                </span>
            `;
        } else if (paymentStatus === "PROCESSING") {
            identityRackHTML += `
                <span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1.5 shadow-lg shadow-amber-950/40">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    <span>Verifying Payment...</span>
                </span>
            `;
        } else {
            identityRackHTML += `
                <span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                    <span>Subscription Pending (K${displayFee})</span>
                </span>
            `;
        }
        identityRackHTML += `</div>`;

        // 2. High-Security PIN Status Component
        if (needsPin) {
            identityRackHTML += `
                <button id="header-pin-trigger" onclick="togglePinModal(true)" 
                    class="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-500 px-3 py-1.5 rounded-lg uppercase font-black tracking-widest transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-blue-950/40">
                    <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
                    <span>Set Security PIN</span>
                </button>
            `;
        } else {
            identityRackHTML += `
                <span class="bg-slate-800/40 text-slate-400 border border-slate-800/60 px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1.5">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Node Secured</span>
                </span>
            `;
        }

        identityRackHTML += `</div>`;
    }

    viewport.innerHTML = `
        <header class="fixed top-0 left-0 w-full flex justify-between items-center px-6 py-4 z-[9999] bg-[#050b18]/80 backdrop-blur-md border-b border-slate-800/40">
            <div class="flex items-center space-x-3">
                <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <i data-lucide="brain-circuit" class="text-white w-5 h-5"></i>
                </div>
                <h1 class="font-black text-white text-sm tracking-[0.2em] uppercase">Clinical Neural Link</h1>
            </div>

            <div id="terminal-identity-rack" class="flex items-center justify-center transition-all duration-300">
                ${identityRackHTML}
            </div>
            
            <button type="button" onclick="window.logout(event)" 
                class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase cursor-pointer">
                Log Out
            </button>
        </header>

        <aside id="sidebar-container" class="w-80 h-full border-r border-slate-800/60 bg-[#070e1e]/60 p-6 flex flex-col justify-between z-40">
            <div class="space-y-6">
                <div class="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">
                    Academic PROGRAMS
                </div>
                
                <nav class="flex flex-col space-y-2" id="program-nav">
                    <button onclick="selectProgram('mbchb')" class="w-full text-left bg-slate-800/30 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/30 p-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-between group cursor-pointer">
                        <span>MBCHB, BDS and CM</span>
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"></i>
                    </button>

                    <button onclick="selectProgram('biomedical')" class="w-full text-left bg-slate-800/30 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/30 p-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-between group cursor-pointer">
                        <span>Biomedical Science</span>
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"></i>
                    </button>

                    <button onclick="selectProgram('public_health')" class="w-full text-left bg-slate-800/30 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/30 p-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-between group cursor-pointer">
                        <span>Public Health</span>
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"></i>
                    </button>

                    <button onclick="selectProgram('environmental')" class="w-full text-left bg-slate-800/30 hover:bg-blue-600/10 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/30 p-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-between group cursor-pointer">
                        <span>Environmental Health</span>
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"></i>
                    </button>
                </nav>
            </div>

            <div id="sidebar-profile" class="border-t border-slate-800/60 pt-4 text-[10px] text-slate-500 uppercase font-black tracking-wider">
                System Initialized
            </div>
        </aside>

        <main id="dashboard-content" class="flex-1 h-full p-8 overflow-y-auto bg-[#050b18]">
            <div class="w-full max-w-5xl mx-auto space-y-8">
                
                <div id="student-billboard" class="relative w-full h-[460px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-end p-10 sm:p-12 bg-cover bg-center transition-all duration-1000 ease-in-out shadow-2xl shadow-blue-950/20">
                    <div class="absolute inset-0 bg-gradient-to-t from-[#050b18] via-[#050b18]/60 to-transparent pointer-events-none z-10"></div>
                    
                    <div class="relative z-20 max-w-3xl transition-all duration-300" id="billboard-text-wrapper">
                        <span class="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] block mb-3 animate-pulse">Current Terminal Directive</span>
                        <h2 id="student-billboard-text" class="text-xl sm:text-3xl font-black text-white uppercase tracking-wide leading-relaxed drop-shadow-lg transition-opacity duration-300">
                            Loading node arrays...
                        </h2>
                    </div>
                </div>

                <div class="p-6 rounded-xl bg-[#070e1e]/40 border border-slate-800/40 flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-lg bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-400">
                        <i data-lucide="terminal" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">System Operational</p>
                        <p class="text-slate-500 text-[11px] mt-0.5">Select an academic program execution stack from the left terminal control unit.</p>
                    </div>
                </div>

            </div>
        </main>

        <!-- PIN CONFIGURATION INTERFACE COMPONENT -->
        <div id="pin-modal-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] hidden flex items-center justify-center p-4">
            <div class="bg-[#070e1e] border border-slate-800 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
                <div>
                    <h3 class="text-white font-black text-xs uppercase tracking-widest">Setup Access Security Node</h3>
                    <p class="text-slate-400 text-[11px] mt-1">Configure your permanent 4-digit token configuration parameter.</p>
                </div>
                <form onsubmit="submitSecurityPinToken(event)" class="space-y-3">
                    <input type="password" id="modal-pin-input" inputmode="numeric" maxlength="4" pattern="\\d{4}" required placeholder="ENTER 4-DIGIT PIN" 
                        class="w-full bg-slate-950/60 border border-slate-800 text-white rounded-xl p-3 text-center text-sm font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 text-slate-300">
                    <input type="password" id="modal-pin-confirm" inputmode="numeric" maxlength="4" pattern="\\d{4}" required placeholder="CONFIRM 4-DIGIT PIN" 
                        class="w-full bg-slate-950/60 border border-slate-800 text-white rounded-xl p-3 text-center text-sm font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 text-slate-300">
                    <div class="flex space-x-2 pt-2">
                        <button type="button" onclick="togglePinModal(false)" class="w-1/2 bg-slate-800/40 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer">Cancel</button>
                        <button type="submit" class="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all shadow-lg shadow-blue-900/20 cursor-pointer">Save Pin</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- INTEGRATED MTN MOMO PAYMENT OVERLAY INTERFACE -->
        <div id="payment-modal-overlay" class="fixed inset-0 bg-black/70 backdrop-blur-md z-[99999] hidden flex items-center justify-center p-4">
            <form onsubmit="return false;" class="bg-[#070e1e] border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl shadow-amber-950/10">
                <div class="flex items-start justify-between border-b border-slate-800/60 pb-3">
                    <div class="space-y-1">
                        <span class="text-[9px] font-black text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded uppercase tracking-widest px-1.5 py-0.5">
                            Access Restricted
                        </span>
                        <h3 class="text-white font-black text-sm uppercase tracking-wider mt-2">System Maintenance Contribution</h3>
                        <p class="text-slate-400 text-[11px]">Unlock your premium academic registry modules by settling the mandatory node fee.</p>
                    </div>
                </div>

                <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between font-mono">
                    <div>
                        <p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Required Contribution</p>
                        <p class="text-white text-lg font-black tracking-wide mt-0.5">
                            K<span id="payment-amount-display">65.00</span>
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Gateway Status</p>
                        <span class="text-emerald-400 text-[10px] uppercase font-bold flex items-center justify-end space-x-1 mt-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span> MTN MoMo Direct
                        </span>
                    </div>
                </div>

                <div class="space-y-3 pt-1">
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                            Mobile Wallet Provider
                        </label>
                        <input type="hidden" name="momo_provider" value="MTN_MOMO" />
                        
                        <div class="bg-amber-600/10 border border-amber-500/30 rounded-xl py-2.5 px-4 flex items-center justify-between">
                            <span class="text-amber-400 font-black text-xs tracking-wider flex items-center">
                                <span class="w-2 h-2 rounded-full bg-amber-400 mr-2"></span> MTN MOBILE MONEY
                            </span>
                            <span class="text-[9px] text-amber-300/60 uppercase font-mono">Direct Push</span>
                        </div>
                    </div>

                    <div>
                        <label for="momo-phone-number" class="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                            MTN Mobile Phone Number
                        </label>
                        <div class="relative">
                            <input type="tel" id="momo-phone-number" placeholder="096XXXXXXX or 076XXXXXXX"
                                class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs placeholder:text-slate-600 outline-none transition-all" />
                        </div>
                    </div>
                </div>

                <div class="space-y-2 pt-2">
                    <button id="pay-now-btn" type="button" onclick="window.initiateSparcoPayment(event)" 
                        class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center justify-center space-x-2">
                        <i data-lucide="smartphone" class="w-4 h-4"></i>
                        <span id="pay-btn-label">Initiate Mobile Money Prompt</span>
                    </button>
                    
                    <button type="button" onclick="window.openPaymentModal(false)" 
                        class="w-full bg-slate-800/40 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white py-2.5 rounded-xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer">
                        Return to Node Dashboard
                    </button>
                </div>
            </form>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    initializeDashboardBillboard();

    if (typeof window.subscribeToSystemSettingsChanges === 'function') {
        window.subscribeToSystemSettingsChanges();
    }
};

// Initialize single listener
window.subscribeToSystemSettingsChanges();

window.currentSystemFee = "50.00"; 

// 📡 Fetch the dynamic fee properly from Supabase Key-Value table
async function synchronizeSystemConfig() {
    try {
        const { data: configRows, error } = await window.supabase
            .from('system_settings')
            .select('key, value');
        
        if (error) throw error;
        
        if (configRows && configRows.length > 0) {
            // Find key-value row matching maintenance fee
            const feeSetting = configRows.find(item => 
                item.key && (
                    item.key.includes('registry_mainte') || 
                    item.key.includes('maintenance_fee') || 
                    item.key.includes('fee')
                )
            );

            if (feeSetting && feeSetting.value) {
                window.currentSystemFee = feeSetting.value;
            } else if (configRows[0].value) {
                window.currentSystemFee = configRows[0].value;
            }

            console.log("🌱 System fee synchronized from database: K" + window.currentSystemFee);
            
            // Sync with active UI immediately if visible
            const amountDisplay = document.getElementById('payment-amount-display');
            if (amountDisplay) {
                amountDisplay.textContent = parseFloat(window.currentSystemFee).toFixed(2);
            }
        }
    } catch (error) {
        console.error("⚠️ Failed to sync fee from backend, using fallback layout:", error);
    }
}

// Execute initial sync immediately
synchronizeSystemConfig();

// 🔓 Updated Payment Modal Controller — ALWAYS reads the latest window.currentSystemFee
window.openPaymentModal = function(show = true) {
    const modal = document.getElementById('payment-modal-overlay');
    if (!modal) return;
    
    if (show) {
        const amountDisplay = document.getElementById('payment-amount-display');
        if (amountDisplay) {
            // Read directly from live global variable!
            const liveFee = window.currentSystemFee || "65.00";
            amountDisplay.textContent = parseFloat(liveFee).toFixed(2);
        }
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
};

window.initiateSparcoPayment = async function(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    const phoneInput = document.getElementById('momo-phone-number');
    const payBtn = document.getElementById('pay-now-btn');
    const payBtnLabel = document.getElementById('pay-btn-label');
    const selectedProviderNode = document.querySelector('input[name="momo_provider"]:checked');

    if (!phoneInput) return;

    const rawPhone = phoneInput.value.trim();
    const provider = selectedProviderNode ? selectedProviderNode.value : 'MTN_MOMO';

    const cleanPhone = rawPhone.replace(/\s+/g, '');
    if (!/^(097|077|096|076|095|075)\d{7}$/.test(cleanPhone)) {
        if (typeof window.showToast === 'function') {
            window.showToast("INVALID PHONE", "Please enter a valid Zambian mobile money number (e.g., 0971234567).", "warning");
        } else {
            alert("Please enter a valid Zambian mobile money number (e.g., 0971234567).");
        }
        return;
    }

    let activeStudentNumber = "23130155";
    try {
        const sessionData = sessionStorage.getItem("neural_link_active_session") || localStorage.getItem("neural_link_session");
        if (sessionData) {
            const parsedSession = JSON.parse(sessionData);
            if (parsedSession && (parsedSession.student_number || parsedSession.studentNumber)) {
                activeStudentNumber = parsedSession.student_number || parsedSession.studentNumber;
            }
        }
    } catch (err) {
        console.warn("⚠️ Failed to parse session storage:", err);
    }

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (payBtnLabel) {
        payBtnLabel.innerText = "Dispatching Payment Prompt...";
    }

    const currentAmount = parseFloat(window.currentSystemFee || "35.00");

    try {
        console.log(`📡 Requesting MoMo push for Student: ${activeStudentNumber}`);

        // 🎯 1. Update local UI memory & DOM to 'PROCESSING' immediately!
        window.updatePaymentBadgeUI('PROCESSING');

        // 2. Update status to 'PROCESSING' in Supabase database
        await window.supabase
            .from('authorized_students_registry')
            .update({ payment_status: 'PROCESSING' })
            .eq('student_number', activeStudentNumber);

        // 3. Close the modal overlay so user can see dashboard status
        if (typeof window.openPaymentModal === 'function') {
            window.openPaymentModal(false);
        }

        // 4. Invoke deployed momo-pay Edge Function
        const { data: edgeData, error: edgeError } = await window.supabase.functions.invoke('momo-pay', {
            body: {
                studentNumber: activeStudentNumber,
                phoneNumber: cleanPhone,
                amount: currentAmount,
                provider: provider
            }
        });

        if (edgeError) throw edgeError;
        if (edgeData && !edgeData.success) throw new Error(edgeData.error || "Failed to trigger USSD prompt.");

        if (typeof window.showToast === 'function') {
            window.showToast(
                "USSD PUSH SENT", 
                "Check your phone and enter your PIN. Realtime listener will auto-unlock upon verification.", 
                "info"
            );
        }

    } catch (err) {
        console.error("❌ Direct Supabase Payment Execution Failed:", err);

        // Roll back local memory and backend database status to UNPAID
        window.updatePaymentBadgeUI('UNPAID');

        await window.supabase
            .from('authorized_students_registry')
            .update({ payment_status: 'UNPAID' })
            .eq('student_number', activeStudentNumber);

        if (typeof window.showToast === 'function') {
            window.showToast("PAYMENT ERROR", err.message || "Failed to initiate payment.", "error");
        } else {
            alert("PAYMENT ERROR: " + (err.message || "Failed to initiate payment."));
        }
    } finally {
        if (payBtn) {
            payBtn.disabled = false;
            payBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (payBtnLabel) {
            payBtnLabel.innerText = "Initiate Mobile Money Prompt";
        }
    }
};

/**
 * Toggles the visibility of the Security PIN Modal.
 * @param {boolean} [show] - Optional boolean to explicitly force show (true) or hide (false).
 */
function togglePinModal(show) {
    const modal = document.getElementById('pin-modal-overlay');
    if (!modal) {
        console.warn("⚠️ Pin modal overlay element ('pin-modal-overlay') not found in DOM.");
        return;
    }

    // Determine target visibility state
    const shouldShow = (typeof show === 'boolean') ? show : modal.classList.contains('hidden');

    if (shouldShow) {
        modal.classList.remove('hidden');
        
        // Focus on the first input field automatically
        const pinInput = document.getElementById('modal-pin-input');
        if (pinInput) {
            setTimeout(() => pinInput.focus(), 50);
        }
    } else {
        modal.classList.add('hidden');
        
        // Clear input values when closing
        const pinInput = document.getElementById('modal-pin-input');
        const confirmInput = document.getElementById('modal-pin-confirm');
        if (pinInput) pinInput.value = '';
        if (confirmInput) confirmInput.value = '';
    }
}

// Attach explicitly to window scope so inline HTML onclick="togglePinModal(...)" finds it
window.togglePinModal = togglePinModal;
// Sends the completed token securely into the FastAPI auth engine endpoint mapping
async function submitSecurityPinToken(event) {
    event.preventDefault();
    
    const pin = document.getElementById('modal-pin-input').value;
    const confirmPin = document.getElementById('modal-pin-confirm').value;

    // Validation Check
    if (pin !== confirmPin) {
        showNotification({
            title: "Security PIN Mismatch",
            message: "The entered PINs do not match. Please verify and re-enter your 4-digit PIN.",
            type: "warning"
        });
        return;
    }

    try {
        const studentNumber = window.currentUserSession?.studentNumber || 
                              window.currentUserSession?.student_number;

        if (!studentNumber) {
            throw new Error("Active session identifier not found. Please log in again.");
        }

        // Perform direct update query via Supabase
        const { error } = await window.supabase
            .from('authorized_students_registry')
            .update({ 
                security_pin: pin,
                pin_required: false 
            })
            .eq('student_number', studentNumber);

        if (error) throw error;

        // Update local session state
        if (window.currentUserSession) {
            window.currentUserSession.pin_required = false;
        }
        
        // Remove pin setup trigger button from header if present
        const triggerBtn = document.getElementById('header-pin-trigger');
        if (triggerBtn) triggerBtn.remove();
        
        // Close modal and display professional success message
        togglePinModal(false);

        showNotification({
            title: "Security PIN Configured",
            message: "Your 4-digit access PIN has been successfully registered to your account.",
            type: "success"
        });
        
    } catch (error) {
        console.error("Security PIN Configuration Error:", error);
        
        showNotification({
            title: "Update Failed",
            message: error.message || "Unable to save security settings. Please verify server connection.",
            type: "error"
        });
    }
}
/**
 * Renders a professional dark-themed toast notification matching the portal UI.
 */
function showNotification({ title, message, type = 'info' }) {
    // Check for existing container or create one
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[999999] flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4';
        document.body.appendChild(container);
    }

    const badgeStyles = {
        success: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-950/80 text-amber-300',
        error:   'border-rose-500/30 bg-rose-950/80 text-rose-300',
        info:    'border-blue-500/30 bg-blue-950/80 text-blue-300'
    };

    const iconMap = {
        success: '✓',
        warning: '⚠️',
        error:   '✕',
        info:    'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto border backdrop-blur-md rounded-xl p-4 shadow-2xl flex items-start space-x-3 transition-all duration-300 ease-out transform translate-y-2 opacity-0 ${badgeStyles[type] || badgeStyles.info}`;
    
    toast.innerHTML = `
        <div class="text-sm font-bold pt-0.5">${iconMap[type] || 'ℹ'}</div>
        <div class="flex-1">
            <h4 class="text-xs font-black uppercase tracking-wider text-white">${title}</h4>
            <p class="text-[11px] text-slate-300 mt-0.5 leading-relaxed">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.showNotification = showNotification;

// 🛡️ ENFORCED SESSION WATCHDOG - PREVENTS ACCOUNT SHARING
// 🛡️ ENFORCED CLEAN WORKSPACE WATCHDOG


function startSessionWatchdog() {
    const checkIntervalTime = 5000; // Evaluates tracking context loops every 5 seconds

    window.watchdogInterval = setInterval(async () => {
        // 🎯 FIX: Pulling from sessionStorage to align with your authentication flow
        const sessionData = sessionStorage.getItem('neural_link_active_session');
        const localFingerprint = localStorage.getItem('neural_link_device_fingerprint');
        if (!sessionData || !localFingerprint) return;

        const sessionUser = JSON.parse(sessionData);
        const currentRole = sessionUser.role || sessionUser.accessMode || "";
        if (currentRole.toUpperCase() !== "STUDENT") return;

        const studentNum = sessionUser.student_number || sessionUser.studentNumber;
        if (!studentNum) return;

        try {
            // 🎯 FIX: Changed table from 'active_sessions' to 'portal_active_sessions_ledger'
            const { data: currentServerSession, error } = await window.supabase
                .from('portal_active_sessions_ledger')
                .select('*')
                .ilike('student_number', studentNum.trim())
                .maybeSingle(); 

            if (error) throw error;

            const serverFingerprint = currentServerSession ? currentServerSession.device_fingerprint : null;

            console.log(`📡 Watchdog Patrolling -> Local Context: ${localFingerprint} | Active Backend Lease Holder: ${serverFingerprint}`);

            // 🚨 CONFLICT HARD DETECTION HANDSHAKE:
            if (!currentServerSession || serverFingerprint !== localFingerprint) {
                console.warn("🛑 Session Mismatch or Eviction. Initiating formal eviction sequence...");
                
                clearInterval(window.watchdogInterval);
                
                // Clear local tracking data
                sessionStorage.removeItem('neural_link_active_session');
                window.currentUserSession = null;

                // Execute the presentation-ready UI intercept
                if (typeof window.showSecurityEvictionModal === 'function') {
                    window.showSecurityEvictionModal();
                } else {
                    alert("Clinical Neural Link Identity Notice:\nYour active terminal session has been terminated.");
                    window.location.reload(); 
                }
            }
        } catch (error) {
            console.error("❌ Watchdog fingerprint heartbeat communication error:", error);
        }
    }, checkIntervalTime);
}

// Ensure the watchdog loop attaches automatically on DOM loading cycles
document.addEventListener("DOMContentLoaded", () => {
    startSessionWatchdog();
});

window.showSecurityEvictionModal = function() {
    const overlay = document.createElement('div');
    overlay.id = "security-eviction-overlay";
    overlay.className = "fixed inset-0 w-screen h-screen bg-[#0a0e17]/85 backdrop-blur-md flex items-center justify-center font-sans z-[999999]";

    overlay.innerHTML = `
        <div class="relative z-[1000000] bg-gradient-to-br from-[#161c2a] to-[#0e121b] border border-red-500/30 shadow-2xl rounded-xl p-8 max-w-md w-[90%] text-center text-gray-100 pointer-events-auto">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500 text-3xl">🛡️</div>
            <h3 class="m-0 mb-3 text-xl font-semibold tracking-tight">Security Session Intercept</h3>
            <p class="m-0 mb-1 text-xs uppercase text-gray-400 tracking-wider font-medium">Clinical Neural Link Management System</p>
            <hr class="border-0 border-t border-white/10 my-4">
            <p class="m-0 mb-6 text-sm leading-relaxed text-gray-300 text-left">
                This system terminal has been securely disconnected. The central identity engine detected that this student account successfully established an active session on an alternative hardware profile or secondary browser node.
            </p>
            <button type="button" 
                onclick="document.getElementById('security-eviction-overlay').remove(); if(typeof window.renderLogin === 'function') { window.renderLogin(); }" 
                class="relative z-[1000001] bg-gradient-to-r from-red-500 to-red-600 text-white border-none py-3 px-7 text-sm font-semibold rounded-md cursor-pointer w-full transition duration-200 shadow-lg shadow-red-500/20 hover:opacity-90 pointer-events-auto">
                Return to Security Gate
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
};
// 📡 Global Pusher Linker
window.initializePusherRealTime = function(studentNumber) {
    if (!studentNumber) return;
    
    // Verify that the global Supabase client instance is available
    if (!window.supabase) {
        console.error("❌ Supabase client matrix is missing! Cannot establish real-time channel pipeline.");
        return;
    }
    
    // Safety check to ensure we don't spin up duplicate channel subscriptions on the same window lifecycle
    if (window.currentPusherInstance) {
        console.log("📡 Supabase Realtime instance already linked. Skipping duplicate subscription.");
        return;
    }

    console.log(`📡 Linking real-time database listener node for student: ${studentNumber}`);
    
    // Set up a native Supabase Realtime channel listening to table row updates directly
    const channel = window.supabase
        .channel(`student-updates-${studentNumber}`) // 🟩 Fixed: Clean, brief channel path string
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'authorized_students_registry', // 🟩 Fixed: Pointed to your real database table name
                filter: `student_number=eq.${studentNumber}`
            },
            (payload) => {
                const freshData = payload.new;
                console.log("⚡ [Supabase Realtime Event Received]: Status shifted to:", freshData.payment_status);
                
                // 1. Sync cache structures with the fresh database row properties
                if (window.currentUserSession) {
                    window.currentUserSession.payment_status = freshData.payment_status;
                    window.currentUserSession.payment_expiry = freshData.payment_expiry;
                }
                
                const sessionData = sessionStorage.getItem('neural_link_active_session');
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    parsed.payment_status = freshData.payment_status;
                    parsed.payment_expiry = freshData.payment_expiry;
                    sessionStorage.setItem('neural_link_active_session', JSON.stringify(parsed));
                }

                // 2. Clear out the payment overlay instantly
                if (typeof window.openPaymentModal === 'function') {
                    window.openPaymentModal(false);
                }
                
                // 3. Re-render the dashboard components instantly to unlock restricted modules
                if (typeof showDashboard === 'function') {
                    showDashboard();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`🟩 Supabase Realtime matrix synchronized for student channel: ${studentNumber}`);
            }
        });

    // Cache the channel handle globally to match your existing validation checks and prevent resource leaks
    window.currentPusherInstance = channel;
};
// Ensure the watchdog loop attaches automatically on DOM loading cycles
document.addEventListener("DOMContentLoaded", () => {
    startSessionWatchdog();
});

window.showSecurityEvictionModal = function() {
    const overlay = document.createElement('div');
    overlay.id = "security-eviction-overlay";
    overlay.className = "fixed inset-0 w-screen h-screen bg-[#0a0e17]/85 backdrop-blur-md flex items-center justify-center font-sans z-[999999]";

    overlay.innerHTML = `
        <div class="relative z-[1000000] bg-gradient-to-br from-[#161c2a] to-[#0e121b] border border-red-500/30 shadow-2xl rounded-xl p-8 max-w-md w-[90%] text-center text-gray-100 pointer-events-auto">
            <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500 text-3xl">🛡️</div>
            <h3 class="m-0 mb-3 text-xl font-semibold tracking-tight">Security Session Intercept</h3>
            <p class="m-0 mb-1 text-xs uppercase text-gray-400 tracking-wider font-medium">Clinical Neural Link Management System</p>
            <hr class="border-0 border-t border-white/10 my-4">
            <p class="m-0 mb-6 text-sm leading-relaxed text-gray-300 text-left">
                This system terminal has been securely disconnected. The central identity engine detected that this student account successfully established an active session on an alternative hardware profile or secondary browser node.
            </p>
            <button type="button" 
                onclick="document.getElementById('security-eviction-overlay').remove(); if(typeof window.renderLogin === 'function') { window.renderLogin(); }" 
                class="relative z-[1000001] bg-gradient-to-r from-red-500 to-red-600 text-white border-none py-3 px-7 text-sm font-semibold rounded-md cursor-pointer w-full transition duration-200 shadow-lg shadow-red-500/20 hover:opacity-90 pointer-events-auto">
                Return to Security Gate
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
};
// 📡 Global Pusher Linker
window.initializePusherRealTime = function(studentNumber) {
    if (!studentNumber) return;
    
    // Verify that the global Supabase client instance is available
    if (!window.supabase) {
        console.error("❌ Supabase client matrix is missing! Cannot establish real-time channel pipeline.");
        return;
    }
    
    // Safety check to ensure we don't spin up duplicate channel subscriptions on the same window lifecycle
    if (window.currentPusherInstance) {
        console.log("📡 Supabase Realtime instance already linked. Skipping duplicate subscription.");
        return;
    }

    console.log(`📡 Linking real-time database listener node for student: ${studentNumber}`);
    
    // Set up a native Supabase Realtime channel listening to table row updates directly
    const channel = window.supabase
        .channel(`student-updates-${studentNumber}`) // 🟩 Fixed: Clean, brief channel path string
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'authorized_students_registry', // 🟩 Fixed: Pointed to your real database table name
                filter: `student_number=eq.${studentNumber}`
            },
            (payload) => {
                const freshData = payload.new;
                console.log("⚡ [Supabase Realtime Event Received]: Status shifted to:", freshData.payment_status);
                
                // 1. Sync cache structures with the fresh database row properties
                if (window.currentUserSession) {
                    window.currentUserSession.payment_status = freshData.payment_status;
                    window.currentUserSession.payment_expiry = freshData.payment_expiry;
                }
                
                const sessionData = sessionStorage.getItem('neural_link_active_session');
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    parsed.payment_status = freshData.payment_status;
                    parsed.payment_expiry = freshData.payment_expiry;
                    sessionStorage.setItem('neural_link_active_session', JSON.stringify(parsed));
                }

                // 2. Clear out the payment overlay instantly
                if (typeof window.openPaymentModal === 'function') {
                    window.openPaymentModal(false);
                }
                
                // 3. Re-render the dashboard components instantly to unlock restricted modules
                if (typeof showDashboard === 'function') {
                    showDashboard();
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`🟩 Supabase Realtime matrix synchronized for student channel: ${studentNumber}`);
            }
        });

    // Cache the channel handle globally to match your existing validation checks and prevent resource leaks
    window.currentPusherInstance = channel;
};

// =========================================================================
// 🚀 BILLBOARD CAROUSEL ROTATION ENGINE
// =========================================================================
async function initializeDashboardBillboard() {
    const billboard = document.getElementById('student-billboard');
    const label = document.getElementById('student-billboard-text');
    const wrapper = document.getElementById('billboard-text-wrapper');
    
    if (!billboard || !label || !wrapper) return;

    let slides = [];

    // 1. Fetch slides from Supabase
    async function fetchSlidesFromDatabase() {
        try {
            const { data, error } = await supabase
                .from('billboard_slides')
                .select('*')
                .order('slot_id', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                // Map database columns to rotation structure
                slides = data.map(slide => ({
                    imgUrl: slide.image_url,
                    text: slide.motivational_text
                }));
                // Backup to localStorage for quick fallback
                localStorage.setItem('design_hub_slides', JSON.stringify(slides));
            }
        } catch (e) {
            console.warn("⚠️ Failed to load billboard slides from Supabase, checking local backup...", e);
            const storedSlides = localStorage.getItem('design_hub_slides');
            try {
                slides = storedSlides ? JSON.parse(storedSlides) : [];
            } catch (err) {
                slides = [];
            }
        }
    }

    await fetchSlidesFromDatabase();

    if (slides.length === 0) return;

    let currentIndex = 0;

    function rotate() {
        if (slides.length === 0) return;
        const activeNode = slides[currentIndex];
        wrapper.classList.add('opacity-0');
        
        setTimeout(() => {
            billboard.style.backgroundImage = `url('${activeNode.imgUrl}')`;
            label.textContent = activeNode.text;
            wrapper.classList.remove('opacity-0');
        }, 300);

        currentIndex = (currentIndex + 1) % slides.length;
    }

    rotate();
    
    if (window.billboardInterval) clearInterval(window.billboardInterval);
    // ⏱️ 10-Second Switchboard Timer loop setup
    window.billboardInterval = setInterval(rotate, 10000);

    // 2. Realtime Subscription: Update billboard on live admin changes
    if (!window.billboardRealtimeChannel) {
        window.billboardRealtimeChannel = supabase
            .channel('billboard-realtime-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'billboard_slides' },
                async () => {
                    console.log("⚡ Billboard update detected via Supabase Realtime! Re-synchronizing...");
                    await fetchSlidesFromDatabase();
                }
            )
            .subscribe();
    }
}

// =========================================================================
// ⚙️ ADMIN WORKSPACE CONTROL ROOM
// =========================================================================
function showAdminWorkspace() {
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    viewport.className = "w-full h-full flex bg-[#050b18] relative pt-16 overflow-hidden";

    viewport.innerHTML = `
        <header class="fixed top-0 left-0 w-full flex justify-between items-center px-6 py-4 z-[9999] bg-[#050b18]/80 backdrop-blur-md border-b border-slate-800/40">
            <div class="flex items-center space-x-3">
                <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <i data-lucide="brain-circuit" class="text-white w-5 h-5"></i>
                </div>
                <h1 class="font-black text-white text-sm tracking-[0.2em] uppercase">Clinical Neural Link</h1>
            </div>

            <div id="header-center" class="absolute left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.2em] text-blue-500 uppercase">
                ⚙️ Admin Control Room Terminal
            </div>
            
            <button type="button" onclick="event.preventDefault(); window.logout()" 
        class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase cursor-pointer">
    Log Out
</button>
        </header>

        <aside id="sidebar-container" class="w-80 h-full border-r border-slate-800/60 bg-[#070e1e]/60 p-6 flex flex-col justify-between z-40">
            <div class="space-y-6 w-full">
                <div class="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4 px-2">
                    Admin Utilities
                </div>
                
                <nav class="flex flex-col space-y-1 w-full">
                    <button onclick="switchAdminWorkspace('notes')" id="admin-nav-notes"
                        class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 cursor-pointer">
                        <i data-lucide="file-text" class="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors"></i>
                        <span class="text-xs font-black uppercase tracking-wider">Create Course Notes</span>
                    </button>

                    <button onclick="switchAdminWorkspace('quizzes')" id="admin-nav-quizzes"
                        class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 cursor-pointer">
                        <i data-lucide="help-circle" class="w-4 h-4 text-slate-500 group-hover:text-amber-500 transition-colors"></i>
                        <span class="text-xs font-black uppercase tracking-wider">Create Quiz Mode</span>
                    </button>

                    <button onclick="if(typeof window.renderPortalControlSystemView === 'function'){ window.renderPortalControlSystemView(); }" id="admin-nav-security"
                        class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-purple-400 hover:bg-purple-950/10 border border-transparent hover:border-purple-500/10 cursor-pointer">
                        <i data-lucide="sliders" class="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors"></i>
                        <span class="text-xs font-black uppercase tracking-wider">Portal Control System</span>
                    </button>

                    <button onclick="switchAdminWorkspace('design_hub')" id="admin-nav-design-hub"
                        class="w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/10 border border-transparent hover:border-emerald-500/10 cursor-pointer">
                        <i data-lucide="palette" class="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors"></i>
                        <span class="text-xs font-black uppercase tracking-wider">Design Hub</span>
                    </button>
                </nav>

                <div class="mt-6 p-4 bg-slate-900/40 rounded-xl border border-slate-800/60 mx-2">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Terminal Status</span>
                    <p class="text-[10px] text-slate-400 leading-relaxed normal-case">Select a utility deck above to initialize database injection workflows.</p>
                </div>
            </div>
            
            <div class="border-t border-slate-800/60 pt-4 text-[10px] text-slate-600 uppercase font-black tracking-wider w-full">
                Terminal Status: Active
            </div>
        </aside>

        <main id="dashboard-content" class="flex-1 h-full flex items-center justify-center p-8 overflow-y-auto">
            <div class="text-center space-y-4 max-w-sm">
                <div class="w-16 h-16 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-center text-blue-500 mx-auto shadow-xl">
                    <i data-lucide="terminal" class="w-6 h-6"></i>
                </div>
                <div>
                    <h3 class="text-md font-black text-white uppercase tracking-wider">Admin Control Center</h3>
                    <p class="text-[9px] text-slate-500 uppercase tracking-widest font-mono mt-1">Authorized Access Only — Canvas Empty</p>
                </div>
            </div>
        </main>
    `;

    if (window.lucide) lucide.createIcons();
}
function exitAdminHub() {
    console.log("=== 🚀 LEAVING ADMIN TERMINAL (NATIVE CSS STATE) ===");
    
    const studentSidebar = document.getElementById('student-sidebar');
    const adminSidebar = document.getElementById('admin-sidebar');

    // 1. Force structural swap right back to student defaults
    if (studentSidebar && adminSidebar) {
        adminSidebar.style.display = 'none';
        studentSidebar.style.display = 'flex';
        console.log("👉 Native layout view state cleanly restored.");
    }

    // 2. Restore Top Header Center Default Action Button state
    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    const isAdmin = (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN');
    const headerCenter = document.getElementById('header-center');
    
    if (headerCenter) {
        if (isAdmin) {
            headerCenter.innerHTML = `
                <button id="admin-hub-btn" onclick="showAdminHub()" 
                    class="bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase cursor-pointer">
                    Admin Hub
                </button>
            `;
        } else {
            headerCenter.innerHTML = '';
        }
    }

    // 3. Reset workspace center canvas block back to standard student standby view
    const contentArea = document.getElementById('dashboard-content');
    if (contentArea) {
        contentArea.className = "flex-1 h-full flex items-center justify-center p-8 overflow-y-auto";
        contentArea.innerHTML = `
            <div class="text-center">
                <p class="text-[10px] text-slate-600 uppercase font-black tracking-[0.6em] animate-pulse mb-2">System Active</p>
                <p class="text-slate-500 text-[11px]">Select an academic program from the left terminal to initialize</p>
            </div>
        `;
    }

    if (window.lucide) lucide.createIcons();
}

window.showDashboard = showDashboard;
window.exitAdminHub = exitAdminHub;


function switchAdminWorkspace(mode) {
    console.log("Switching admin terminal deck to:", mode);
    
    const btnNotes = document.getElementById('admin-nav-notes');
    const btnQuizzes = document.getElementById('admin-nav-quizzes');
    const btnDesignHub = document.getElementById('admin-nav-design-hub'); // Track new button element
    
    if(btnNotes) btnNotes.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-slate-200 hover:bg-slate-900/40";
    if(btnQuizzes) btnQuizzes.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-slate-200 hover:bg-slate-900/40";
    if(btnDesignHub) btnDesignHub.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl border border-transparent text-left transition-all duration-200 group text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/10 border border-transparent hover:border-emerald-500/10";

    if (mode === 'notes' && btnNotes) {
        btnNotes.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-left font-black tracking-wide";
    } else if (mode === 'quizzes' && btnQuizzes) {
        btnQuizzes.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-left font-black tracking-wide";
    } else if (mode === 'design_hub' && btnDesignHub) {
        // Highlighting Design Hub in pristine Emerald theme when active
        btnDesignHub.className = "w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-left font-black tracking-wide";
    }

    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;
    
    contentArea.className = "flex-1 h-full p-8 overflow-y-auto bg-[#050b18]";

    if (mode === 'notes') {
        contentArea.innerHTML = `
            <div class="w-full max-w-6xl mx-auto flex flex-col space-y-6 animate-in fade-in duration-200 pb-12">
                <div class="border-b border-slate-800/60 pb-4">
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">Course Notes Repository Hub</h2>
                    <p class="text-[10px] text-purple-500 font-bold uppercase tracking-widest mt-1">Publish PDF handouts directly to student terminal slots</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="space-y-4 bg-slate-900/20 border border-slate-800/80 p-6 rounded-2xl h-fit">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center space-x-2">
                            <i data-lucide="git-branch" class="w-3.5 h-3.5 text-purple-500"></i>
                            <span>Target Path Router</span>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col space-y-1.5">
                                <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Program</label>
                                <select id="note-program" onchange="updateAdminNotesDropdowns(this.id)" class="w-full bg-[#070e1e] border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-bold focus:border-purple-500/50 focus:outline-none transition-colors">
                                    <option value="">-- Select --</option>
                                    <option value="mbchb">MBCHB, BDS & CM</option>
                                    <option value="biomedical">Biomedical Science</option>
                                    <option value="public-health">Public Health</option>
                                    <option value="environmental">Environmental Health</option>
                                </select>
                            </div>
                            <div class="flex flex-col space-y-1.5">
                                <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Academic Year</label>
                                <select id="note-year" onchange="updateAdminNotesDropdowns(this.id)" class="w-full bg-[#070e1e] border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-bold focus:border-purple-500/50 focus:outline-none transition-colors" disabled>
                                    <option value="">-- Select --</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col space-y-1.5">
                                <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Course Module</label>
                                <select id="note-course" class="w-full bg-[#070e1e] border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-bold focus:border-purple-500/50 focus:outline-none transition-colors" disabled>
                                    <option value="">-- Select --</option>
                                </select>
                            </div>
                            <div class="flex flex-col space-y-1.5">
                                <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Academic Term</label>
                                <select id="note-term" class="w-full bg-[#070e1e] border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-bold focus:border-purple-500/50 focus:outline-none transition-colors">
                                    <option value="1">Term 01 Portfolio</option>
                                    <option value="2">Term 02 Portfolio</option>
                                    <option value="3">Term 03 Portfolio</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4 bg-slate-900/20 border border-slate-800/80 p-6 rounded-2xl h-fit">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center space-x-2">
                            <i data-lucide="file-up" class="w-3.5 h-3.5 text-purple-400"></i>
                            <span>Handout Document Compositor</span>
                        </div>
                        
                        <div class="flex flex-col space-y-1.5">
                            <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Topic Title Name</label>
                            <input type="text" id="note-title" placeholder="e.g., 1. Introduction to Histology" class="w-full bg-[#070e1e] border border-slate-800 focus:border-purple-500/50 rounded-xl p-3 text-xs text-white font-medium focus:outline-none transition-colors">
                        </div>

                        <div class="flex flex-col space-y-1.5">
                            <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Upload PDF Handout File</label>
                            <div class="relative w-full border border-dashed border-slate-800 hover:border-purple-500/30 rounded-xl bg-[#070e1e]/50 transition-all cursor-pointer p-8 text-center group" id="pdf-dropzone">
                                <input type="file" id="notes-file-input" accept=".pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                
                                <div class="space-y-3 pointer-events-none">
                                    <div class="text-slate-500 group-hover:text-purple-400 transition-colors flex justify-center">
                                        <i data-lucide="upload-cloud" class="w-8 h-8 stroke-1"></i>
                                    </div>
                                    <div class="text-xs text-slate-300 font-medium" id="upload-status-text">
                                        Click or drag a PDF document file to this sector
                                    </div>
                                    <div class="text-[9px] text-slate-600 font-mono uppercase tracking-wider">
                                        Maximum recommended size profile: 3MB
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button onclick="window.publishLectureHandoutDocument()" class="w-full bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-400 text-purple-300 hover:text-white p-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-950/20 flex items-center justify-center space-x-2 pt-3">
                            <i data-lucide="globe" class="w-3.5 h-3.5"></i>
                            <span>Publish Handout Document to Index</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        
        const fileInput = document.getElementById('notes-file-input');
        const statusText = document.getElementById('upload-status-text');
        const dropzone = document.getElementById('pdf-dropzone');
        if (fileInput && statusText && dropzone) {
            fileInput.addEventListener('change', (e) => {
                const uploadedFile = e.target.files[0];
                if (uploadedFile) {
                    statusText.innerHTML = `<span class="text-emerald-400 font-mono">📄 ${uploadedFile.name}</span> Ready for deployment`;
                    dropzone.className = "relative w-full border border-solid border-emerald-500/30 rounded-xl bg-emerald-950/5 p-8 text-center transition-all cursor-pointer";
                }
            });
        }
    
    } else if (mode === 'quizzes') {
        currentQuizQuestionsHeap = [];
        
        contentArea.innerHTML = `
            <div id="quiz-creator-workspace" class="w-full max-w-5xl mx-auto bg-[#0b1329]/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md space-y-8 my-6 animate-in fade-in duration-200">
                <div class="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/30">
                            <i data-lucide="help-circle" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <h3 class="text-sm font-black text-white uppercase tracking-wider">Neural Link Assessment Core</h3>
                            <p class="text-[11px] text-slate-400 font-medium normal-case">Configure target routes, section matrices, and dynamic examination parameters.</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <span class="text-[10px] font-black text-purple-400 uppercase tracking-widest block">01 / Target Path Routing Configuration</span>
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#050b18]/40 p-4 rounded-xl border border-slate-800/40">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Program</label>
                            <select id="quiz-program" onchange="synchronizeQuizCourseDropdown(this.id)" class="w-full bg-[#070d19] border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500 transition-all cursor-pointer">
                                <option value="">-- Select Program --</option>
                                <option value="mbchb">MBChB, BDS and CM</option>
                                <option value="biomedical">Biomedical Science</option>
                                <option value="public-health">Public Health</option>
                                <option value="environmental">Environmental Health</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Year</label>
                            <select id="quiz-year" onchange="synchronizeQuizCourseDropdown(this.id)" class="w-full bg-[#070d19] border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500 transition-all cursor-pointer">
                                <option value="">-- Select Year --</option>
                                <option value="1">Year 01</option>
                                <option value="2">Year 02</option>
                                <option value="3">Year 03</option>
                                <option value="4">Year 04</option>
                                <option value="5">Year 05</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course Module</label>
                            <select id="quiz-course" disabled class="w-full bg-[#070d19] border border-slate-800 text-slate-500 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500 transition-all disabled:opacity-40">
                                <option value="">-- Awaiting Path --</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                                <i data-lucide="layers" class="w-3 h-3 text-amber-400"></i>
                                <span>Clinical Library Slot</span>
                            </label>
                            <select id="quiz-library-slot" disabled class="w-full bg-[#070d19] border border-amber-500/20 text-amber-200 rounded-xl px-3 py-2.5 text-xs font-black tracking-wide focus:outline-none focus:border-amber-500 bg-amber-500/5 transition-all disabled:opacity-40">
                                <option value="">-- Awaiting Course Module --</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-2">
                    <span class="text-[10px] font-black text-blue-400 uppercase tracking-widest block">02 / Section Overview & Guidelines</span>
                    <div class="space-y-4 bg-[#050b18]/40 p-4 rounded-xl border border-slate-800/40">
                        <div class="flex flex-col space-y-2">
                            <label class="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                                <i data-lucide="type" class="w-3.5 h-3.5 text-purple-400"></i>
                                <span>Assessment Topic Title (Matches Card Header Title Style)</span>
                            </label>
                            <input type="text" id="quiz-topic-title" placeholder="e.g., 01. ANATOMY & PHYSIOLOGY BLOCK QUIZ" class="w-full bg-[#070d19] border border-purple-500/20 focus:border-purple-500 text-purple-200 font-bold rounded-xl p-3 text-xs focus:outline-none transition-colors tracking-wide placeholder-slate-600">
                        </div>
                        <div id="admin-section-toggle-zone" class="pt-2">
                            <button type="button" onclick="activateAdminSectionMode()" class="w-full py-3 bg-[#070d19]/50 hover:bg-purple-950/20 text-purple-400 border border-dashed border-slate-800 hover:border-purple-500/40 text-[10px] font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2">
                                <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                                <span>Append Section Content Layer</span>
                            </button>
                        </div>
                        <div id="admin-section-input-group" class="hidden space-y-4 pt-4 border-t border-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div id="admin-dynamic-action-bar" class="flex items-center justify-between">
                                <div class="flex items-center space-x-2">
                                    <span id="admin-section-badge" class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] font-black tracking-widest font-mono rounded border border-purple-500/20 uppercase">SECTION A</span>
                                    <span class="text-[10px] font-bold text-slate-500 font-mono">Active Booklet Anchor</span>
                                </div>
                                <div class="flex items-center space-x-4">
                                    <button type="button" onclick="deactivateAdminSectionMode()" class="text-[9px] font-mono font-bold text-red-400/80 hover:text-red-400 hover:underline cursor-pointer transition-colors">
                                        [ Strip Section Frame ]
                                    </button>
                                </div>
                            </div>
                            <div class="flex flex-col space-y-2">
                                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section Heading Title</label>
                                <input type="text" id="quiz-section-title" placeholder="e.g., Section A: Cardiovascular Physiology & Clinical Syndromes" class="w-full bg-[#070d19] border border-slate-800 text-white font-medium rounded-xl p-3 text-xs focus:border-purple-500 focus:outline-none transition-colors">
                            </div>
                            <div class="flex flex-col space-y-2">
                                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>Instructions / Clinical Scenario Context (Markdown Allowed)</span>
                                    <span class="text-[9px] text-slate-500 normal-case">Supports **bold**, # titles, and line breaks</span>
                                </label>
                                <textarea id="quiz-section-description" rows="3" placeholder="e.g., **Instructions:** Answer all structural clinical response fields..." class="w-full bg-[#070d19] border border-slate-800 text-slate-300 font-medium rounded-xl p-3 text-xs focus:border-purple-500 focus:outline-none transition-colors resize-none font-mono"></textarea>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div class="flex flex-col space-y-2">
                                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section Processing Rule</label>
                                    <select id="quiz-section-rule-mode" onchange="window.toggleAdminSectionRuleFieldsVisibility()" class="w-full bg-[#070d19] border border-slate-800 text-white font-medium rounded-xl p-3 text-xs focus:border-purple-500 focus:outline-none transition-colors cursor-pointer">
                                        <option value="ALL">Mandatory (Answer All Questions)</option>
                                        <option value="CHOICE">Choice Matrix (e.g., Answer 3 out of 6)</option>
                                    </select>
                                </div>
                                <div id="admin-section-required-count-wrapper" class="flex flex-col space-y-2 opacity-40 pointer-events-none transition-all duration-200">
                                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                        <span>Required Answer Count</span>
                                        <span class="text-[9px] text-purple-400 font-mono normal-case">Threshold Cap</span>
                                    </label>
                                    <input type="number" id="quiz-section-required-count" min="1" placeholder="Leave blank to include all" class="w-full bg-[#070d19] border border-slate-800 text-purple-400 font-mono font-bold rounded-xl p-3 text-xs focus:border-purple-500 focus:outline-none transition-colors">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4 pt-2">
    <div class="flex items-center justify-between">
        <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest block">03 / Question Construction Registry</span>
        
        <div class="flex items-center space-x-3">
            <button type="button" onclick="appendNewSectionBlockToWorkspace()" class="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 text-purple-300 border border-purple-500/30 hover:from-purple-800 hover:to-indigo-800 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5">
                <i data-lucide="folder-plus" class="w-3.5 h-3.5"></i>
                <span>+ Add Section Frame</span>
            </button>

            <button type="button" onclick="addQuestionItemToWorkspace()" class="bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Add Question Item</span>
            </button>
        </div>
    </div>
    
    <div id="quiz-composer-sections-target" class="space-y-6">
        <div id="section-pristine-placeholder" class="p-8 border border-dashed border-slate-800/60 bg-slate-900/5 rounded-xl text-center text-slate-500 text-[11px] font-medium uppercase tracking-wider">
            No items appended yet. Click "+ Add Section Frame" or "Add Question Item" to initialize your workspace layout.
        </div>
    </div>
</div>

                <div class="pt-6 border-t border-slate-800 flex items-center justify-end">
                    <button onclick="compileAndSaveQuizConfiguration()" class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest text-xs px-6 py-3 rounded-xl transition-all shadow-lg transform active:scale-98 flex items-center space-x-2 cursor-pointer">
                        <i data-lucide="save" class="w-4 h-4"></i>
                        <span>Compile & Publish Assessment</span>
                    </button>
                </div>
            </div>
        `;
    } else if (mode === 'design_hub') {
        // 🎨 BRAND NEW ROUTE: Injecting the Billboard Customizer Interface Panel
        // Grabs our pre-loaded fallback dataset array structure out of storage memory
        let storedSlides = localStorage.getItem('design_hub_slides');
        let currentSlides = storedSlides ? JSON.parse(storedSlides) : [];

        contentArea.innerHTML = `
            <div class="w-full max-w-4xl mx-auto flex flex-col space-y-6 animate-in fade-in duration-300 pb-12">
                <div class="border-b border-slate-800/60 pb-4 flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-black text-white uppercase tracking-wider">Design Hub Control Panel</h2>
                        <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Deploy automated background image slide galleries and student milestones</p>
                    </div>
                    <div class="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl text-[9px] font-mono font-black text-emerald-400 tracking-wider uppercase">
                        Active Control Matrix
                    </div>
                </div>

                <div class="bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center space-x-2">
                        <i data-lucide="images" class="w-4 h-4 text-emerald-400"></i>
                        <span>Active Billboard Substrate Matrix Array (5 Slide Nodes)</span>
                    </div>

                    <form id="design-hub-compositor-form" onsubmit="commitDesignHubChanges(event)" class="space-y-6">
                        <div class="space-y-4">
                            ${currentSlides.map((slide, index) => `
                                <div class="bg-[#070e1e]/60 border border-slate-800/60 rounded-xl p-4 space-y-4 relative group hover:border-emerald-500/20 transition-all">
                                    <div class="absolute top-4 right-4 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded text-[8px] font-mono font-black text-slate-500 tracking-wider">
                                        NODE SLOT 0${index + 1}
                                    </div>
                                    
                                    <div class="flex flex-col space-y-1.5">
                                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Image Resource Uniform Resource Locator (URL)</label>
                                        <input type="text" id="billboard-url-${index}" value="${slide.imgUrl}" required
                                            class="w-full bg-[#050b18] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/40 transition-colors" 
                                            placeholder="Paste secure image link address..."/>
                                    </div>

                                    <div class="flex flex-col space-y-1.5">
                                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Motivational Message Text Overlay</label>
                                        <textarea id="billboard-text-${index}" rows="2" required
                                            class="w-full bg-[#050b18] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none">${slide.text}</textarea>
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div class="flex items-center justify-end pt-2">
                            <button type="submit" 
                                class="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer transform active:scale-95 flex items-center space-x-2">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin-slow"></i>
                                <span>Compile & Sync Design System Parameters</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    if (window.lucide) window.lucide.createIcons();
}

// 💾 BACKEND MANAGEMENT PROCESSOR: Captures inputs and updates the local storage loop array
async function commitDesignHubChanges(event) {
    if (event) event.preventDefault();
    
    const configuredSlides = [];
    for (let i = 0; i < 5; i++) {
        const urlElement = document.getElementById(`billboard-url-${i}`);
        const textElement = document.getElementById(`billboard-text-${i}`);
        
        if (urlElement && textElement) {
            configuredSlides.push({
                slot_id: i + 1, // Matches slot_id 1 to 5 in Supabase
                image_url: urlElement.value.trim(),
                motivational_text: textElement.value.trim(),
                updated_at: new Date().toISOString()
            });
        }
    }

    try {
        // Upsert slide inputs into Supabase table public.billboard_slides
        const { data, error } = await supabase
            .from('billboard_slides')
            .upsert(configuredSlides, { onConflict: 'slot_id' });

        if (error) throw error;

        // Keep local cache up-to-date as secondary backup
        localStorage.setItem('design_hub_slides', JSON.stringify(configuredSlides));
        
        if (typeof window.showToast === 'function') {
            window.showToast("Data Synced", "Design core configurations successfully synced to database.", "success");
        } else {
            alert("🚀 Design Hub Sync Complete! The 5-slide core has been successfully updated in Supabase.");
        }
    } catch (err) {
        console.error("❌ Failed to push billboard updates to Supabase:", err);
        
        if (typeof window.showToast === 'function') {
            window.showToast("Sync Error", "Failed to update billboard database parameters.", "error");
        } else {
            alert("⚠️ Sync Failed: Could not send changes to the database.");
        }
    }
}

window.toggleAdminSectionRuleFieldsVisibility = function(element) {
    if (!element) return;
 
    // Find the specific section container block this dropdown lives inside
    const sectionBlock = element.closest('.exam-section-block') || element.closest('#admin-section-input-group');
    if (!sectionBlock) return;
 
    // Search locally inside this specific section block using class names
    const requiredWrapper = sectionBlock.querySelector('.admin-section-required-count-wrapper');
    const requiredInput = sectionBlock.querySelector('.quiz-section-required-count-input');
 
    if (requiredWrapper) {
        if (element.value === 'CHOICE' || element.value === 'CHOICE_MATRIX') {
            requiredWrapper.classList.remove('opacity-40', 'pointer-events-none');
            if (requiredInput) {
                requiredInput.removeAttribute('disabled');
                requiredInput.focus();
            }
        } else {
            requiredWrapper.classList.add('opacity-40', 'pointer-events-none');
            if (requiredInput) {
                requiredInput.setAttribute('disabled', 'true');
                requiredInput.value = ''; // Reset on hide
            }
        }
    }
};
/**
 * Pushes a fresh query configuration structure block into the dynamic view layout.
 */
function addQuestionItemToWorkspace() {
    // 1. Determine where the question card should be appended
    const allSections = document.querySelectorAll('.exam-section-block');
    let targetElement = null;

    if (allSections.length > 0) {
        // If sections exist, find the very last section frame container added on screen
        const latestSection = allSections[allSections.length - 1];
        // Target its specific sub-question question pool zone
        targetElement = latestSection.querySelector('.section-questions-drop-zone');
    } else {
        // Fallback: If no section frame has been created yet, use the flat main registry base container
        targetElement = document.getElementById('quiz-composer-sections-target');
    }

    if (!targetElement) return;

    // 2. Clear out placeholders so they don't stay mixed with cards
    const localPlaceholder = targetElement.querySelector('#section-pristine-placeholder');
    if (localPlaceholder) {
        localPlaceholder.remove();
    }
    const globalPlaceholder = document.getElementById('section-pristine-placeholder');
    if (globalPlaceholder && allSections.length === 0) {
        globalPlaceholder.remove();
    }

    // 3. Track sequential question labels cleanly based on total visible cards on screen
    const totalQuestionsOnScreen = document.querySelectorAll('[data-heap-id^="question_node_"]').length;
    const nextIndex = totalQuestionsOnScreen + 1;
    const questionId = `question_node_${Date.now()}_${nextIndex}`;

    // 🎨 RENDER THE INTERFACE CARD (Keeps your layout styles perfectly intact)
    const questionCardHTML = `
        <div id="${questionId}" class="question-card-node bg-[#050b18]/50 border border-slate-800/80 rounded-xl p-5 space-y-4 relative animate-in slide-in-from-bottom-2 duration-200" 
            data-heap-id="${questionId}"
            data-identifier-count="0">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/60 gap-3">
                <div class="flex items-center space-x-2 flex-1">
                    <span id="${questionId}-label-badge" class="bg-slate-800 text-slate-300 font-mono text-[10px] font-black px-2 py-0.5 rounded">Q-${nextIndex}</span>
                    
                    <input type="text" id="${questionId}-stem-input" placeholder="Enter Question Stem Text or Clinical Vignette Context..." 
                        class="question-stem-input bg-transparent text-xs font-bold text-white focus:outline-none w-full placeholder-slate-600">
                </div>
                
                <div class="flex items-center space-x-3 self-end sm:self-auto">
                    <button onclick="convertNodeToSubQuestionParent('${questionId}')" id="${questionId}-split-btn"
                        class="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center space-x-1 cursor-pointer">
                        <i data-lucide="git-merge" class="w-3 h-3"></i>
                        <span>Split into Sub-Questions</span>
                    </button>

                    <div id="${questionId}-switcher-wrap" class="flex bg-[#070d19] border border-slate-800 p-1 rounded-lg space-x-1">
                        <button onclick="toggleDynamicQuestionFields('${questionId}', 'mcq')" id="${questionId}-tab-mcq" 
                            class="px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all bg-purple-600 text-white cursor-pointer">
                            MCQ
                        </button>
                        <button onclick="toggleDynamicQuestionFields('${questionId}', 'tf')" id="${questionId}-tab-tf" 
                            class="px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            T / F
                        </button>
                        <button onclick="toggleDynamicQuestionFields('${questionId}', 'longAnswer')" id="${questionId}-tab-longAnswer" 
                            class="px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            Long Answer
                        </button>
                        <button onclick="toggleDynamicQuestionFields('${questionId}', 'identifier')" id="${questionId}-tab-identifier" 
                            class="px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            Identifier
                        </button>
                        <button onclick="toggleDynamicQuestionFields('${questionId}', 'matching')" id="${questionId}-tab-matching" 
                            class="px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            Matching
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#070d19]/30 p-3.5 border border-slate-850/60 rounded-xl">
                <div class="md:col-span-2 space-y-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <i data-lucide="image" class="w-3 h-3 text-purple-400"></i>
                        <span>Anatomical / Clinical Image Supplement (Shared by Sub-Questions if Split)</span>
                    </label>
                    <div class="flex items-center space-x-3">
                        <input type="file" id="${questionId}-file-input" accept="image/*" onchange="handleQuizImageIngestion(this, '${questionId}')"
                            class="block w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer">
                    </div>
                </div>
                <div class="flex items-center justify-center border border-slate-800/80 bg-[#040812] rounded-lg p-2 min-h-[60px]">
                    <div id="${questionId}-preview-box" class="text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center">
                        No Attached Media
                    </div>
                </div>
            </div>

            <div id="${questionId}-mutable-fields-container" class="py-2">
                ${typeof generateMCQStarterTemplate === 'function' ? generateMCQStarterTemplate(`${questionId}-options-grid`) : ''}
            </div>

            <div id="${questionId}-variant-action-zone" class="w-full flex justify-end hidden mt-2">
                <button type="button" onclick="window.addLevelIdentifierLabelField('${questionId}')" 
                    class="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer">
                    <span>+ Add Labeled Item</span>
                </button>
            </div>

            <div id="${questionId}-ai-key-container" class="hidden flex flex-col space-y-1.5 pt-2 animate-in fade-in duration-150">
                <label class="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <i data-lucide="cpu" class="w-3.5 h-3.5"></i>
                    <span>Standby "AI Model Answer Key" Field Engine</span>
                </label>
                <textarea id="${questionId}-neural-insight" rows="3" placeholder="Define high-yield phrases or evaluation criteria points for the AI grading engine stack..." 
                    class="neural-insight-input w-full bg-[#070d19] border border-emerald-500/10 focus:border-emerald-500/40 text-slate-300 font-medium font-mono rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none"></textarea>
            </div>

            <div id="${questionId}-nested-subquestions-wrap" class="hidden border-t border-slate-800/80 pt-4 mt-2 space-y-4">
                <div class="flex items-center justify-between bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-2.5">
                    <span class="text-[10px] font-mono font-black text-blue-400 uppercase tracking-widest flex items-center space-x-1.5">
                        <i data-lucide="git-branch" class="w-3.5 h-3.5"></i>
                        <span>Nested Sub-Question Push Array Engine Active</span>
                    </span>
                    <button onclick="renderSubQuestionFormArray('${questionId}')" 
                        class="bg-blue-600 text-white hover:bg-blue-400 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer">
                        <i data-lucide="plus" class="w-3 h-3"></i>
                        <span>Add Nested Sub-Question</span>
                    </button>
                </div>
                <div id="${questionId}-nested-target-list" class="space-y-4 pl-4 border-l-2 border-slate-800">
                </div>
            </div>

        </div>
    `;

    targetElement.insertAdjacentHTML('beforeend', questionCardHTML);
    if (window.lucide) lucide.createIcons();
}

/**
 * 🛠️ HELPER FUNCTION: Extracts individual fields for child rows
 */
function scrapeSubQuestionData(subId, subNode, subConfig, parentVignetteText, parentImage) {
    const subStemInput = document.getElementById(`${subId}-stem-field`) || subNode.querySelector('input[type="text"]');
    const subRationaleInput = document.getElementById(`${subId}-neural-insight`) || document.getElementById(`${subId}-ai-cues-field`);
    const activeLabelPrefix = subNode.getAttribute('data-prefix-value') || subConfig.prefix || 'a';

    let subDetectedType = 'mcq';
    const subActiveBtn = subNode.querySelector('.bg-purple-600, .active-type-btn');
    if (subActiveBtn) {
        const btnText = subActiveBtn.innerText.toUpperCase();
        if (btnText.includes('T / F') || btnText.includes('T/F')) subDetectedType = 'tf';
        else if (btnText.includes('LONG') || btnText.includes('ESSAY')) subDetectedType = 'longAnswer';
        else if (btnText.includes('IDENTIFIER')) subDetectedType = 'identifier';
        else if (btnText.includes('MATCHING')) subDetectedType = 'matching';
        else if (btnText.includes('MCQ')) subDetectedType = 'mcq';
    }

    const coreSubText = subStemInput ? subStemInput.value.trim() : "";
    const combinedQuestionText = parentVignetteText ? `${parentVignetteText}\n\n${coreSubText}` : coreSubText;

    const subQuestionData = {
        id: subId,
        type: subDetectedType, 
        prefix: activeLabelPrefix,
        questionText: combinedQuestionText, 
        scenarioContext: parentVignetteText, 
        rationale: subRationaleInput ? subRationaleInput.value.trim() : "",
        imageBase64: parentImage,
        imageSupplement: parentImage || null 
    };

    handleSpecificTypeScraping(subQuestionData, subId, subNode);
    return subQuestionData;
}

/**
 * 🛠️ HELPER FUNCTION: Collects interactive elements (options, values, rubrics, sub-parts)
 */
function handleSpecificTypeScraping(dataObject, targetId, containerNode) {
    if (dataObject.type === 'identifier') {
        const parsedLabels = [];
        const maxCount = parseInt(containerNode.getAttribute('data-identifier-count') || '0', 10);
        const configuredStyle = containerNode.getAttribute('data-marker-type') || 'numbers';
        
        for (let i = 1; i <= maxCount; i++) {
            const labelInput = document.getElementById(`${targetId}-identifier-target-${i}`);
            if (labelInput) parsedLabels.push(labelInput.value.trim());
        }
        dataObject.identifierLabels = parsedLabels;
        dataObject.markerType = configuredStyle;
        dataObject.correctAnswer = parsedLabels.join(', ');

    } else if (dataObject.type === 'matching') {
        const stackNode = document.getElementById(`${targetId}-matching-rows-stack`);
        const strategy = document.getElementById(`${targetId}-matching-workspace`)?.getAttribute('data-matching-strategy') || 'table';
        const parsedPairs = [];
        const serializedParts = [];
        const uniqueOptionsSet = new Set();

        if (stackNode) {
            const maxCount = parseInt(stackNode.getAttribute('data-pair-count') || '0', 10);
            let pairIndexCounter = 1;
            for (let i = 1; i <= maxCount; i++) {
                const clueInput = document.getElementById(`${targetId}-match-clue-${i}`);
                const matchInput = document.getElementById(`${targetId}-match-target-${i}`);
                if (clueInput && matchInput) {
                    const clueText = clueInput.value.trim();
                    const correctMatch = matchInput.value.trim();
                    if (clueText || correctMatch) {
                        parsedPairs.push({ index: pairIndexCounter, clueText: clueText || `Term Variant ${pairIndexCounter}`, correctMatch: correctMatch || "" });
                        serializedParts.push(`${clueText} -> ${correctMatch}`);
                        if (correctMatch) uniqueOptionsSet.add(correctMatch);
                        pairIndexCounter++;
                    }
                }
            }
        }
        const poolLegendInput = document.getElementById(`${targetId}-pool-definition-input`);
        dataObject.matchingPairs = parsedPairs;
        dataObject.matchingStrategy = strategy;
        dataObject.correctAnswer = serializedParts.join(' || ');
        dataObject.rawOptionPoolString = poolLegendInput ? poolLegendInput.value.trim() : Array.from(uniqueOptionsSet).join(', ');

    } else if (dataObject.type === 'mcq') {
        dataObject.options = typeof compileMCQOptionsArray === 'function' 
            ? compileMCQOptionsArray(targetId) 
            : Array.from(containerNode.querySelectorAll('.option-variant-input, .mcq-option')).map(i => i.value.trim()).filter(Boolean);
        
        const allRadios = containerNode.querySelectorAll('input[type="radio"]');
        let matchedIndex = 0;
        allRadios.forEach((radio, idx) => { if (radio.checked) matchedIndex = idx; });
        dataObject.correctAnswer = String.fromCharCode(65 + matchedIndex);

    } else if (dataObject.type === 'tf') {
        const trueRadio = document.querySelector(`input[name="${targetId}-tf-target"][value="true"]`);
        dataObject.correctAnswer = (trueRadio && trueRadio.checked) ? "true" : "false";

    } else if (dataObject.type === 'longAnswer') {
        // 🌟 SUBDIVIDED LONG ANSWER EXTRACTION MATRIX
        const nestedTargetList = document.getElementById(`${targetId}-child-nested-target-list`);
        const childNodes = nestedTargetList ? nestedTargetList.querySelectorAll('[data-child-sub-node="true"]') : [];

        if (childNodes.length > 0) {
            dataObject.isSubdivided = true;
            dataObject.subParts = Array.from(childNodes).map(partNode => {
                const childId = partNode.id;
                const prefix = partNode.getAttribute('data-prefix-value') || 'i';
                
                const stemInput = document.getElementById(`${childId}-stem-field`);
                const marksInput = document.getElementById(`${childId}-marks-field`);
                const insightInput = document.getElementById(`${childId}-neural-insight`);
                const aiCuesInput = document.getElementById(`${childId}-ai-cues`);

                return {
                    id: childId,
                    prefix: prefix,
                    stem: stemInput ? stemInput.value.trim() : "",
                    marks: marksInput ? (parseInt(marksInput.value, 10) || 1) : 1,
                    rationale: insightInput ? insightInput.value.trim() : "",
                    aiModelAnswer: aiCuesInput ? aiCuesInput.value.trim() : ""
                };
            });

            // Aggregate compiled grading string across all nested sub-parts
            dataObject.correctAnswer = dataObject.subParts
                .map(part => `(${part.prefix}) ${part.stem}: ${part.aiModelAnswer}`)
                .join(' || ');
        } else {
            dataObject.isSubdivided = false;
            dataObject.subParts = [];
            const rubricInput = containerNode.querySelector('.long-answer-rubric, textarea[placeholder*="Criteria"]');
            dataObject.correctAnswer = rubricInput && rubricInput.value.trim() ? rubricInput.value.trim() : "Written Submission Evaluation Slot";
        }
    }
}

// =========================================================
// A. THE QUIZ CARD INJECTOR (Renders the preview card)
// =========================================================
window.renderAvailableLibraryPapers = function() {
    const program = window.currentProgram || localStorage.getItem('active_program') || 'mbchb';
    const year = window.currentYear || localStorage.getItem('active_year') || '2';
    const slot = '1'; 
    
    const finalStorageKey = `quiz_${String(program).trim().toLowerCase()}_${String(year).trim()}_slot${slot}`;
    console.log(`📡 Scanning localStorage database for key: "${finalStorageKey}"...`);

    // Looks for the HTML placeholder we created in Step 1
    const libraryGrid = document.getElementById('student-quiz-library-grid');
    if (!libraryGrid) return;

    const rawData = localStorage.getItem(finalStorageKey);
    if (!rawData) {
        libraryGrid.innerHTML = `
            <div class="text-center p-6 border border-dashed border-slate-800 rounded-2xl text-slate-500 font-mono text-xs">
                No active assessment paper deployed to Slot 0${slot} yet.
            </div>`;
        return;
    }

    try {
        const quizBundle = JSON.parse(rawData);
        let totalQuestionsCount = 0;
        let totalSectionsCount = 0;
        let sectionBadgesHTML = '';

        if (quizBundle.examDataStructure && Array.isArray(quizBundle.examDataStructure)) {
            totalSectionsCount = quizBundle.examDataStructure.length;
            quizBundle.examDataStructure.forEach(section => {
                if (section.questions) totalQuestionsCount += section.questions.length;
                if (section.sectionLetter) {
                    sectionBadgesHTML += `<span class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] font-black font-mono rounded border border-purple-500/20 uppercase">SEC ${section.sectionLetter}</span>`;
                }
            });
        } else if (quizBundle.questions && Array.isArray(quizBundle.questions)) {
            totalQuestionsCount = quizBundle.questions.length;
            totalSectionsCount = 1;
            sectionBadgesHTML = `<span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-black font-mono rounded border border-blue-500/20 uppercase">STANDARD</span>`;
        }

        // Injects the card design into your dashboard placeholder cleanly
        libraryGrid.innerHTML = `
            <div class="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div class="bg-[#050b18]/60 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 space-y-4 shadow-2xl backdrop-blur-md relative overflow-hidden group transition-all duration-300">
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[9px] font-mono font-black text-slate-500 tracking-widest uppercase">System Manifest Online</span>
                            <div class="flex items-center space-x-1.5">${sectionBadgesHTML}</div>
                        </div>
                        <h3 class="text-sm font-black text-white tracking-tight uppercase group-hover:text-purple-400 transition-colors pt-1">
                            ${quizBundle.quizTitle || "Untitled Compiled Assessment"}
                        </h3>
                    </div>

                    <div class="grid grid-cols-3 gap-2 bg-[#070d19]/60 p-3 rounded-xl border border-slate-900/80 font-mono">
                        <div class="text-center border-r border-slate-800/40">
                            <div class="text-[14px] font-black text-purple-400">${totalSectionsCount}</div>
                            <div class="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Sections</div>
                        </div>
                        <div class="text-center border-r border-slate-800/40">
                            <div class="text-[14px] font-black text-emerald-400">${totalQuestionsCount}</div>
                            <div class="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Items</div>
                        </div>
                        <div class="text-center">
                            <div class="text-[14px] font-black text-blue-400">0${slot}</div>
                            <div class="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Slot ID</div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between pt-1">
                        <span class="text-[10px] font-medium text-slate-400 flex items-center space-x-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span class="pl-1 text-[9px]">Ready to Begin</span>
                        </span>
                        <button onclick="startActiveQuizEngine('${program}', '${year}', '${slot}')" 
                            class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer">
                            <span>Launch Paper</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Failure processing database package:", err);
    }
};


window.convertNodeToSubQuestionParent = function(questionId) {
    // Ensure the array state exists before running array search mechanics
    if (!window.currentQuizQuestionsHeap) {
        window.currentQuizQuestionsHeap = [];
    }

    // 🔍 Find the target node matching our global stack structure array
    let targetNode = window.currentQuizQuestionsHeap.find(q => q.id === questionId);
    
    // 🛡️ THE FAILSAFE RECOVERY: If the section architecture omitted registration, build it here!
    if (!targetNode) {
        console.warn(`[Admin Engine] Node ${questionId} wasn't in heap tracking stack. Initializing tracking state safely...`);
        targetNode = {
            id: questionId,
            type: 'mcq',
            options: [],
            subQuestions: [] // Ensure subQuestions array is initialized
        };
        window.currentQuizQuestionsHeap.push(targetNode);
    }

    // Ensure the subQuestions sub-array container structure exists safely
    if (!targetNode.subQuestions) {
        targetNode.subQuestions = [];
    }

    // 🧵 UNIFIED STATE MUTATION: Align with our structural data layout contract
    targetNode.isParentNode = true;
    targetNode.type = 'scenario'; // Synced for structural routing checks

    // Update UI elements to reflect parent shell configuration
    const labelBadge = document.getElementById(`${questionId}-label-badge`);
    const stemInput = document.getElementById(`${questionId}-stem-input`);
    const splitBtn = document.getElementById(`${questionId}-split-btn`);
    const switcherWrap = document.getElementById(`${questionId}-switcher-wrap`);
    const primaryFieldsContainer = document.getElementById(`${questionId}-mutable-fields-container`);
    const primaryAiContainer = document.getElementById(`${questionId}-ai-key-container`);
    const nestedSubquestionsWrap = document.getElementById(`${questionId}-nested-subquestions-wrap`);

    if (labelBadge) {
        labelBadge.innerText = "CASE VIGNETTE";
        labelBadge.className = "bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider";
    }
    
    if (stemInput) {
        stemInput.placeholder = "Enter global case history scenario, lab telemetry records, or patient presentation notes...";
    }
    
    if (splitBtn) splitBtn.classList.add('hidden');
    if (switcherWrap) switcherWrap.classList.add('hidden');
    if (primaryFieldsContainer) primaryFieldsContainer.innerHTML = ''; 
    if (primaryAiContainer) primaryAiContainer.classList.add('hidden');

    // Reveal nested child array target block wrapper layer
    if (nestedSubquestionsWrap) {
        nestedSubquestionsWrap.classList.remove('hidden');
        
        // Instantly push the first nested item into the view stack structure framework
        if (typeof renderSubQuestionFormArray === 'function') {
            renderSubQuestionFormArray(questionId);
        } else {
            console.warn(`[Admin Engine] renderSubQuestionFormArray function is not detected globally in this terminal instance.`);
        }
    }
};
/**
 * Pushes and renders a brand new child question block inside the parent card's target nested container.
 */
window.renderSubQuestionFormArray = function(parentId) {
    // Safely verify and access the global application heap configuration state
    if (!window.currentQuizQuestionsHeap) {
        window.currentQuizQuestionsHeap = [];
    }

    const parentNode = window.currentQuizQuestionsHeap.find(q => q.id === parentId);
    const targetChildList = document.getElementById(`${parentId}-nested-target-list`);
    if (!parentNode || !targetChildList) return;

    const subIndex = parentNode.subQuestions.length + 1;
    const subQuestionId = `sub_${parentId}_${Date.now()}_${subIndex}`;

    // 🧵 ALIGNMENT MAP: Generate alphabetical label prefixes (a., b., c., d...)
    const alphaPrefixes = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const activeLabelPrefix = alphaPrefixes[(subIndex - 1) % alphaPrefixes.length];

    // Push new question meta config layer into the parent's nested storage track array
    parentNode.subQuestions.push({
        id: subQuestionId,
        type: 'mcq', // default layout state inside node matrix
        prefix: activeLabelPrefix,
        childSubQuestions: []
    });

    const subQuestionHTML = `
        <div id="${subQuestionId}" class="bg-[#050b18]/80 border border-slate-850 rounded-xl p-4 space-y-3 animate-in zoom-in-95 duration-150" 
            data-sub-node-wrapper="true" 
            data-prefix-value="${activeLabelPrefix}"
            data-identifier-count="0">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-850 gap-2">
                <div class="flex items-center space-x-2 flex-1">
                    <span class="text-[10px] font-black text-blue-400 font-mono uppercase bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                        Sub-Q (${activeLabelPrefix.toUpperCase()})
                    </span>
                    <input type="text" id="${subQuestionId}-stem-field" placeholder="Enter sub-question specific prompt field stem..." 
                        class="bg-transparent text-xs font-semibold text-white focus:outline-none w-full placeholder-slate-700">
                </div>
                
                <div class="flex items-center space-x-2">
                    <!-- TYPE SELECTOR PILLS -->
                    <div class="flex bg-[#070d19] border border-slate-850 p-0.5 rounded-md space-x-1">
                        <button type="button" onclick="toggleDynamicQuestionFields('${subQuestionId}', 'mcq')" id="${subQuestionId}-tab-mcq" 
                            class="px-2 py-0.5 text-[9px] font-black uppercase rounded tracking-wider transition-all bg-purple-600 text-white cursor-pointer">
                            MCQ
                        </button>
                        <button type="button" onclick="toggleDynamicQuestionFields('${subQuestionId}', 'tf')" id="${subQuestionId}-tab-tf" 
                            class="px-2 py-0.5 text-[9px] font-black uppercase rounded tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            T / F
                        </button>
                        <button type="button" onclick="toggleDynamicQuestionFields('${subQuestionId}', 'longAnswer')" id="${subQuestionId}-tab-longAnswer" 
                            class="px-2 py-0.5 text-[9px] font-black uppercase rounded tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            Long Answer
                        </button>
                        <button type="button" onclick="toggleDynamicQuestionFields('${subQuestionId}', 'identifier')" id="${subQuestionId}-tab-identifier" 
                            class="px-2 py-0.5 text-[9px] font-black uppercase rounded tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer">
                            Identifier
                        </button>
                    </div>

                    <!-- ⚡ SUBDIVIDE BUTTON -->
                    <button type="button" id="${subQuestionId}-subdivide-btn" onclick="toggleSubdivideZone('${subQuestionId}')"
                        class="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:text-white text-[9px] font-black tracking-wider uppercase rounded-md transition-all flex items-center space-x-1 cursor-pointer">
                        <span>+ SUBDIVIDE</span>
                    </button>
                </div>
            </div>

            <div id="${subQuestionId}-mutable-fields-container" class="py-1">
                ${typeof generateMCQStarterTemplate === 'function' ? generateMCQStarterTemplate(`${subQuestionId}-options-grid`) : ''}
            </div>

            <div id="${subQuestionId}-variant-action-zone" class="w-full flex justify-end hidden">
                <button type="button" onclick="window.addLevelIdentifierLabelField('${subQuestionId}')" 
                    class="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer">
                    <span>+ Add Labeled Item</span>
                </button>
            </div>

            <div id="${subQuestionId}-ai-key-container" class="hidden flex flex-col space-y-1 pt-1">
                <label class="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                    <i data-lucide="cpu" class="w-3 h-3"></i>
                    <span>Sub-Question Standby AI Grading Cues</span>
                </label>
                <textarea id="${subQuestionId}-ai-cues-field" rows="2" placeholder="Define expected key clinical data parameters for this sub-tier entry (comma-separated reference keys)..." 
                    class="w-full bg-[#070d19] border border-emerald-500/10 focus:border-emerald-500/40 text-slate-300 font-medium font-mono rounded-lg p-2 text-xs focus:outline-none transition-colors resize-none"></textarea>
            </div>

            <!-- 🌿 NESTED CHILD SUBQUESTIONS (i, ii, iii) CONTAINER -->
            <div id="${subQuestionId}-child-wrapper" class="hidden pt-3 border-t border-purple-500/20 space-y-3 bg-purple-950/10 p-3 rounded-xl border">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-1">
                        <span>NESTED SUB-PARTS (i, ii, iii)</span>
                    </span>
                    <button type="button" onclick="renderChildSubQuestionFormArray('${subQuestionId}')" 
                        class="bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer">
                        + ADD PART (i, ii)
                    </button>
                </div>
                
                <div id="${subQuestionId}-child-nested-target-list" class="space-y-2.5 pl-2 border-l-2 border-purple-500/40">
                </div>
            </div>

        </div>
    `;

    targetChildList.insertAdjacentHTML('beforeend', subQuestionHTML);
    if (window.lucide) window.lucide.createIcons();
};
function appendNewSectionBlockToWorkspace() {
    const targetWorkspace = document.getElementById('quiz-composer-sections-target');
    if (!targetWorkspace) {
        alert("🚨 Workspace target container not found.");
        return;
    }

    // Clear out the pristine placeholder if it exists on screen
    const placeholder = document.getElementById('section-pristine-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    // 1. Calculate the next Section Letter dynamically by counting existing blocks
    const currentSectionsCount = targetWorkspace.querySelectorAll('.exam-section-block').length;
    const nextSectionLetter = String.fromCharCode(65 + currentSectionsCount); // 0 -> 'A', 1 -> 'B', etc.

    // 2. Create the wrapper block element
    const sectionBlock = document.createElement('div');
    sectionBlock.className = "exam-section-block border border-purple-900/40 p-6 bg-[#050b18]/40 backdrop-blur-sm rounded-xl space-y-6 mb-8 transition-all duration-300 animate-in fade-in zoom-in-95";
    sectionBlock.setAttribute('data-section-letter', nextSectionLetter);
    sectionBlock.id = `exam-section-wrap-${nextSectionLetter.toLowerCase()}`;

    // 3. Assemble the HTML Structure to match your dark terminal theme perfectly
    sectionBlock.innerHTML = `
        <div class="flex flex-col space-y-4 border-b border-slate-800 pb-4">
            <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-black tracking-widest font-mono rounded border border-purple-500/20 uppercase">
                    SECTION ${nextSectionLetter} Configuration
                </span>
                <button type="button" onclick="this.closest('.exam-section-block').remove();" class="text-[10px] text-red-400/70 hover:text-red-400 font-mono transition-colors">
                    [ Delete Section Frame ]
                </button>
            </div>

            <div class="space-y-3">
                <label class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Section Heading Title</label>
                <input type="text" class="quiz-section-title-input w-full bg-[#02060e] border border-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-600 transition-colors" 
                       placeholder="e.g., Section ${nextSectionLetter}: Clinical Case Analysis Focus...">
            </div>

            <div class="space-y-3">
                <label class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Instructions / Clinical Context (Markdown Allowed)</label>
                <textarea class="quiz-section-instructions-input w-full h-20 bg-[#02060e] border border-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-600 transition-colors resize-none" 
                          placeholder="e.g., **Instructions:** Answer a select number of questions details based on the vignette context below..."></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div class="space-y-2">
                    <label class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Section Processing Rule</label>
                    <select onchange="window.toggleAdminSectionRuleFieldsVisibility(this)" class="quiz-section-rule-mode-input w-full bg-[#02060e] border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-600 transition-colors">
                        <option value="ALL">Mandatory (Answer All Questions)</option>
                        <option value="CHOICE">Choice Matrix (Students Select Subset)</option>
                    </select>
                </div>

                <div class="admin-section-required-count-wrapper space-y-2 opacity-40 pointer-events-none transition-all duration-300">
                    <label class="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Required Answer Count</label>
                    <input type="number" min="1" class="quiz-section-required-count-input w-full bg-[#02060e] border border-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-600 transition-colors" 
                           placeholder="Leave blank to include all">
                </div>
            </div>
        </div>

        <div class="section-questions-drop-zone sub-question-registry-target space-y-6 min-h-[40px] border border-dashed border-slate-900/60 rounded-xl p-2 bg-[#02060e]/10">
        </div>
    `;

    // 4. Paint to workspace timeline
    targetWorkspace.appendChild(sectionBlock);
}
/**
 * Handles toggling structural layout inputs depending on the selected switcher button type.
 */
function toggleDynamicQuestionFields(questionId, chosenType) {
    const fieldsContainer = document.getElementById(`${questionId}-mutable-fields-container`);
    const aiKeyContainer = document.getElementById(`${questionId}-ai-key-container`);
    const actionZone = document.getElementById(`${questionId}-variant-action-zone`);
    const subQuestionNode = document.getElementById(questionId);
    
    // Sub-question / subdivide typing space elements
    const nestedSubquestionsWrap = document.getElementById(`${questionId}-nested-subquestions-wrap`);
    const childWrapper = document.getElementById(`${questionId}-child-wrapper`);
    const subdivideBtn = document.getElementById(`${questionId}-subdivide-btn`);

    if (!fieldsContainer) return;

    // 1. Clear button highlighting states (Added 'matching' to the loop cycle)
    ['mcq', 'tf', 'longAnswer', 'identifier', 'matching'].forEach(type => {
        const btn = document.getElementById(`${questionId}-tab-${type}`);
        if (btn) {
            btn.className = "px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all text-slate-400 hover:text-white cursor-pointer";
        }
    });

    // Highlight active selected state tracker
    const activeBtn = document.getElementById(`${questionId}-tab-${chosenType}`);
    if (activeBtn) {
        activeBtn.className = "px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all bg-purple-600 text-white cursor-pointer";
    }

    // Update internal reference metadata mapping index
    if (typeof currentQuizQuestionsHeap !== 'undefined') {
        const targetNode = currentQuizQuestionsHeap.find(q => q.id === questionId);
        if (targetNode) targetNode.type = chosenType;
    }

    // Default structural resetting actions
    if (aiKeyContainer) aiKeyContainer.classList.add('hidden');
    if (actionZone) actionZone.classList.add('hidden');

    // 🔒 Strictly enforce Subdivide & Sub-question typing spaces ONLY for longAnswer questions
    if (chosenType === 'longAnswer') {
        if (subdivideBtn) subdivideBtn.classList.remove('hidden');
    } else {
        if (subdivideBtn) subdivideBtn.classList.add('hidden');
        if (nestedSubquestionsWrap) nestedSubquestionsWrap.classList.add('hidden');
        if (childWrapper) childWrapper.classList.add('hidden');
    }

    // 2. Render dynamic layout fields depending on chosen strategy type
    if (chosenType === 'mcq') {
        fieldsContainer.innerHTML = typeof generateMCQStarterTemplate === 'function' 
            ? generateMCQStarterTemplate(`${questionId}-options-grid`) 
            : '';
    } else if (chosenType === 'tf') {
        fieldsContainer.innerHTML = `
            <div class="space-y-4 animate-in fade-in duration-150">
                <div class="flex items-center space-x-6 bg-[#070d19]/40 p-3 rounded-xl border border-slate-850 max-w-sm">
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select True Condition Matrix:</span>
                    <label class="flex items-center space-x-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input type="radio" name="${questionId}-tf-target" value="true" class="accent-purple-500">
                        <span>True</span>
                    </label>
                    <label class="flex items-center space-x-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input type="radio" name="${questionId}-tf-target" value="false" class="accent-purple-500">
                        <span>False</span>
                    </label>
                </div>

                <div class="flex flex-col space-y-1.5 pt-1 border-t border-slate-800/40">
                    <label class="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                        <span>Neural Insight (High-Yield Rationales & Explanations)</span>
                    </label>
                    <textarea id="${questionId}-neural-insight" rows="3" placeholder="Provide a clinical breakdown explaining why this statement holds true or false..." 
                        class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none placeholder-slate-600"></textarea>
                </div>
            </div>
        `;
    } else if (chosenType === 'longAnswer') {
        fieldsContainer.innerHTML = `
            <div class="space-y-4 animate-in fade-in duration-150">
                <div class="p-4 border border-dashed border-slate-800 bg-[#040812] rounded-xl text-slate-500 text-[11px] font-semibold tracking-wide uppercase">
                    Long Answer input frame active. Student response content text box area will present during active testing session layers.
                </div>
                
                <div class="flex flex-col space-y-1.5 pt-1 border-t border-slate-800/40">
                    <label class="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                        <span>Neural Insight (High-Yield Rationales & Explanations)</span>
                    </label>
                    <textarea id="${questionId}-neural-insight" rows="3" placeholder="Provide the gold-standard clinical case breakdown or ideal answer progression framework..." 
                        class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none placeholder-slate-600"></textarea>
                </div>
            </div>
        `;
        if (aiKeyContainer) aiKeyContainer.classList.remove('hidden');
    } 
    else if (chosenType === 'identifier') {
        fieldsContainer.innerHTML = `
            <div class="space-y-4 animate-in fade-in duration-150">
                <div class="flex items-center space-x-3 bg-[#070d19]/50 p-2 border border-slate-850/80 rounded-xl w-fit">
                    <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 pl-1">Matrix Index Style:</span>
                    <div class="flex items-center space-x-1">
                        <button type="button" 
                            id="${questionId}-marker-num"
                            onclick="document.getElementById('${questionId}').setAttribute('data-marker-type', 'numbers'); this.parentElement.querySelector('#${questionId}-marker-alpha').className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer'; this.className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white transition-all cursor-pointer'"
                            class="px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white transition-all cursor-pointer">
                            01, 02...
                        </button>
                        <button type="button" 
                            id="${questionId}-marker-alpha"
                            onclick="document.getElementById('${questionId}').setAttribute('data-marker-type', 'alphabet-caps'); this.parentElement.querySelector('#${questionId}-marker-num').className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer'; this.className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white transition-all cursor-pointer'"
                            class="px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer">
                            A, B...
                        </button>
                    </div>
                </div>

                <div id="${questionId}-identifier-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>

                <div class="flex flex-col space-y-1.5 pt-1 border-t border-slate-800/40">
                    <label class="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                        <span>Neural Insight (Anatomical Systems & Practical Breakdown)</span>
                    </label>
                    <textarea id="${questionId}-neural-insight" rows="3" placeholder="Provide a clinical synopsis of the system specimen, noting structural anomalies, blood supplies, or nerve tracks..." 
                        class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none placeholder-slate-600"></textarea>
                </div>
            </div>
        `;

        if (actionZone) {
            actionZone.innerHTML = `
                <button type="button" onclick="window.addLevelIdentifierLabelField('${questionId}')"
                    class="flex items-center space-x-2 px-3 py-1.5 border border-dashed border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer bg-[#050b18]/40">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>Add Labeled Item</span>
                </button>
            `;
            actionZone.classList.remove('hidden');
        }
        if (aiKeyContainer) aiKeyContainer.classList.remove('hidden');

        if (subQuestionNode) {
            subQuestionNode.setAttribute('data-identifier-count', '0');
            subQuestionNode.setAttribute('data-marker-type', 'numbers');
            if (typeof window.addLevelIdentifierLabelField === 'function') {
                for (let i = 0; i < 4; i++) {
                    window.addLevelIdentifierLabelField(questionId);
                }
            }
        }
    }
    // 🌟 4. THE BRAND NEW MATCHING BOARD CREATION MATRIX WORKSPACE
    else if (chosenType === 'matching') {
        fieldsContainer.innerHTML = `
            <div class="space-y-4 animate-in fade-in duration-150" data-matching-strategy="table" id="${questionId}-matching-workspace">
                
                <div class="flex items-center space-x-3 bg-[#070d19]/50 p-2 border border-slate-850 rounded-xl w-fit">
                    <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 pl-1">Matching Strategy:</span>
                    <div class="flex items-center space-x-1">
                        <button type="button" 
                            id="${questionId}-match-table-btn"
                            onclick="const ws=document.getElementById('${questionId}-matching-workspace'); ws.setAttribute('data-matching-strategy', 'table'); document.getElementById('${questionId}-pool-config-zone').classList.add('hidden'); this.className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white cursor-pointer'; document.getElementById('${questionId}-match-pool-btn').className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer'"
                            class="px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white cursor-pointer">
                            Standard Table (1-to-1)
                        </button>
                        <button type="button" 
                            id="${questionId}-match-pool-btn"
                            onclick="const ws=document.getElementById('${questionId}-matching-workspace'); ws.setAttribute('data-matching-strategy', 'pool'); document.getElementById('${questionId}-pool-config-zone').classList.remove('hidden'); this.className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white cursor-pointer'; document.getElementById('${questionId}-match-table-btn').className='px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer'"
                            class="px-2.5 py-1 text-[9px] font-black uppercase rounded-md text-slate-500 hover:text-slate-200 transition-all cursor-pointer">
                            Option Key Pool (Many-to-Few)
                        </button>
                    </div>
                </div>

                <div id="${questionId}-pool-config-zone" class="hidden flex flex-col space-y-1.5 bg-[#0a101f]/60 p-3 border border-slate-850 rounded-xl">
                    <label class="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center space-x-1.5">
                        <i data-lucide="key" class="w-3.5 h-3.5"></i>
                        <span>Option Pool Legends (Format: Token:Definition separated by commas)</span>
                    </label>
                    <input type="text" 
                        id="${questionId}-pool-definition-input"
                        placeholder="e.g., A:Asthma, E:Emphysema, CB:Chronic Bronchitis"
                        class="w-full bg-[#050b18] border border-slate-800 focus:border-purple-500/40 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none transition-all placeholder-slate-700 font-semibold">
                </div>

                <div class="space-y-2">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Setup Configuration Pairs:</label>
                    <div id="${questionId}-matching-rows-stack" class="space-y-2.5"></div>
                </div>

                <div class="flex flex-col space-y-1.5 pt-2 border-t border-slate-850">
                    <label class="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                        <span>Neural Insight (High-Yield Clinical Rationale)</span>
                    </label>
                    <textarea id="${questionId}-neural-insight" rows="3" placeholder="Provide a clinical pathology breakdown or criteria correlation summary..." 
                        class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none placeholder-slate-600"></textarea>
                </div>
            </div>
        `;

        if (actionZone) {
            actionZone.innerHTML = `
                <button type="button" onclick="window.addMatchingPairRow('${questionId}')"
                    class="flex items-center space-x-2 px-3 py-1.5 border border-dashed border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer bg-[#050b18]/40">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>Add Matching Pair Row</span>
                </button>
            `;
            actionZone.classList.remove('hidden');
        }

        const stackNode = document.getElementById(`${questionId}-matching-rows-stack`);
        if (stackNode) {
            stackNode.setAttribute('data-pair-count', '0');
            if (typeof window.addMatchingPairRow === 'function') {
                for (let i = 0; i < 4; i++) {
                    window.addMatchingPairRow(questionId);
                }
            }
        }
    }

    if (window.lucide) lucide.createIcons();
}
// Toggles the nested child typing area for subquestions & manages parent key field visibility
window.toggleSubdivideZone = function(subQuestionId) {
    const longAnswerTab = document.getElementById(`${subQuestionId}-tab-longAnswer`);
    const isLongAnswer = longAnswerTab && longAnswerTab.classList.contains('bg-purple-600');
    if (!isLongAnswer) return;

    const childWrapper = document.getElementById(`${subQuestionId}-child-wrapper`);
    const parentNeuralInsight = document.getElementById(`${subQuestionId}-neural-insight`)?.parentElement;
    const parentAiKeyContainer = document.getElementById(`${subQuestionId}-ai-key-container`);

    if (!childWrapper) return;

    const isHidden = childWrapper.classList.contains('hidden');

    if (isHidden) {
        childWrapper.classList.remove('hidden');

        // Hide parent-level generic insight & AI key fields since sub-parts hold their own
        if (parentNeuralInsight) parentNeuralInsight.classList.add('hidden');
        if (parentAiKeyContainer) parentAiKeyContainer.classList.add('hidden');

        // Auto-generate initial Roman Numeral item (i) if empty
        const targetList = document.getElementById(`${subQuestionId}-child-nested-target-list`);
        if (targetList && targetList.children.length === 0) {
            window.renderChildSubQuestionFormArray(subQuestionId);
        }
    } else {
        childWrapper.classList.add('hidden');

        // Restore parent-level generic insight & AI key fields when subdivide is collapsed
        if (parentNeuralInsight) parentNeuralInsight.classList.remove('hidden');
        if (parentAiKeyContainer) parentAiKeyContainer.classList.remove('hidden');
    }

    if (window.lucide) lucide.createIcons();
};

// Appends a new nested Roman Numeral sub-part (i, ii, iii) with its own Neural Insight & AI Model Answer Key
window.renderChildSubQuestionFormArray = function(subQuestionId) {
    const targetList = document.getElementById(`${subQuestionId}-child-nested-target-list`);
    if (!targetList) return;

    const currentCount = targetList.querySelectorAll('[data-child-sub-node="true"]').length;
    const nextIndex = currentCount + 1;
    const romanPrefix = window.getRomanNumeral(nextIndex);
    const childId = `child_${subQuestionId}_${Date.now()}_${nextIndex}`;

    const childRowHTML = `
        <div id="${childId}" class="bg-[#030712] border border-purple-500/20 rounded-xl p-4 space-y-3.5 animate-in slide-in-from-left-2 duration-150" 
            data-child-sub-node="true" 
            data-prefix-value="${romanPrefix}">
            
            <!-- 1. Sub-Part Header: Roman Badge, Stem Input, Marks, Delete -->
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
                <div class="flex items-center space-x-2 flex-1">
                    <span class="text-[10px] font-black text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded uppercase tracking-wider">
                        (${romanPrefix})
                    </span>
                    <input type="text" id="${childId}-stem-field" placeholder="Enter sub-part condition or specific prompt (e.g., Starvation)..." 
                        class="bg-transparent text-xs font-semibold text-white focus:outline-none w-full placeholder-slate-600 border-b border-transparent focus:border-amber-500/50 pb-0.5 transition-colors">
                </div>

                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-1 bg-[#070d19] border border-slate-800 rounded-lg px-2.5 py-1">
                        <input type="number" id="${childId}-marks-field" min="1" max="100" value="1" 
                            class="w-8 bg-transparent text-center text-xs font-mono font-bold text-amber-400 focus:outline-none">
                        <span class="text-[8px] font-bold text-slate-500 uppercase">Mark(s)</span>
                    </div>

                    <button type="button" onclick="document.getElementById('${childId}').remove(); if(window.lucide) lucide.createIcons();" 
                        class="text-slate-600 hover:text-rose-400 transition-colors p-1 cursor-pointer text-xs font-bold" title="Remove sub-part">
                        ✕
                    </button>
                </div>
            </div>

            <!-- 2. Sub-Part Specific: Neural Insight Field -->
            <div class="flex flex-col space-y-1.5">
                <label class="text-[9px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                    <span>Neural Insight (Sub-part (${romanPrefix}) Rationale & Clinical Explanation)</span>
                </label>
                <textarea id="${childId}-neural-insight" rows="2" placeholder="Provide clinical breakdown explaining the mechanism/rationale for part (${romanPrefix})..." 
                    class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-2.5 text-xs focus:outline-none transition-colors resize-none placeholder-slate-700"></textarea>
            </div>

            <!-- 3. Sub-Part Specific: AI Model Answer / Standby Grading Cues -->
            <div class="flex flex-col space-y-1.5">
                <label class="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <i data-lucide="cpu" class="w-3.5 h-3.5"></i>
                    <span>Sub-part (${romanPrefix}) AI Model Answer & Grading Keys</span>
                </label>
                <textarea id="${childId}-ai-cues" rows="2" placeholder="Define key phrases, expected values, or grading criteria for part (${romanPrefix}) e.g., Decreased insulin, Increased glucagon, Gluconeogenesis..." 
                    class="w-full bg-[#070d19] border border-emerald-500/20 focus:border-emerald-500/50 text-slate-300 font-mono rounded-xl p-2.5 text-xs focus:outline-none transition-colors resize-none placeholder-slate-700"></textarea>
            </div>

        </div>
    `;

    targetList.insertAdjacentHTML('beforeend', childRowHTML);
    if (window.lucide) lucide.createIcons();
};

// Helper: Roman Numeral Generator
window.getRomanNumeral = function(num) {
    const lookup = [['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]];
    let roman = '';
    for (let i of lookup) {
        while (num >= i[1]) {
            roman += i[0];
            num -= i[1];
        }
    }
    return roman || 'i';
};
window.addMatchingPairRow = function(questionId) {
    const stackNode = document.getElementById(`${questionId}-matching-rows-stack`);
    if (!stackNode) return;

    const currentCount = parseInt(stackNode.getAttribute('data-pair-count') || '0', 10) + 1;
    stackNode.setAttribute('data-pair-count', currentCount.toString());

    const rowWrapperId = `${questionId}-match-row-wrapper-${currentCount}`;
    const itemRow = document.createElement('div');
    itemRow.id = rowWrapperId;
    itemRow.className = "flex items-center space-x-2 animate-in slide-in-from-top-1 duration-100 match-row-item-node";
    itemRow.innerHTML = `
        <span class="font-mono text-[9px] text-slate-600 min-w-[14px] text-center">${currentCount.toString().padStart(2, '0')}</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <input type="text" 
                id="${questionId}-match-clue-${currentCount}" 
                placeholder="Left side clue item..." 
                class="w-full bg-[#050b18] border border-slate-850 focus:border-purple-500/30 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none placeholder-slate-700 font-medium">
            <input type="text" 
                id="${questionId}-match-target-${currentCount}" 
                placeholder="Right side exact match target value..." 
                class="w-full bg-[#050b18] border border-slate-850 focus:border-purple-500/30 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none placeholder-slate-700 font-medium">
        </div>
        <button type="button" onclick="document.getElementById('${rowWrapperId}').remove()" 
            class="text-slate-600 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
    `;

    stackNode.appendChild(itemRow);
    if (window.lucide) lucide.createIcons();
};

// 🌟 GLOBAL HELPER ENGINE: Dynamically appends numbered items to specific sub-questions
window.addLevelIdentifierLabelField = function(questionId) {
    const gridContainer = document.getElementById(`${questionId}-identifier-grid`);
    const subQuestionNode = document.getElementById(questionId);
    if (!gridContainer || !subQuestionNode) return;

    // Safely increment count value parsed out of node state attribute
    let currentCount = parseInt(subQuestionNode.getAttribute('data-identifier-count') || '0', 10);
    currentCount++;
    subQuestionNode.setAttribute('data-identifier-count', currentCount.toString());

    const fieldHTML = `
        <div class="bg-[#070d19]/60 border border-slate-850 p-3 rounded-xl flex items-center space-x-3 transition-all focus-within:border-purple-500/30 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <span class="text-purple-400 font-mono font-black text-xs min-w-[16px]">${currentCount}</span>
            <input type="text" id="${questionId}-identifier-target-${currentCount}" 
                placeholder="Enter gold-standard anatomical label..." 
                class="w-full bg-transparent text-slate-200 text-xs font-semibold focus:outline-none placeholder-slate-700">
        </div>
    `;

    gridContainer.insertAdjacentHTML('beforeend', fieldHTML);
};
// ==========================================

/**
 * Generates the default starter set of MCQ fields (A, B, C, D) along with the expansion button loop.
 */
function generateMCQStarterTemplate(uniqueContainerId) {
    const radioGroupName = uniqueContainerId.replace('-options-grid', '-correct-target');
    // Derive a unique ID for the explanation field based on the container ID
    const explanationId = uniqueContainerId.replace('-options-grid', '-neural-insight');
    
    return `
        <div class="space-y-4 animate-in fade-in duration-150">
            <div id="${uniqueContainerId}" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex items-center space-x-2 bg-[#070d19] border border-slate-800/80 rounded-xl px-3 py-1">
                    <span class="text-[10px] font-black text-purple-400 font-mono">A</span>
                    <input type="text" placeholder="Option alpha context" class="w-full bg-transparent p-2 text-xs text-slate-200 focus:outline-none">
                    <input type="radio" name="${radioGroupName}" class="accent-purple-500">
                </div>
                <div class="flex items-center space-x-2 bg-[#070d19] border border-slate-800/80 rounded-xl px-3 py-1">
                    <span class="text-[10px] font-black text-purple-400 font-mono">B</span>
                    <input type="text" placeholder="Option beta context" class="w-full bg-transparent p-2 text-xs text-slate-200 focus:outline-none">
                    <input type="radio" name="${radioGroupName}" class="accent-purple-500">
                </div>
                <div class="flex items-center space-x-2 bg-[#070d19] border border-slate-800/80 rounded-xl px-3 py-1">
                    <span class="text-[10px] font-black text-purple-400 font-mono">C</span>
                    <input type="text" placeholder="Option gamma context" class="w-full bg-transparent p-2 text-xs text-slate-200 focus:outline-none">
                    <input type="radio" name="${radioGroupName}" class="accent-purple-500">
                </div>
                <div class="flex items-center space-x-2 bg-[#070d19] border border-slate-800/80 rounded-xl px-3 py-1">
                    <span class="text-[10px] font-black text-purple-400 font-mono">D</span>
                    <input type="text" placeholder="Option delta context" class="w-full bg-transparent p-2 text-xs text-slate-200 focus:outline-none">
                    <input type="radio" name="${radioGroupName}" class="accent-purple-500">
                </div>
            </div>
            
            <div class="flex justify-end">
                <button onclick="addOptionVariantToMCQ('${uniqueContainerId}')" type="button"
                    class="px-2.5 py-1 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center space-x-1">
                    <i data-lucide="list-plus" class="w-3 h-3 text-purple-400"></i>
                    <span>Add Option Variant</span>
                </button>
            </div>

            <div class="flex flex-col space-y-1.5 pt-1 border-t border-slate-800/40">
                <label class="text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
                    <span>Neural Insight (High-Yield Rationales & Explanations)</span>
                </label>
                <textarea id="${explanationId}" rows="3" placeholder="Provide a deep clinical breakdown of why the correct option is selected, and rule out the key distractors..." 
                    class="w-full bg-[#070d19] border border-slate-800 focus:border-purple-500/40 text-slate-300 rounded-xl p-3 text-xs focus:outline-none transition-colors resize-none placeholder-slate-600"></textarea>
            </div>
        </div>
    `;
}

/**
 * Helper to dynamically append a new alphabetical option field (A, B, C, D, E, F...) to an MCQ block.
 */
function addOptionVariantToMCQ(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const currentOptionsCount = container.children.length;
    const optionLetter = String.fromCharCode(65 + currentOptionsCount);
    
    if (currentOptionsCount >= 26) return; // Prevent breaking past Z

    const radioGroupName = containerId.replace('-options-grid', '-correct-target');

    const optionHTML = `
        <div class="flex items-center space-x-2 bg-[#070d19] border border-slate-800/80 rounded-xl px-3 py-1 animate-in zoom-in-95 duration-150">
            <span class="text-[10px] font-black text-purple-400 font-mono">${optionLetter}</span>
            <input type="text" placeholder="Option variant context" class="w-full bg-transparent p-2 text-xs text-slate-200 focus:outline-none">
            <input type="radio" name="${radioGroupName}" class="accent-purple-500">
        </div>
    `;

    container.insertAdjacentHTML('beforeend', optionHTML);
}
/**
 * Reads any native PC image path and ingests it into memory as an optimized base64 string string payload.
 */
async function handleQuizImageIngestion(eventOrInput, questionId) {
    // 1. Prevent default form submission & event bubbling if invoked via inline event
    if (eventOrInput && typeof eventOrInput.preventDefault === 'function') {
        eventOrInput.preventDefault();
        eventOrInput.stopPropagation();
    }

    // 2. Resolve input element target flexibly (handles both 'event' and 'this' references)
    const inputElement = eventOrInput?.target || eventOrInput;
    const previewBox = document.getElementById(`${questionId}-preview-box`);
    
    if (!inputElement || !inputElement.files || !inputElement.files[0] || !previewBox) return;

    const chosenFile = inputElement.files[0];

    // 3. Immediate local UI preview using ObjectURL (no Base64 lag)
    const localPreviewUrl = URL.createObjectURL(chosenFile);
    previewBox.innerHTML = `
        <div class="flex items-center gap-2">
            <img src="${localPreviewUrl}" class="max-h-14 max-w-full rounded border border-purple-500/30 object-contain shadow-md opacity-50">
            <span class="text-purple-400 font-bold animate-pulse text-[9px]">Uploading Diagram...</span>
        </div>
    `;

    try {
        // 4. Stream raw binary file directly to FastAPI endpoint
        const formData = new FormData();
        formData.append('file', chosenFile);

        const response = await fetch('http://127.0.0.1:8000/upload-diagram', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        // 5. Build absolute URL pointing to FastAPI (prevents Live Server 5501 relative 404s)
        const rawUrl = data.image_url;
        const serverImageUrl = rawUrl.startsWith('http') 
            ? rawUrl 
            : `http://127.0.0.1:8000${rawUrl}`;

        // 6. Update memory heap pointer with absolute static URL
        const targetNode = currentQuizQuestionsHeap.find(q => q.id === questionId);
        if (targetNode) {
            targetNode.image_url = serverImageUrl;
            delete targetNode.imageBase64; // Clear legacy Base64 key if present
        }

        // 7. Update DOM attribute context node with absolute static URL
        const parentQuestionCard = document.getElementById(questionId);
        if (parentQuestionCard) {
            parentQuestionCard.setAttribute('data-attached-image', serverImageUrl);
        }

        // 8. Finalize UI Preview State
        previewBox.innerHTML = `
            <img src="${serverImageUrl}" class="max-h-14 max-w-full rounded border border-purple-500/30 object-contain shadow-md">
        `;

        console.log(`Diagram uploaded and linked successfully for question ${questionId}: ${serverImageUrl}`);

    } catch (error) {
        console.error(`Failed to ingest diagram for ${questionId}:`, error);
        previewBox.innerHTML = `<span class="text-red-400 font-bold text-[9px]">Upload Failed</span>`;
    }
}
// Exit clean up loop to return home and put student links back
function exitAdminHub() {
    // 1. Restore Admin Hub Trigger button in header
    const headerCenter = document.getElementById('header-center');
    if (headerCenter) {
        headerCenter.innerHTML = `
            <button onclick="showAdminHub()" 
                class="bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase">
                Admin Hub
            </button>
        `;
    }
    
    // 2. Re-render student programmatic links inside side dock
    renderStudentSidebar();
    
    // 3. Clear workspace canvas right side
    resetRightCanvas();
}
// Render the Student Academic Navigation Links in the sidebar

// Reset the right-hand area back to default welcome view
function resetRightCanvas() {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    contentArea.className = "flex-1 h-full flex items-center justify-center p-8 overflow-y-auto";
    contentArea.innerHTML = `
        <div class="text-center">
            <p class="text-[10px] text-slate-600 uppercase font-black tracking-[0.6em] animate-pulse mb-2">System Active</p>
            <p class="text-slate-500 text-[11px]">Select an academic program from the left terminal to initialize</p>
        </div>
    `;
}
// ==========================================
// ADMIN WORKSPACE BACKEND HANDSHAKE LOGIC
// ==========================================




function updateAdminNotesDropdowns(changedElementId) {
    // 🔍 1. SELF-CONTAINED LOCAL MATRIX MAP DEFINITION
    // This removes all dependency on global variable execution windows!
    const localCurriculumMatrix = {
        "mbchb": {
            name: "MBCHB, BDS and CM",
            years: {
                2: ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Therapeutics', 'Clinical Science', 'Laboratory Science', 'Diagnostics', 'Society and Medicine', 'Public Health'],
                3: ['Anatomy-(iii)', 'Physiology-(iii)', 'Biochemistry-(iii)', 'Pathology-(iii)', 'Therapeutics-(iii)', 'Clinical Science-(iii)', 'Laboratory Science-(iii)', 'Diagnostics-(iii)', 'Society and Medicine-(iii)', 'Public Health-(iii)']
            }
        },
        "biomedical": {
            name: "Biomedical Science",
            years: {
                2: ['Introduction to Biomedical Science', 'Introduction to Human Anatomy', 'Introduction to Medical Physiology', 'Introduction to Medical Microbiology', 'General Biochemistry'],
                3: ['Society and Medicine-(ii)', 'Histology', 'Physiology-(ii)', 'Parasitology', 'Virology/Mycology', 'Biochemistry-(ii)', 'Molecular and Cell Biology', 'Bacteriology'],
                4: ['Public Health-(iv)', 'General and Systematic Pathology', 'Pharmacology, Therapeutics and Toxicology', 'Immunology', 'Medical Genetics', 'Biostatics', 'Haematology and Blood Transfusion', 'Research and Methodology'],
                5: ['Skills in Laboratory Management', 'Medical Teaching Methodology', 'Cellular Pathology', 'Clinical Biochemistry', 'Research Project']
            }
        },
        "public-health": {
            name: "Public Health",
            years: {
                2: ['Primary Health Care-(ii)', 'Microbiology-(ii)', 'Health Promotion-(ii)', 'Human Anatomy-(ii)', 'Human Physiology-(ii)', 'Environmental Health-(ii)'],
                3: ['Psychology and Medicine', 'Epidemiology-(iii)', 'Food Technology and Hygiene-(iii)', 'Monitoring and Evaluation', 'Research and Biostatistics'],
                4: ['Emerging Public Health Issues', 'Occupational Health and Ergonomics-(iv)', 'Food and Nutrition-(iv)', 'Research Project and Data Management-(iv)', 'Industrial Attachment'],
                5: ['Global Health', 'Health Policies and Economics', 'Medical Parasitology-(v)', 'Health System, Management II and Health Promotion II', 'Basic Pharmacology and Toxicology-(v)']
            }
        },
        "environmental": {
            name: "Environmental Health",
            years: {
                2: ['Principles of Building and Construction', 'Primary Health Care', 'Environmental Health', 'Microbiology', 'Human Anatomy', 'Human Physiology'],
                3: ['Biostatistics and Research', 'Food Animal Anatomy and Slaughter Houses', 'Epidemiology', 'Food Technology and Hygiene', 'Building Development and Planning'],
                4: ['Occupational Health and Ergonomics', 'Industrial Training', 'Food Animal Pathology and Meat Inspection', 'Food and Nutrition', 'Inspection of Premises and Reporting', 'Research Project and Data Management'],
                5: ['Environmental Economics, Management, Laws and Policies', 'Medical Parasitology', 'Occupational Health and Risk Analysis', 'Food Processing and Inspection', 'Basic Pharmacology and Toxicology', 'Environmental Health', 'Introduction to Public Health']
            }
        }
    };

    // 🔍 2. DOM ELEMENT FALLBACK TARGETING
    const progSelect = document.getElementById('note-program') || document.getElementById('router-program-select');
    const yearSelect = document.getElementById('note-year') || document.getElementById('router-year-select');
    const courseSelect = document.getElementById('note-course') || document.getElementById('router-course-select');

    // Safe exit if elements aren't painted on screen yet
    if (!progSelect || !yearSelect || !courseSelect) {
        console.warn("Dropdown components missing from current view state.");
        return;
    }

    const selectedProg = progSelect.value;
    console.log("Admin Router Event -> Evaluated Program Code Key:", selectedProg);

    // If program is cleared out
    if (!selectedProg) {
        yearSelect.innerHTML = '<option value="">-- Select --</option>';
        courseSelect.innerHTML = '<option value="">-- Select --</option>';
        yearSelect.disabled = true;
        courseSelect.disabled = true;
        return;
    }

    // Lookup data from the local map matrix safely
    const progData = localCurriculumMatrix[selectedProg];
    if (!progData) {
        console.error(`Key "${selectedProg}" could not be cross-referenced.`);
        return;
    }

    // 🔍 3. CASCADE ENGINE REFRESH
    // Rebuild years list if the program just changed, or if the year is unpopulated
    if (!changedElementId || changedElementId === progSelect.id || !yearSelect.value) {
        let yearOptions = '<option value="">-- Select --</option>';
        for (let y in progData.years) {
            yearOptions += `<option value="${y}">Year 0${y}</option>`;
        }
        yearSelect.innerHTML = yearOptions;
        yearSelect.disabled = false;
        
        courseSelect.innerHTML = '<option value="">-- Select --</option>';
        courseSelect.disabled = true;
    }

    // Rebuild course modules list based on selected year
    const selectedYear = yearSelect.value;
    console.log("Admin Router Event -> Evaluated Academic Year Key:", selectedYear);

    if (selectedYear && progData.years[selectedYear]) {
        const courses = progData.years[selectedYear];
        let courseOptions = '<option value="">-- Select --</option>';
        courses.forEach(c => {
            courseOptions += `<option value="${c}">${c}</option>`;
        });
        courseSelect.innerHTML = courseOptions;
        courseSelect.disabled = false;
    } else {
        courseSelect.innerHTML = '<option value="">-- Select --</option>';
        courseSelect.disabled = true;
    }
}
// 🚀 BACKEND FILE DEPLOYMENT ROUTER: PROCESSES & BINDS PDF STRINGS TO STORAGE REGISTRIES
// 🛡️ Safely attach to window immediately so it bypasses file-compilation crashes
window.publishLectureHandoutDocument = function() {
    console.log("🎬 Initiating Handout Document Validation & Deployment Sequence...");

    const progSelect = document.getElementById('note-program');
    const yearSelect = document.getElementById('note-year');
    const courseSelect = document.getElementById('note-course');
    const termSelect = document.getElementById('note-term');

    if (!progSelect || !yearSelect || !courseSelect || !termSelect) {
        alert("Deployment Error: One or more dropdowns are missing from the DOM.");
        return;
    }

    const selectedProgram = progSelect.value;
    const selectedYear = yearSelect.value;
    const selectedCourse = courseSelect.value;
    const selectedTerm = termSelect.value;

    if (!selectedProgram || !selectedYear || !selectedCourse || !selectedTerm) {
        alert("Route Pending: Please populate all parameters before attempting publication.");
        return;
    }

    const titleInput = document.getElementById('note-title');
    const fileInput = document.getElementById('notes-file-input');

    if (!titleInput || !fileInput) {
        alert("Compositor Fault: Input targets could not be compiled.");
        return;
    }

    const topicTitleValue = titleInput.value.trim();
    const targetFile = fileInput.files[0];

    if (!topicTitleValue) {
        alert("Parameter Blank: Please supply a descriptive 'Topic Title Name'.");
        titleInput.focus();
        return;
    }

    if (!targetFile) {
        alert("Payload Missing: Please attach a valid PDF document file.");
        return;
    }

    if (targetFile.type !== "application/pdf" && !targetFile.name.toLowerCase().endsWith('.pdf')) {
        alert("Format Conflict: Only PDF documents are authorized.");
        return;
    }

    console.log(`⏳ Converting asset: "${targetFile.name}" to Base64...`);

    const assetReader = new FileReader();
    assetReader.onload = function(event) {
        try {
            const base64DataStream = event.target.result;
            let programPrefix = selectedProgram.toLowerCase().trim();

            if (programPrefix.includes("biomed")) programPrefix = "biomed";
            else if (programPrefix.includes("pub")) programPrefix = "pubhealth";
            else if (programPrefix.includes("env")) programPrefix = "envhealth";
            else if (programPrefix.includes("mbchb")) programPrefix = "mbchb";

            const compositeTrackingKey = `${programPrefix}_${selectedYear}`; 
            
            const internalDocumentPayload = {
                program: selectedProgram,
                year: selectedYear,
                term: selectedTerm,
                courseModule: selectedCourse,
                storageKey: compositeTrackingKey,
                fileName: targetFile.name,
                fileData: base64DataStream,
                timestamp: new Date().toISOString()
            };

            const dbPayload = {
                title: topicTitleValue,
                content: JSON.stringify(internalDocumentPayload),
                patient_id: null 
            };
            
            console.log("🚀 Transporting data packets to Python FastAPI server...");

            fetch("http://127.0.0.1:8000/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dbPayload)
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
                return response.json();
            })
            .then(savedData => {
                console.log("📦 Transaction successfully written to registry ID:", savedData.id);
                alert(`🎉 Success!\n"${topicTitleValue.toUpperCase()}" has been published directly to the database.`);

                titleInput.value = "";
                fileInput.value = "";
                
                const statusText = document.getElementById('upload-status-text');
                const dropzone = document.getElementById('pdf-dropzone');
                if (statusText && dropzone) {
                    statusText.innerText = "Click or drag a PDF document file to this sector";
                    dropzone.className = "relative w-full border border-dashed border-slate-800 hover:border-purple-500/30 rounded-xl bg-[#070e1e]/50 transition-all cursor-pointer p-8 text-center group";
                }
            })
            .catch(networkError => {
                console.error("Transmission breakdown:", networkError);
                alert("Server Write Fault: Could not connect to the Python backend.");
            });

        } catch (runtimeError) {
            console.error("Critical storage thread crash:", runtimeError);
        }
    };

    assetReader.readAsDataURL(targetFile);
};
// 4. Real-time Live Notes Formatting Engine

function renderStudentAssessmentPortal() {
    const contentArea = document.getElementById('dashboard-content'); 
    if (!contentArea) return;

    // Direct binding: ensure course context uppercase strings match your hub selections
    const currentCourseName = currentSelection.course || "Anatomy";
    
    // Safely match program strings to lowercase format used by compileAndSaveQuizConfiguration()
    const finalProgram = (currentSelection.program || localStorage.getItem('active_program') || 'mbchb').toLowerCase();
    const finalYear = currentSelection.year || localStorage.getItem('active_year') || '2';

    const totalSlots = [1, 2, 3, 4, 5];

    const assessmentSlots = totalSlots.map(slotId => {
        const storageKey = `quiz_${finalProgram}_${finalYear}_slot${slotId}`;
        const storedManifest = localStorage.getItem(storageKey);
        
        let displayTitle = `CLINICAL LIBRARY SLOT 0${slotId}`;
        let isLive = false;

        if (storedManifest) {
            try {
                const parsed = JSON.parse(storedManifest);
                // Only mark live and update text if a valid custom title exists and isn't a test placeholder
                if (parsed.quizTitle && parsed.quizTitle.trim() !== "" && !parsed.quizTitle.toUpperCase().includes("TESTING")) {
                    displayTitle = parsed.quizTitle.toUpperCase();
                    isLive = true;
                } else if (parsed.examDataStructure && parsed.examDataStructure.length > 0) {
                    // Safe fallback: if data is present but title is blank/placeholder
                    displayTitle = `LIVE PAPER — SLOT 0${slotId}`;
                    isLive = true;
                }
            } catch(e) {
                console.error("Error reading storage map alignment indices:", e);
            }
        }

        return {
            id: slotId,
            title: displayTitle,
            isLive: isLive
        };
    });

    // 🎨 UI CONTAINER MARKUP — Locked directly into Screenshot 928 parameters
    const listMarkup = `
        <div class="flex flex-col space-y-3 w-full">
            ${assessmentSlots.map(slot => `
                <div id="slot-card-${slot.id}" class="flex items-center justify-between bg-[#050b18]/85 border ${slot.isLive ? 'border-purple-500/30 bg-purple-950/5' : 'border-slate-800/40'} rounded-xl p-4 hover:border-purple-500/40 shadow-sm hover:shadow-[0_0_20px_-5px_rgba(147,51,234,0.1)] transition-all group w-full">
                    <div class="flex items-center space-x-4">
                        <div class="p-2.5 ${slot.isLive ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-500'} rounded-lg transition-colors">
                            <i data-lucide="${slot.isLive ? 'file-text' : 'folder'}" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-xs font-black text-slate-200 tracking-wide uppercase group-hover:text-white transition-colors">${slot.title}</h3>
                            <div class="flex items-center space-x-2 mt-0.5">
                                <span class="text-[9px] font-mono font-bold text-slate-500 uppercase">ID: LN-LIB-0${slot.id}</span>
                                ${slot.isLive ? `<span class="text-[8px] bg-purple-500/20 text-purple-300 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">Live Paper</span>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <button onclick="window.startActiveQuizEngine('${finalProgram}', '${finalYear}', '${slot.id}')" 
                        class="px-4 py-1.5 bg-[#0a1224] hover:bg-purple-600 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-800 hover:border-purple-500 transition-all transform active:scale-98 shadow-sm cursor-pointer">
                        Configure & Launch
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6 px-4">
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between w-full">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${currentCourseName} &mdash; Assessments</h2>
                    <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Select active file bank to initialize interactive clinical session</p>
                </div>
                
                <button onclick="selectCourse('${currentCourseName}')" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2 cursor-pointer">
                    <span>&larr; Back to Hub</span>
                </button>
            </div>

            ${listMarkup}
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}


window.startActiveQuizEngine = function(programId, yearId, slotNum) {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // Resolve structural parameters cleanly
    let finalProgram = programId || window.currentProgram || localStorage.getItem('active_program') || 'mbchb';
    let finalYear = yearId || window.currentYear || localStorage.getItem('active_year') || '2';
    let finalSlot = slotNum || '1';

    // FORCE DYNAMIC HEADER FIX
    let assessmentHeadingTitle = `SLOT 0${finalSlot} &mdash; AVAILABLE PAPER`;
    
    const finalStorageKey = `quiz_${String(finalProgram).toLowerCase()}_${finalYear}_slot${finalSlot}`;
    const storedData = localStorage.getItem(finalStorageKey);
    
    let dynamicQuestionPool = [];
    let examDataStructure = [];

    if (storedData) {
        try {
            const parsedBundle = JSON.parse(storedData);
            if (parsedBundle.examDataStructure) {
                examDataStructure = parsedBundle.examDataStructure;
                examDataStructure.forEach(sec => {
                    if (sec.questions) dynamicQuestionPool = dynamicQuestionPool.concat(sec.questions);
                });
            } else if (parsedBundle.questions) {
                dynamicQuestionPool = parsedBundle.questions;
            }
        } catch(e) {
            console.error("Data bundle tracking array read error:", e);
        }
    }

    // Overwrite workspace view layout - BIG OUTER CONTAINER BOX REMOVED
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6 px-4">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between w-full">
                <div>
                    <h2 id="active-quiz-header-title" class="text-xl font-black text-white uppercase tracking-wider">${assessmentHeadingTitle}</h2>
                    <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Active Clinical Examination Workspace</p>
                </div>
                <button onclick="if(typeof selectCourse === 'function') { selectCourse(window.currentSelection.course); } else if(typeof renderAssessmentsView === 'function') { renderAssessmentsView(); }" 
    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2">
    <span>← Back to Slots</span>
</button>
            </div>

            <div id="active-quiz-questions-portal" class="w-full space-y-3">
                Initializing examination data modules...
            </div>
        </div>
    `;

    // Safe layout component linking
    try {
        if (typeof renderTargetQuizBlueprintCards === "function") {
            renderTargetQuizBlueprintCards(examDataStructure, dynamicQuestionPool);
        }
    } catch (linkageError) {
        console.warn("Handled inner linkage bypass constraint:", linkageError.message);
    }

    if (window.lucide) window.lucide.createIcons();
};

// =========================================================
// CLOSE WORKSPACE RESET: RETURN BACK TO THE SLOT MATRIX
// =========================================================
window.closeQuizLauncherOverlay = function() {
    console.log("🧼 Returning to assessments list layout stream...");
    renderStudentAssessmentPortal();
};



function deletePathAQuestionBlock(slotId, index) {
    const savedData = localStorage.getItem(`admin_questions_${slotId}`);
    if (!savedData) return;

    try {
        let questions = JSON.parse(savedData);
        questions.splice(index, 1);
        localStorage.setItem(`admin_questions_${slotId}`, JSON.stringify(questions));
        
        // Fast refresh the overlay list frame view
        startActiveQuizEngine(slotId);
    } catch(e) {
        console.error("Data block drop error log context:", e);
    }
}
window.renderTargetQuizBlueprintCards = function(examDataStructure, dynamicQuestionPool) {
    // 🎯 TARGET STANDARD WORKSPACE PORTAL
    const portalContainer = document.getElementById('active-quiz-questions-portal');
    if (!portalContainer) return;

    portalContainer.removeAttribute('style');
    portalContainer.className = "w-full space-y-3 mt-4"; 

    // 🗺️ THE SINGLE SOURCE OF TRUTH ACADEMIC MAP MATRIX (ALIGNED WITH ADMIN HUB TOKENS)
    const ACADEMIC_MAP = {
        'mbchb_2': ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Therapeutics', 'Clinical Science', 'Laboratory Science', 'Diagnostics', 'Society and Medicine', 'Public Health'],
        'mbchb_3': ['Anatomy-(iii)', 'Physiology-(iii)', 'Biochemistry-(iii)', 'Pathology-(iii)', 'Therapeutics-(iii)', 'Clinical Science-(iii)', 'Laboratory Science-(iii)', 'Diagnostics-(iii)', 'Society and Medicine-(iii)', 'Public Health-(iii)'],
        
        // Biomedical Science Tracks (Aligned to 'biomedical')
        'biomedical_2': ['Introduction to Biomedical Science', 'Introduction to Human Anatomy', 'Introduction to Medical Physiology', 'Introduction to Medical Microbiology', 'General Biochemistry'],
        'biomedical_3': ['Society and Medicine-(ii)', 'Histology', 'Physiology-(ii)', 'Parasitology', 'Virology/Mycology', 'Biochemistry-(ii)', 'Molecular and Cell Biology', 'Bacteriology'],
        'biomedical_4': ['Public Health-(iv)', 'General and Systematic Pathology', 'Pharmacology, Therapeutics and Toxicology', 'Immunology', 'Medical Genetics', 'Biostatics', 'Haematology and blood Transfusion', 'Research and Methodology'],
        'biomedical_5': ['Skills in Laboratory Management', 'Medical Teaching Methodology', 'Cellular Pathology', 'Clinical Biochemistry', 'Research Project'],
        
        // Public Health Tracks (Aligned to 'public-health')
        'public-health_2': ['Primary Health Care-(ii)', 'Microbiology-(ii)', 'Health Promotion-(ii)', 'Human Anatomy-(ii)', 'Human Physiology-(ii)', 'Environmental Health-(ii)'],
        'public-health_3': ['Psychology and Medicine', 'Epidemiology-(iii)', 'Food Technology and Hygiene-(iii)', 'Monitoring and Evaluation', 'Research and Biostatistics'],
        'public-health_4': ['Emerging Public Health Issues', 'Occupational Health and Ergonomics-(vi)', 'Food and Nutrition-(iv)', 'Research Project and Data Management-(iv)', 'Industrial Attachment'],
        'public-health_5': ['Global Health', 'Health Policies and Economics', 'Medical Parasitology-(v)', 'Health System, Management II and Health Promotion II', 'Basic Pharmacology and Toxicology-(v)'],
        
        // Environmental Health Tracks (Aligned to 'environmental')
        'environmental_2': ['Principles of Building and Construction', 'Primary Health Care', 'Environmental Health', 'Microbiology', 'Human Anatomy', 'Human Physiology'],
        'environmental_3': ['Biostatistics and Research', 'Food Animal Anatomy and Slaughter Houses', 'Epidemiology', 'Food Technology and Hygiene', 'Building Development and Planning'],
        'environmental_4': ['Occupational Health and Ergonomics', 'Industrial Training', 'Food Animal Pathology and Meat Inspection', 'Food and Nutrition', 'Inspection of Premises and Reporting', 'Research Project and Data Management'],
        'environmental_5': ['Environmental Economics, Management, Laws and Policies', 'Medical Parasitology', 'Occupational Health and Risk Analysis', 'Food Processing and Inspection', 'Basic Pharmacology and Toxicology', 'Environmental Health', 'Introduction to Public Health']
    };

    // 1. DETERMINE CURRENT SELECTION CONTEXTS Safely
    const activeCourseRaw = ((window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Anatomy').trim();
    const rawYear = String((window.currentSelection && window.currentSelection.year) || localStorage.getItem('active_year') || '2').trim();
    const activeSlot = String((window.currentSelection && window.currentSelection.slotId) || '').trim();

    // Clean up active choices for robust, case-insensitive comparison
    const activeCourseClean = activeCourseRaw.toLowerCase().trim();
    const cleanYearDigits = rawYear.replace(/\D/g, '');
    const activeYear = cleanYearDigits ? cleanYearDigits : "2";

    // 🛡️ READ EXPLICIT SIDEBAR PROGRAM IF AVAILABLE
    const explicitProgram = ((window.currentSelection && window.currentSelection.program) || localStorage.getItem('active_program') || '').toLowerCase().trim();

    // 2. RUN FLATTENED REVERSE LOOKUP ENGINE
    let matchedKeyCombo = '';

    if (activeCourseClean) {
        for (const mapKey of Object.keys(ACADEMIC_MAP)) {
            const cleanMappedCourses = ACADEMIC_MAP[mapKey].map(c => c.toLowerCase().trim());
            
            if (cleanMappedCourses.includes(activeCourseClean)) {
                if (mapKey.endsWith(`_${activeYear}`)) {
                    if (explicitProgram) {
                        const cleanExplicit = explicitProgram.replace(/[^a-z]/g, '');
                        const cleanMapKey = mapKey.replace(/[^a-z_]/g, '');
                        if (cleanMapKey.includes(cleanExplicit) || cleanExplicit.includes(cleanMapKey.split('_')[0])) {
                            matchedKeyCombo = mapKey;
                            break;
                        }
                    }
                    matchedKeyCombo = mapKey;
                }
                
                if (!matchedKeyCombo) {
                    matchedKeyCombo = mapKey;
                }
            }
        }
    }

    let activeProg = 'mbchb';
    let finalYear = activeYear;

    if (matchedKeyCombo) {
        const lastUnderscoreIndex = matchedKeyCombo.lastIndexOf('_');
        activeProg = matchedKeyCombo.substring(0, lastUnderscoreIndex);
        finalYear = matchedKeyCombo.substring(lastUnderscoreIndex + 1);
    } else {
        if (explicitProgram) {
            if (explicitProgram.includes('biomed')) activeProg = 'biomedical';
            else if (explicitProgram.includes('public') || explicitProgram.includes('pub')) activeProg = 'public-health';
            else if (explicitProgram.includes('environ') || explicitProgram.includes('env')) activeProg = 'environmental';
        }
    }

    const activeCourse = activeCourseClean;

    // 🎯 THE PERFECT KEY HARMONIZATION MATCH
    const cleanSlot = activeSlot.toLowerCase().replace(/\s+/g, '');
    const storageKey = `assessment_${activeProg}_${finalYear}_${activeCourse}_${cleanSlot}`;

    // Helper to compile component rows into HTML output directly
    const buildInterfaceLayout = (quizCollectionArray) => {
        if (!quizCollectionArray || quizCollectionArray.length === 0) {
            portalContainer.innerHTML = `
                <div class="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                    <p class="text-xs text-slate-500 uppercase tracking-wider">No active assessment blueprints published to this slot workspace...</p>
                    <p class="text-[9px] text-slate-600 font-mono mt-1 selection:bg-transparent">Target SQL Schema Scope Identifier: ${storageKey}</p>
                </div>
            `;
            return;
        }

        // 🛡️ READ CURRENT SESSION ASSIGNED IDENTITY PRIVILEGE LEVEL
        const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
        const isAdmin = (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN');

        // 4. GENERATE CLEAN CLICKABLE COMPONENT ROWS
        let completeHTMLOutput = "";

        quizCollectionArray.forEach((quizItem, dynamicIndex) => {
            let rawTitleText = quizItem.quizTitle || quizItem.title || "ASSIGNED ASSESSMENT PAPER";
            let cleanTitle = rawTitleText.toUpperCase();
            if (!/^\d+/.test(cleanTitle)) {
                const currentItemNumber = String(dynamicIndex + 1).padStart(2, '0');
                cleanTitle = `${currentItemNumber}. ${cleanTitle}`;
            }

            // Dynamically add visibility classes to delete module based on admin privileges
            const hideClass = isAdmin ? "" : "hidden";
            const inlineStyle = isAdmin ? "" : "style='display: none;'";

            completeHTMLOutput += `
                <div class="w-full flex items-center justify-between space-x-3 animate-in fade-in duration-200">
                    <div onclick="window.launchTargetAssessmentInstance('${storageKey}', ${dynamicIndex})"
                        class="flex items-center space-x-4 bg-[#050b18]/40 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 w-full transition-all duration-200 cursor-pointer group active:scale-[0.99]">
                        <div class="text-slate-500 group-hover:text-purple-400 transition-colors pl-1">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <span class="text-xs font-black text-slate-200 group-hover:text-white transition-colors uppercase tracking-wide selection:bg-transparent">
                                ${cleanTitle}
                            </span>
                        </div>
                    </div>

                    <button onclick="window.purgeIndividualQuizSlotItem('${storageKey}', ${dynamicIndex})"
                        class="${hideClass} p-4 bg-[#050b18]/40 border border-slate-800/80 hover:border-red-500/40 text-slate-500 hover:text-red-400 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer group hover:bg-red-950/10"
                        ${inlineStyle}
                        title="Purge Specified Assessment Item">
                        <i data-lucide="trash-2" class="w-4 h-4 transition-transform group-active:scale-90"></i>
                    </button>
                </div>
            `;
        });

        portalContainer.innerHTML = completeHTMLOutput;
        if (window.lucide) window.lucide.createIcons();
    };

    // Optimization check: If cache already holds data items from a deletion sequence, shortcut directly to layout build
    if (window.cachedQuizBlueprints && window.cachedQuizBlueprints[storageKey]) {
        buildInterfaceLayout(window.cachedQuizBlueprints[storageKey]);
        return;
    }

    console.log(`📡 Isolate Scanner active. Querying live PostgreSQL context records for: "${storageKey}"`);

    // Loading/Warming Spinner Matrix state representation
    portalContainer.innerHTML = `
        <div class="text-center py-12 font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            <span class="inline-block animate-spin mr-2">⏳</span> Synchronizing live records from PostgreSQL cluster...
        </div>
    `;

    // Target dynamic note ID context (matches targetNoteId in compilation sequence)
    const targetNoteId = 1;

    // 3. RETRIEVE RE-BALANCED ARRAY DATA REPOSITORY DIRECTLY FROM PYTHON FASTAPI BACKEND
    fetch(`http://127.0.0.1:8000/notes/${targetNoteId}/assessments`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP network response failure: ${response.status}`);
            return response.json();
        })
        .then(databaseQuizzes => {
            let fetchedItems = Array.isArray(databaseQuizzes) ? databaseQuizzes : [databaseQuizzes];

            // Map and parse stringified 'questions' objects on-the-fly back to standard JSON structures
            let parsedQuizzes = fetchedItems.map(dbItem => {
                try {
                    const unfoldedQuestions = JSON.parse(dbItem.questions);
                    return {
                        id: dbItem.id,
                        score: dbItem.score,
                        ...unfoldedQuestions
                    };
                } catch(e) {
                    console.error("Failed to unpack stringified assessment question content", e);
                    return null;
                }
            }).filter(Boolean);

            // 🧼 SAFE REFACTOR COMPENSATOR LAYER: Strips out casing and trailing context indicators like -(iii)
            const normalizeCourseString = (str) => {
                if (!str) return '';
                return str.toLowerCase()
                          .replace(/-\s*\([ivx\d+)]+\)/g, '') // Strips things like -(iii), -(ii), -(iv)
                          .replace(/[^a-z0-9\s]/g, '')        // Removes trailing punctuation/symbols
                          .replace(/\s+/g, ' ')               // Collapses extra spacing
                          .trim();
            };

            const targetNormalized = normalizeCourseString(activeCourse);

            // =========================================================================
            // 🎯 FIXED STACKED FILTER LAYER: ORDERED BY PROGRAM → YEAR → COURSE → SLOT
            // =========================================================================
            let quizCollectionArray = parsedQuizzes.filter(item => {
                if (!item) return false;

                // 1️⃣ PROGRAM CHECK
                const itemProg = String(item.program || '').toLowerCase().trim();
                if (itemProg && itemProg !== activeProg.toLowerCase().trim()) return false;

                // 2️⃣ YEAR CHECK (Enforces separation between Year 2 and Year 3)
                const itemYear = String(item.year || '').replace(/\D/g, '').trim();
                const targetYear = String(finalYear).replace(/\D/g, '').trim();
                if (itemYear && itemYear !== targetYear) return false;

                // 3️⃣ SLOT WORKSPACE CHECK
                const entrySlotNormalized = String(item.slot || '').toLowerCase().replace(/\s+/g, '').trim();
                if (entrySlotNormalized && entrySlotNormalized !== cleanSlot) return false;

                // 4️⃣ COURSE STRING CHECK
                const entryCourseNormalized = normalizeCourseString(item.course || item.quizTitle || item.title || '');
                if (!entryCourseNormalized) return true; 

                return entryCourseNormalized.includes(targetNormalized) || targetNormalized.includes(entryCourseNormalized);
            });

            // 🛡️ RUNTIME MEMORY ALLOCATION: Cache values so down-stream click handlers still function seamlessly
            if (!window.cachedQuizBlueprints) window.cachedQuizBlueprints = {};
            window.cachedQuizBlueprints[storageKey] = quizCollectionArray;

            buildInterfaceLayout(quizCollectionArray);
        })
        .catch(err => {
            console.error("Critical database synchronization error:", err);
            portalContainer.innerHTML = `
                <div class="text-center py-12 border border-red-900/30 rounded-2xl bg-red-950/5 text-red-400">
                    <p class="text-xs font-black uppercase tracking-wider">Database Connection Refused</p>
                    <p class="text-[10px] opacity-70 font-mono mt-1">Unable to map repository row indices dynamically from target stream route.</p>
                </div>
            `;
        });
};

// =========================================================================
// 📡 REAL-TIME PUSHER LISTENER FOR ASSESSMENT PUBLISHING
// =========================================================================
(function initAssessmentPusherListener() {
    // ⚠️ Replace with your actual Pusher Key and Cluster values
    const PUSHER_KEY = "2b95caa0e04ac6e6a50c"; 
    const PUSHER_CLUSTER = "mt1";

    if (typeof window.Pusher !== "undefined") {
        const pusher = new window.Pusher(PUSHER_KEY, {
            cluster: PUSHER_CLUSTER,
            forceTLS: true
        });

        const channel = pusher.subscribe("assessments-channel");

        channel.bind("assessment_published", function(data) {
            console.log("⚡ Real-Time Signal Received: New Assessment Published", data);

            // 1. Flush local cache so fresh data is retrieved from PostgreSQL
            if (window.cachedQuizBlueprints) {
                window.cachedQuizBlueprints = {};
            }

            // 2. Re-trigger rendering to update the workspace UI instantly
            if (typeof window.renderTargetQuizBlueprintCards === "function") {
                window.renderTargetQuizBlueprintCards();
            }
        });
    } else {
        console.warn("⚠️ Pusher library not ready.");
    }
})();
window.purgeIndividualQuizSlotItem = function(storageKey, itemIndex) {
    // 🔒 ROLE SECURITY CLEARANCE CHECK
    const userRole = window.currentUserSession ? window.currentUserSession.role : 'STUDENT';
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
        if (typeof window.showToast === 'function') {
            window.showToast("Security Violation", "Your student security clearance profile node cannot execute deletion sequences.", "error");
        } else {
            alert("Security Error: Access Denied.");
        }
        return;
    }

    if (!confirm('Are you absolutely sure you want to permanently delete this specific assessment card?')) return;
    
    try {
        // Read directly from the live network cache
        if (!window.cachedQuizBlueprints || !window.cachedQuizBlueprints[storageKey]) return;
        
        let quizCollectionArray = window.cachedQuizBlueprints[storageKey];
        const targetQuizItem = quizCollectionArray[itemIndex];
        
        if (!targetQuizItem) return;

        // 1. Extract database primary key from PostgreSQL context mapping
        const dbRecordId = targetQuizItem.id;
        if (!dbRecordId) {
            if (typeof window.showToast === 'function') {
                window.showToast("Deletion Error", "This assessment record is missing a database primary key (id).", "error");
            } else {
                alert("Error: Missing record ID.");
            }
            return;
        }

        // 2. Extract the actual parent Note ID from the object itself
        // Check both 'note_id' (PostgreSQL style) and 'noteId' (CamelCase)
        let targetNoteId = targetQuizItem.note_id || targetQuizItem.noteId;

        // 3. Define endpoints based on whether we successfully resolved a real note_id
        let PRIMARY_ENDPOINT;
        const FALLBACK_ENDPOINT = `http://127.0.0.1:8000/assessments/${dbRecordId}`;

        if (targetNoteId && !isNaN(parseInt(targetNoteId, 10))) {
            PRIMARY_ENDPOINT = `http://127.0.0.1:8000/notes/${targetNoteId}/assessments/${dbRecordId}`;
        } else {
            console.log("⚠️ No valid parent note_id found on target object. Defaulting directly to flat endpoint.");
            PRIMARY_ENDPOINT = FALLBACK_ENDPOINT;
        }

        console.log(`📡 Dispatching API DELETE request: ${PRIMARY_ENDPOINT}`);

        const finalizeFrontendUIPurge = function() {
            window.cachedQuizBlueprints[storageKey].splice(itemIndex, 1);
            if (typeof window.showToast === 'function') {
                window.showToast("Success", "Assessment successfully purged from database cluster.", "success");
            } else {
                alert("🎉 Success: Assessment deleted.");
            }
            if (typeof window.renderTargetQuizBlueprintCards === 'function') {
                window.renderTargetQuizBlueprintCards();
            } else {
                window.location.reload();
            }
        };

        // Trigger the delete transaction
        fetch(PRIMARY_ENDPOINT, { method: 'DELETE' })
        .then(response => {
            // If the primary nested path still returns 404, immediately try the flat fallback route
            if (response.status === 404 && PRIMARY_ENDPOINT !== FALLBACK_ENDPOINT) {
                console.warn(`⚠️ Primary route returned 404. Attempting flat fallback deletion route: ${FALLBACK_ENDPOINT}`);
                return fetch(FALLBACK_ENDPOINT, { method: 'DELETE' });
            }
            if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
            return response.json();
        })
        .then(apiFeedback => {
            console.log("🎯 Python backend database drop transaction completed:", apiFeedback);
            finalizeFrontendUIPurge();
        })
        .catch(err => {
            console.error("Critical failure during backend delete operation:", err);
            if (typeof window.showToast === 'function') {
                window.showToast("Database Error", `Failed to destroy target row entry on Python cluster: ${err.message}`, "error");
            } else {
                alert(`Failed to delete the paper from the database. Error: ${err.message}`);
            }
        });
        
    } catch (e) {
        console.error("Error running individual deletion sequence", e);
    }
};
/**
 * Handles highlight changes when clicking a specific answer alternative block card
 */
function selectQuizOptionWidget(element) {
    // Reset all options inside the container back to unselected dark style framework
    const allButtons = element.parentElement.querySelectorAll('button');
    allButtons.forEach(btn => {
        btn.classList.remove('border-purple-500/60', 'bg-purple-950/10');
        btn.classList.add('border-slate-800/80', 'bg-[#020613]/40');
        
        const dot = btn.querySelector('.radio-dot');
        if (dot) dot.classList.add('scale-0');
    });

    // Make the clicked card glow neon purple instantly
    element.classList.remove('border-slate-800/80', 'bg-[#020613]/40');
    element.classList.add('border-purple-500/60', 'bg-purple-950/10');
    
    const activeDot = element.querySelector('.radio-dot');
    if (activeDot) activeDot.classList.remove('scale-0');
}

function submitAssessmentNodeItem() {
    alert("Submission locked! Next up, we will implement your high-yield neural insights evaluation panel here.");
}
function compileAndSaveQuizConfiguration() {
    const programSelect = document.getElementById('quiz-program');
    const yearSelect = document.getElementById('quiz-year');
    const slotSelect = document.getElementById('quiz-library-slot');
    const courseSelect = document.getElementById('quiz-course'); 

    // Clean Program string
    let rawProgram = (programSelect?.value || 'mbchb').toLowerCase().trim();
    if (rawProgram.includes('mbchb')) rawProgram = 'mbchb';
    if (rawProgram.includes('biomedical')) rawProgram = 'biomedical';
    if (rawProgram.includes('public')) rawProgram = 'public-health';
    if (rawProgram.includes('environmental')) rawProgram = 'environmental';
    
    // Clean Year string
    let cleanYear = String(yearSelect?.value || '1').toLowerCase().replace('year', '').replace('0', '').trim();
    if (!cleanYear) cleanYear = '1';

    // Verify a target library slot option is actively selected
    const rawSlotValue = slotSelect?.value ? slotSelect.value.trim() : "";
    if (!rawSlotValue) {
        alert("🚨 Action Required: Please select a Target Clinical Library Slot before publishing.");
        return;
    }

    // Map the slot suffix signature accurately and compress spaces to perfectly match lookup keys
    let cleanSlot = rawSlotValue.toLowerCase().replace(/\s+/g, '');

    // Capture the course value or option text dynamically
    let courseText = 'anatomy';
    if (courseSelect && courseSelect.options.length > 0) {
        const activeOption = courseSelect.options[courseSelect.selectedIndex];
        courseText = (activeOption?.value || activeOption?.text || 'anatomy').toLowerCase().trim();
    }

    // Assembles matching storage signature precisely
    const finalStorageKey = `quiz_${rawProgram}_${cleanYear}_${courseText}_${cleanSlot}`;
    
    const quizTopicTitle = document.getElementById('quiz-topic-title')?.value.trim() || `${rawSlotValue} Assessment`;

    const mainTimelineContainer = document.getElementById('quiz-composer-sections-target');
    if (!mainTimelineContainer) return;

    let finalizedExamStructure = [];

    // Check for dynamically appended Section Frame Blocks
    const visibleSectionBlocks = mainTimelineContainer.querySelectorAll('.exam-section-block');

    if (visibleSectionBlocks.length > 0) {
        // =========================================================================
        // 🧱 FLOW A: TIMELINE CONTAINS INLINE SECTION FRAMES
        // =========================================================================
        visibleSectionBlocks.forEach((sectionNode) => {
            const letter = sectionNode.getAttribute('data-section-letter') || 'A';
            const sectionHeading = sectionNode.querySelector('.quiz-section-title-input')?.value.trim() || `Section ${letter}`;
            const sectionInstructions = sectionNode.querySelector('.quiz-section-instructions-input')?.value.trim() || '';
            const sectionRuleMode = sectionNode.querySelector('.quiz-section-rule-mode-input')?.value || 'ALL';
            
            const isChoiceActive = (sectionRuleMode === 'CHOICE');
            let reqCount = null;
            if (isChoiceActive) {
                const parsedVal = parseInt(sectionNode.querySelector('.quiz-section-required-count-input')?.value, 10);
                reqCount = (!isNaN(parsedVal) && parsedVal > 0) ? parsedVal : 0;
            }

            // Deep-Scrape only the cards living INSIDE this section drop zone container
            const sectionQuestions = parseQuestionCardsArray(sectionNode.querySelectorAll('.question-card-node'), isChoiceActive, reqCount);

            finalizedExamStructure.push({
                sectionLetter: letter,
                sectionHeading: sectionHeading,
                sectionInstructions: sectionInstructions,
                processingRule: isChoiceActive ? "choice_matrix" : "all",
                sectionRule: isChoiceActive ? "choice_matrix" : "all",
                requiredQuestionCount: reqCount,
                requiredCount: reqCount,
                questions: sectionQuestions
            });
        });
    } else {
        // =========================================================================
        // 📭 FLOW B: FLAT TIMELINE TIMELINE FALLBACK (No Section Frames Used)
        // =========================================================================
        const standaloneCards = mainTimelineContainer.querySelectorAll('.question-card-node');
        if (standaloneCards.length === 0) {
            alert("⚠️ Please add at least one question card.");
            return;
        }

        const flatQuestions = parseQuestionCardsArray(standaloneCards, false, null);

        finalizedExamStructure.push({ 
            sectionLetter: "A",
            sectionHeading: quizTopicTitle, 
            sectionInstructions: "", 
            processingRule: "all",
            sectionRule: "all",
            requiredQuestionCount: null, 
            requiredCount: null,
            questions: flatQuestions 
        });
    }

    // =========================================================================
    // 🐍 ADAPTED FOR PYTHON FASTAPI & POSTGRESQL DATABASE
    // =========================================================================
    
    // 1. Temporarily define a Note ID to map this assessment to (use 1 for testing or bind dynamically)
    const targetNoteId = 1; 

    // 2. Package the complex frontend structure into a clean JSON string
    const pythonPayload = {
        note_id: targetNoteId,
        questions: JSON.stringify({
            storageKey: finalStorageKey,
            quizTitle: quizTopicTitle,
            program: rawProgram,
            year: cleanYear,
            course: courseText,
            slot: cleanSlot,
            examDataStructure: finalizedExamStructure
        }),
        score: null // Score starts blank until student takes the quiz
    };

    // PUSH DATA LIVE TO THE NEW PYTHON FASTAPI DATABASE
    fetch("http://127.0.0.1:8000/assessments", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(pythonPayload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Network response encountered a compilation failure status.");
        }
        return response.json();
    })
    .then(data => {
        const formatForStudentPortal = [{
            quizTitle: quizTopicTitle,
            course: courseText,
            isSectionedExam: visibleSectionBlocks.length > 0,
            examDataStructure: finalizedExamStructure
        }];

        localStorage.setItem(finalStorageKey, JSON.stringify(formatForStudentPortal));

        // RESET DROPDOWNS AND CLEAN UP THE INTERFACE
        if (document.getElementById('quiz-topic-title')) document.getElementById('quiz-topic-title').value = '';
        if (document.getElementById('quiz-program')) document.getElementById('quiz-program').value = '';
        if (document.getElementById('quiz-year')) document.getElementById('quiz-year').value = '';
        if (document.getElementById('quiz-library-slot')) document.getElementById('quiz-library-slot').value = '';
        
        const courseDropdown = document.getElementById('quiz-course');
        if (courseDropdown) {
            courseDropdown.innerHTML = '<option value="">-- Awaiting Path --</option>';
            courseDropdown.value = '';
            courseDropdown.setAttribute('disabled', 'true');
        }

        const dynamicContainer = document.getElementById('quiz-composer-sections-target');
        if (dynamicContainer) {
            dynamicContainer.innerHTML = `
                <div id="section-pristine-placeholder" class="p-8 border border-dashed border-slate-800/60 bg-slate-900/5 rounded-xl text-center text-slate-500 text-[11px] font-medium uppercase tracking-wider">
                    No items appended yet. Click "+ Add Section Frame" or "Add Question Item" to initialize your workspace layout.
                </div>
            `;
        }
        
        alert(`🎉 Success! Assessment compiled and published safely to your Python Database under ID: ${data.id}`);
    })
    .catch(e => {
        console.error("Database connection/sync failure:", e);
        alert("🚨 Sync Error: Could not publish assessment to the live Python database server.");
    });
}

/**
 * 🛠️ HELPER: Helper function to scrape nested subdivided Roman numeral parts (i, ii, iii)
 */
function scrapeSubdividedParts(targetContainerId) {
    const nestedTargetList = document.getElementById(`${targetContainerId}-child-nested-target-list`);
    if (!nestedTargetList) return null;

    const childNodes = nestedTargetList.querySelectorAll('[data-child-sub-node="true"]');
    if (childNodes.length === 0) return null;

    return Array.from(childNodes).map(partNode => {
        const childId = partNode.id;
        const prefix = partNode.getAttribute('data-prefix-value') || 'i';
        
        const stemInput = document.getElementById(`${childId}-stem-field`);
        const marksInput = document.getElementById(`${childId}-marks-field`);
        const insightInput = document.getElementById(`${childId}-neural-insight`);
        const aiCuesInput = document.getElementById(`${childId}-ai-cues`);

        return {
            id: childId,
            prefix: prefix,
            stem: stemInput ? stemInput.value.trim() : "",
            marks: marksInput ? (parseInt(marksInput.value, 10) || 1) : 1,
            rationale: insightInput ? insightInput.value.trim() : "",
            aiModelAnswer: aiCuesInput ? aiCuesInput.value.trim() : ""
        };
    });
}

/**
 * Shared Scraper Pipeline Worker (Processes an array node list of question elements)
 */
function parseQuestionCardsArray(questionNodes, isChoiceMatrixActive, extractedRequiredCount) {
    const collectedQuestionsHeap = [];

    questionNodes.forEach((node) => {
        const questionId = node.id;
        
        // Determine if this is a Scenario/Case Vignette parent layout
        const isParentNode = !node.querySelector(`#${questionId}-nested-subquestions-wrap`)?.classList.contains('hidden');
        
        // Main Question/Vignette text area capture
        const textInput = node.querySelector(`#${questionId}-stem-input`)?.value.trim() || 
                          node.querySelector('.question-stem-input, textarea, input[type="text"]')?.value.trim();
        
        const insightInput = node.querySelector('.neural-insight-input, textarea[placeholder*="breakdown"], textarea[placeholder*="Rationale"]')?.value.trim();
        
        let attachedImageBase64 = "";
        const imgElement = node.querySelector('img[src^="data:"], .vignette-image-preview');
        if (imgElement) {
            attachedImageBase64 = imgElement.getAttribute('src') || "";
        } else {
            attachedImageBase64 = node.getAttribute('data-attached-image') || "";
        }

        if (isParentNode) {
            // =========================================================================
            // 🌌 NESTED ARRAY SCENARIO PARSER ENGINE
            // =========================================================================
            let nestedSubQuestions = [];
            const subQuestionNodes = node.querySelectorAll(`#${questionId}-nested-target-list > div[data-sub-node-wrapper="true"]`);
            
            subQuestionNodes.forEach((subNode) => {
                const subQuestionId = subNode.id;
                const activePrefix = subNode.getAttribute('data-prefix-value') || 'a';
                const subStemText = subNode.querySelector(`#${subQuestionId}-stem-field`)?.value.trim() || "";
                
                let subDetectedType = 'LongAnswer'; 
                const activeSubTab = subNode.querySelector('[id*="-tab-"].bg-purple-600') || subNode.querySelector('[id*="-tab-"][data-active="true"]');
                if (activeSubTab) {
                    if (activeSubTab.id.includes('mcq')) subDetectedType = 'MCQ';
                    if (activeSubTab.id.includes('tf')) subDetectedType = 'T/F';
                    if (activeSubTab.id.includes('longAnswer')) subDetectedType = 'LongAnswer';
                    if (activeSubTab.id.includes('identifier')) subDetectedType = 'IDENTIFIER';
                }

                let subCalculatedAnswer = "";
                let subCollectedOptions = [];
                
                // Safe Scraper targets for Sub-question AI Evaluation Keys
                let subAiCues = subNode.querySelector(`#${subQuestionId}-ai-cues-field`)?.value.trim() || 
                                subNode.querySelector('.ai-cues-input')?.value.trim() || 
                                null;
                
                // Safe Scraper targets for Sub-question Neural Insight rationale strings
                let subNeuralInsight = subNode.querySelector(`#${subQuestionId}-neural-insight`)?.value.trim() || 
                                       subNode.querySelector('.neural-insight-input')?.value.trim() || 
                                       "";

                // 🔍 Check for nested subdivided parts inside this scenario sub-question
                const nestedParts = (subDetectedType === 'LongAnswer') ? scrapeSubdividedParts(subQuestionId) : null;
                const isSubdivided = Boolean(nestedParts && nestedParts.length > 0);

                if (subDetectedType === 'T/F') {
                    const tfRadios = subNode.querySelectorAll('input[type="radio"]');
                    if (tfRadios.length >= 2) {
                        subCalculatedAnswer = tfRadios[0].checked ? "True" : "False";
                    } else {
                        const activeRadio = subNode.querySelector('input[type="radio"]:checked');
                        subCalculatedAnswer = activeRadio ? activeRadio.value : "True";
                    }
                } 
                else if (subDetectedType === 'MCQ') {
                    const optionFields = subNode.querySelectorAll('input[placeholder*="Option"]');
                    optionFields.forEach((optInput) => { if (optInput.value.trim()) subCollectedOptions.push(optInput.value.trim()); });
                    
                    const allRadiosForCard = subNode.querySelectorAll('input[type="radio"]');
                    let matchedIndex = 0;
                    allRadiosForCard.forEach((radio, radioIdx) => {
                        if (radio.checked) matchedIndex = radioIdx;
                    });
                    subCalculatedAnswer = String.fromCharCode(65 + matchedIndex);
                } 
                else if (subDetectedType === 'LongAnswer') {
                    if (isSubdivided) {
                        subCalculatedAnswer = nestedParts.map(p => `(${p.prefix}) ${p.stem}: ${p.aiModelAnswer}`).join(' || ');
                    } else {
                        subCalculatedAnswer = "Written Submission Evaluation Slot";
                    }
                }
                else if (subDetectedType === 'IDENTIFIER') {
                    subCalculatedAnswer = [];
                    const labelCount = parseInt(subNode.getAttribute('data-identifier-count') || '0', 10);
                    for (let i = 1; i <= labelCount; i++) {
                        const inputField = document.getElementById(`${subQuestionId}-identifier-target-${i}`);
                        if (inputField && inputField.value.trim()) {
                            subCalculatedAnswer.push(inputField.value.trim());
                        }
                    }
                }

                if (subStemText) {
                    nestedSubQuestions.push({
                        subId: subQuestionId,
                        prefix: activePrefix,
                        questionText: subStemText,
                        type: subDetectedType,
                        options: subDetectedType === 'T/F' ? ["True", "False"] : (subCollectedOptions.length > 0 ? subCollectedOptions : null),
                        correctAnswer: subCalculatedAnswer,
                        aiEvaluationCriteria: subAiCues,
                        rationale: subNeuralInsight || insightInput || "No base global scenario breakdown attached.",
                        imageSupplement: attachedImageBase64 || null, 
                        imageBase64: attachedImageBase64 || null,
                        allocatedMarks: parseInt(subNode.querySelector('input[data-field="marks"]')?.value, 10) || 1,
                        isSubdivided: isSubdivided,
                        subParts: nestedParts || []
                    });
                }
            });

            if (textInput && nestedSubQuestions.length > 0) {
                collectedQuestionsHeap.push({
                    id: questionId,
                    type: 'scenario', 
                    questionText: textInput, 
                    imageSupplement: attachedImageBase64 || null,
                    imageBase64: attachedImageBase64 || null,
                    isSplitParent: true,
                    subQuestions: nestedSubQuestions,
                    rationale: insightInput || "No base global scenario breakdown attached.",
                    processingRule: isChoiceMatrixActive ? "choice_matrix" : "all",
                    requiredCount: isChoiceMatrixActive ? extractedRequiredCount : 0
                });
            }
        } else {
            // =========================================================================
            // ⚡ STANDARD QUESTION PARSER ENGINE (STANDALONE SUBMISSIONS)
            // =========================================================================
            let detectedType = 'MCQ';
            const activeTypeBtn = node.querySelector('.bg-purple-600'); 
            if (activeTypeBtn) {
                if (activeTypeBtn.innerText.includes('T / F') || activeTypeBtn.innerText.includes('T/F')) detectedType = 'T/F';
                if (activeTypeBtn.innerText.includes('LONG') || activeTypeBtn.innerText.includes('Long')) detectedType = 'LongAnswer';
                if (activeTypeBtn.innerText.includes('MCQ')) detectedType = 'MCQ';
                if (activeTypeBtn.innerText.toLowerCase().includes('identifier')) detectedType = 'IDENTIFIER';
                if (activeTypeBtn.innerText.toLowerCase().includes('matching')) detectedType = 'MATCHING';
            }

            let calculatedAnswer = "";
            let collectedOptions = [];
            let aiEvaluationCriteria = null;
            let matchingPairsArray = [];
            let activeStrategy = 'table';
            let rawPoolStr = "";

            // Check for subdivided parts on standalone LongAnswer questions
            const standaloneSubdividedParts = (detectedType === 'LongAnswer') ? scrapeSubdividedParts(questionId) : null;
            const isStandaloneSubdivided = Boolean(standaloneSubdividedParts && standaloneSubdividedParts.length > 0);

            if (detectedType === 'T/F') {
                const tfRadios = node.querySelectorAll('input[type="radio"]');
                if (tfRadios.length >= 2) {
                    if (tfRadios[0].checked) calculatedAnswer = "True";
                    else if (tfRadios[1].checked) calculatedAnswer = "False";
                } else {
                    const directTrue = node.querySelector('input[value="True"], input[value="true"]');
                    calculatedAnswer = directTrue && directTrue.checked ? "True" : "False";
                }
            }
            else if (detectedType === 'MCQ') {
                const optionFields = node.querySelectorAll('.option-variant-input, input[placeholder*="Option"]');
                optionFields.forEach((optInput) => { if (optInput.value.trim()) collectedOptions.push(optInput.value.trim()); });
                
                const allRadiosForCard = node.querySelectorAll('input[type="radio"]');
                let matchedIndex = 0;
                allRadiosForCard.forEach((radio, radioIdx) => {
                    if (radio.checked) matchedIndex = radioIdx;
                });
                calculatedAnswer = String.fromCharCode(65 + matchedIndex); 
            }
            else if (detectedType === 'LongAnswer') {
                if (isStandaloneSubdivided) {
                    calculatedAnswer = standaloneSubdividedParts.map(p => `(${p.prefix}) ${p.stem}: ${p.aiModelAnswer}`).join(' || ');
                } else {
                    calculatedAnswer = "Written Submission Evaluation Slot";
                    const aiTextarea = node.querySelector(`#${questionId}-ai-key-container textarea`) || 
                                       node.querySelector('.ai-cues-input') ||
                                       node.querySelector('[placeholder*="AI scoring cues"], [placeholder*="Model answer"]');
                    if (aiTextarea && aiTextarea.value.trim()) {
                        aiEvaluationCriteria = aiTextarea.value.trim();
                    }
                }
            }
            else if (detectedType === 'IDENTIFIER') {
                const identifierAnswers = [];
                const labelCount = parseInt(node.getAttribute('data-identifier-count') || '0', 10);
                for (let i = 1; i <= labelCount; i++) {
                    const inputField = document.getElementById(`${questionId}-identifier-target-${i}`);
                    if (inputField && inputField.value.trim()) {
                        identifierAnswers.push(inputField.value.trim());
                    }
                }
                calculatedAnswer = identifierAnswers;
            }
            else if (detectedType === 'MATCHING') {
                const workspace = document.getElementById(`${questionId}-matching-workspace`);
                activeStrategy = workspace ? workspace.getAttribute('data-matching-strategy') : 'table';
                
                rawPoolStr = document.getElementById(`${questionId}-pool-definition-input`)?.value.trim() || "";
                
                const stackNode = document.getElementById(`${questionId}-matching-rows-stack`);
                if (stackNode) {
                    const rows = stackNode.querySelectorAll('.match-row-item-node');
                    rows.forEach((row, idx) => {
                        const numericSuffix = row.id.split('-').pop();
                        const clueVal = document.getElementById(`${questionId}-match-clue-${numericSuffix}`)?.value.trim() || "";
                        const targetVal = document.getElementById(`${questionId}-match-target-${numericSuffix}`)?.value.trim() || "";
                        
                        if (clueVal || targetVal) {
                            matchingPairsArray.push({
                                index: idx + 1,
                                clueText: clueVal,
                                correctMatch: targetVal
                            });
                        }
                    });
                }
            }

            if (textInput) {
                const dynamicInsightBox = document.getElementById(`${questionId}-neural-insight`) ||
                                          document.getElementById(`${questionId}-rationale`) || 
                                          document.getElementById(`${questionId}-insight`) ||
                                          node.querySelector('.neural-insight-input') ||
                                          node.querySelector('textarea[placeholder*="breakdown"]');
                                          
                const finalRationale = (dynamicInsightBox && dynamicInsightBox.value.trim()) 
                    ? dynamicInsightBox.value.trim() 
                    : (insightInput || "No high-yield rationale attached.");

                const activeMarkerStyle = node.getAttribute('data-marker-type') || 'numbers';

                const baseQuestionBundle = {
                    id: questionId, 
                    type: detectedType === 'IDENTIFIER' ? 'identifier' : detectedType.toLowerCase(), 
                    questionText: textInput,
                    options: detectedType === 'T/F' ? ["True", "False"] : (collectedOptions.length > 0 ? collectedOptions : null),
                    correctAnswer: calculatedAnswer, 
                    rationale: finalRationale,
                    imageSupplement: attachedImageBase64 || null, 
                    imageBase64: attachedImageBase64 || null,
                    isSplitParent: false,
                    subQuestions: null, 
                    aiEvaluationCriteria: aiEvaluationCriteria,
                    processingRule: isChoiceMatrixActive ? "choice_matrix" : "all",
                    requiredCount: isChoiceMatrixActive ? extractedRequiredCount : 0,
                    isSubdivided: isStandaloneSubdivided,
                    subParts: standaloneSubdividedParts || []
                };

                if (detectedType === 'IDENTIFIER') {
                    baseQuestionBundle.identifierLabels = calculatedAnswer;
                    baseQuestionBundle.markerType = activeMarkerStyle;
                } else if (detectedType === 'MATCHING') {
                    baseQuestionBundle.matchingStrategy = activeStrategy;
                    baseQuestionBundle.rawOptionPoolString = rawPoolStr;
                    baseQuestionBundle.pairs = matchingPairsArray;
                }

                collectedQuestionsHeap.push(baseQuestionBundle);
            }
        }
    });

    return collectedQuestionsHeap;
}