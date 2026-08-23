function generateCourseSuffix(courseName) {
    if (!courseName) return "Gen";
    
    // Clean up the string and split it into individual words
    const words = courseName.trim().split(/\s+/);
    
    if (words.length === 1) {
        // Single word: Take first 2 characters, capitalized (e.g., Anatomy -> An)
        return words[0].substring(0, 2).toUpperCase() + words[0].substring(1, 2).toLowerCase();
    } else {
        // Multiple words: Extract initials (e.g., Health Promotion -> HP)
        // Filters out small joining words like "and", "to" if necessary
        return words
            .filter(w => w.toLowerCase() !== 'to' && w.toLowerCase() !== 'and')
            .map(w => w.charAt(0).toUpperCase())
            .join('');
    }
}
// 1. THE COURSE SYNCRONIZER (Make sure this exists identically)
function synchronizeQuizCourseDropdown() {
    const programElement = document.getElementById('quiz-program');
    const yearElement = document.getElementById('quiz-year');
    const courseElement = document.getElementById('quiz-course');
    
    if (!programElement || !yearElement || !courseElement) return;
    
    const chosenProgram = programElement.value;
    const chosenYear = parseInt(yearElement.value);
    
    if (!chosenProgram || !chosenYear) {
        courseElement.innerHTML = '<option value="">-- Awaiting Path --</option>';
        courseElement.disabled = true;
        synchronizeQuizLibrarySlotsDropdown(); 
        return;
    }
    
    const programMap = ACADEMIC_PROGRAM_CURRICULUM_MATRIX[chosenProgram];
    const availableCourses = programMap ? programMap[chosenYear] : null;
    
    if (availableCourses && availableCourses.length > 0) {
        let menuHTML = '<option value="">-- Choose Course Module --</option>';
        availableCourses.forEach(courseItem => {
            menuHTML += `<option value="${courseItem}">${courseItem}</option>`;
        });
        
        courseElement.innerHTML = menuHTML;
        courseElement.disabled = false;
        console.log(`Path Router synchronized: ${chosenProgram} -> Year 0${chosenYear}. Loaded modules.`);
    } else {
        courseElement.innerHTML = '<option value="">-- No Modules Found --</option>';
        courseElement.disabled = true;
        synchronizeQuizLibrarySlotsDropdown();
    }
    
    if (window.lucide) lucide.createIcons();

    // 🎯 BACKUP FORCE: Trigger the slot synchronizer to catch any dynamic tab race conditions!
    if (typeof synchronizeQuizLibrarySlotsDropdown === 'function') {
        synchronizeQuizLibrarySlotsDropdown();
    }
}

// 2. THE MILESTONE SLOT SYNCRONIZER
function synchronizeQuizCourseDropdown(changedElementId) {
    // 🗺️ 1. SELF-CONTAINED LOCAL QUIZ MATRIX REGISTRY
    const localQuizMatrix = {
        "mbchb": {
            1: ['Anatomy I', 'Physiology I', 'Biochemistry I'],
            2: ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Therapeutics', 'Clinical Science', 'Laboratory Science', 'Diagnostics', 'Society and Medicine', 'Public Health'],
            3: ['Anatomy-(iii)', 'Physiology-(iii)', 'Biochemistry-(iii)', 'Pathology-(iii)', 'Therapeutics-(iii)', 'Clinical Science-3', 'Laboratory Science-3', 'Diagnostics-3', 'Society and Medicine-3', 'Public Health-3'],
            4: [],
            5: []
        },
        "biomedical": {
            2: ['Introduction to Biomedical Science', 'Introduction to Human Anatomy', 'Introduction to Medical Physiology', 'Introduction to Medical Microbiology', 'General Biochemistry'],
            3: ['Society and Medicine-(ii)', 'Histology', 'Physiology-(ii)', 'Parasitology', 'Virology/Mycology', 'Biochemistry-(ii)', 'Molecular and Cell Biology', 'Bacteriology'],
            4: ['Public Health-(iv)', 'General and Systematic Pathology', 'Pharmacology, Therapeutics and Toxicology', 'Immunology', 'Medical Genetics', 'Biostatics', 'Haematology and Blood Transfusion', 'Research and Methodology'],
            5: ['Skills in Laboratory Management', 'Medical Teaching Methodology', 'Cellular Pathology', 'Clinical Biochemistry', 'Research Project']
        },  
        "public-health": {
            2: ['Primary Health Care-(ii)', 'Microbiology-(ii)', 'Health Promotion-(ii)', 'Human Anatomy-(ii)', 'Human Physiology-(ii)', 'Environmental Health-(ii)'],
            3: ['Psychology and Medicine', 'Epidemiology-(iii)', 'Food Technology and Hygiene-(iii)', 'Monitoring and Evaluation', 'Research and Biostatistics'],
            4: ['Emerging Public Health Issues', 'Occupational Health and Ergonomics-(vi)', 'Food and Nutrition-(iv)', 'Research Project and Data Management-(iv)', 'Industrial Attachment'],
            5: ['Global Health', 'Health Policies and Economics', 'Medical Parasitology-(v)', 'Health System, Management II and Health Promotion II', 'Basic Pharmacology and Toxicology-(v)']
        },
        "environmental": {
            2: ['Principles of Building and Construction', 'Primary Health Care', 'Environmental Health', 'Microbiology', 'Human Anatomy', 'Human Physiology'],
            3: ['Biostatistics and Research', 'Food Animal Anatomy and Slaughter Houses', 'Epidemiology', 'Food Technology and Hygiene', 'Building Development and Planning'],
            4: ['Occupational Health and Ergonomics', 'Industrial Training', 'Food Animal Pathology and Meat Inspection', 'Food and Nutrition', 'Inspection of Premises and Reporting', 'Research Project and Data Management'],
            5: ['Environmental Economics, Management, Laws and Policies', 'Medical Parasitology', 'Occupational Health and Risk Analysis', 'Food Processing and Inspection', 'Basic Pharmacology and Toxicology', 'Environmental Health', 'Introduction to Public Health']
        }
    };

    // 🔍 2. TARGET NODE HOOKS ON THE CANVAS VIEWPORT
    const progSelect = document.getElementById('quiz-program') || document.querySelector('select[id*="program"]');
    const yearSelect = document.getElementById('quiz-year') || document.querySelector('select[id*="year"]');
    const courseSelect = document.getElementById('quiz-course') || document.querySelector('select[id*="course"]');

    // Safe exit fallback if layout nodes aren't painted yet
    if (!progSelect || !yearSelect || !courseSelect) {
        console.warn("Quiz select DOM nodes could not be located in current active deck layout.");
        return;
    }

    const selectedProg = progSelect.value;
    console.log(`Quiz Cascader Active -> Program: "${selectedProg}" | Triggered By: ${changedElementId}`);

    // Scenario A: If program value resets to empty state
    if (!selectedProg) {
        yearSelect.innerHTML = '<option value="">-- Select --</option>';
        courseSelect.innerHTML = '<option value="">-- Awaiting Path --</option>';
        yearSelect.disabled = true;
        courseSelect.disabled = true;
        synchronizeQuizLibrarySlotsDropdown(); // 🔄 Downstream cascade clear
        return;
    }

    const programData = localQuizMatrix[selectedProg];
    if (!programData) {
        console.error(`Matrix mapping structural match missing for key: ${selectedProg}`);
        return;
    }

    // 🔄 3. CASCADE ENGINE RESOLUTIONS
    // Step One: If the program box just altered, rebuild the Academic Years array options
    if (!changedElementId || changedElementId === progSelect.id || !yearSelect.value) {
        let yearOptions = '<option value="">-- Select --</option>';
        for (let y in programData) {
            yearOptions += `<option value="${y}">Year 0${y}</option>`;
        }
        yearSelect.innerHTML = yearOptions;
        yearSelect.disabled = false;
        
        // Pin courses selector status back to lock state
        courseSelect.innerHTML = '<option value="">-- Awaiting Course Module --</option>';
        courseSelect.disabled = true;
        synchronizeQuizLibrarySlotsDropdown(); // 🔄 Downstream cascade clear
    }

    // Step Two: Evaluate what Academic Year choice row key index is set to map courses
    const selectedYear = yearSelect.value;
    console.log(`Quiz Cascader Active -> Academic Year Layer: "${selectedYear}"`);

    if (selectedYear && programData[selectedYear]) {
        const modules = programData[selectedYear];
        
        if (modules.length > 0) {
            let courseOptions = '<option value="">-- Select Module --</option>';
            modules.forEach(mod => {
                courseOptions += `<option value="${mod}">${mod}</option>`;
            });
            courseSelect.innerHTML = courseOptions;
            courseSelect.disabled = false;

            // 🔄 Step Three: Automatically bind runtime change monitoring to the new options block
            courseSelect.onchange = function() {
                synchronizeQuizLibrarySlotsDropdown();
            };
            
            // Fire an initial sync evaluation in case it needs to catch states
            synchronizeQuizLibrarySlotsDropdown();
        } else {
            courseSelect.innerHTML = '<option value="">-- No Modules Scheduled --</option>';
            courseSelect.disabled = true;
            synchronizeQuizLibrarySlotsDropdown(); // 🔄 Downstream cascade clear
        }
    } else {
        // Safe reset freeze boundary if year gets swapped to zero choice default option
        courseSelect.innerHTML = '<option value="">-- Awaiting Course Module --</option>';
        courseSelect.disabled = true;
        synchronizeQuizLibrarySlotsDropdown(); // 🔄 Downstream cascade clear
    }
}

// 📦 SUB-MODULE: TARGETED LIBRARY MILESTONE SLOT SYNCHRONIZER
function synchronizeQuizLibrarySlotsDropdown() {
    const courseElement = document.getElementById('quiz-course');
    const slotElement = document.getElementById('quiz-library-slot');
    
    if (!slotElement) return;
    
    if (!courseElement || !courseElement.value) {
        slotElement.innerHTML = '<option value="">-- Awaiting Course Module --</option>';
        slotElement.disabled = true;
        return;
    }
    
    const chosenCourse = courseElement.value;
    const suffix = generateCourseSuffix(chosenCourse);
    
    const baseMilestones = ["Term 1", "Term 2", "Term 3", "Test 1", "Test 2", "Test 3", "Sessional"];
    
    let slotHTML = '<option value="">-- Choose Academic Milestone --</option>';
    baseMilestones.forEach(milestone => {
        const fullMilestoneText = `${milestone}-${suffix}`;
        slotHTML += `<option value="${fullMilestoneText}">${fullMilestoneText}</option>`;
    });
    
    slotElement.innerHTML = slotHTML;
    slotElement.disabled = false;
    console.log(`Slot Dropdown synchronized for milestone tracking suffix: -${suffix}`);
}
function renderAssessmentsView() {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // 🎯 SAFE CONTEXT LOOKUP: Grab the active course state cleanly
    const safeCourse = (window.currentSelection && window.currentSelection.course) || localStorage.getItem('active_course') || 'Anatomy';
    
    // Calculate the exact matching academic short suffix (e.g., "An", "Ph", "HP")
    const suffix = generateCourseSuffix(safeCourse);

    // 🎯 YOUR 7 ACADEMIC MILESTONES ARCHITECTURE
    const baseMilestones = ["Term 1", "Term 2", "Term 3", "Test 1", "Test 2", "Test 3", "Sessional"];

    contentArea.innerHTML = `
        <div class="w-full h-full max-w-5xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4 flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-black text-white uppercase tracking-wider">${safeCourse} — Assessments</h2>
                    <p class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Select active file bank to initialize interactive clinical session</p>
                </div>
                <button onclick="selectCourse('${safeCourse}')" 
                    class="bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center space-x-2">
                    <span>← Back to Hub</span>
                </button>
            </div>

            <div class="flex flex-col space-y-3">
    ${baseMilestones.map(milestone => {
        // Construct the strict matching signature identifier (e.g., "Term 1-An")
        const dynamicSlotId = `${milestone}-${suffix}`;
        
        return `
        <div class="flex flex-col space-y-2 w-full">
            
            <div class="bg-slate-900/20 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between hover:border-purple-500/30 hover:bg-slate-800/10 transition-all duration-300 group shadow-md">
                <div class="flex items-center space-x-4">
                    <div class="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-all duration-300 shadow-inner">
                        <i data-lucide="folder" class="w-4 h-4 transition-transform group-hover:scale-110"></i>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-white uppercase tracking-wider group-hover:text-purple-300 transition-colors">${dynamicSlotId}</span>
                        <span class="text-[8px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Locker Code: LN-LIB-${dynamicSlotId.replace(/\s+/g, '')}</span>
                    </div>
                </div>
                
                <button onclick="if(!window.currentSelection) window.currentSelection = {}; window.currentSelection.slotId = '${dynamicSlotId}'; window.navigateToSlotWorkspace('${dynamicSlotId}');" 
                    class="text-[8px] bg-slate-900/60 hover:bg-purple-600 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg font-black tracking-widest uppercase border border-slate-800 hover:border-purple-500 transition-all transform active:scale-97 cursor-pointer">
                    Inspect Slot
                </button>
            </div>

            <div id="active-quiz-portal-slot-${dynamicSlotId}" class="w-full pl-4 space-y-3 hidden"></div>
            
        </div>
        `;
    }).join('')}
</div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}