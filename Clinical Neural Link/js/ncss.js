// ==========================================
// 🛡️ NEURAL LINK CENTRAL SECURITY SUBSYSTEM
// ==========================================

// 1. Immutable Administrative Identity Matrix (Your 6 Master Keys)
window.MASTER_ADMIN_KEYS = [
   
];

// 2. Global Runtime Active Session State Slot
window.currentUserSession = null;

// 3. Security Engine Initialization Protocol
window.initSecuritySubsystem = function() {
    console.log("🔒 Calibrating Identity Access Gates...");
    
    // Check if a user session is cached in local browser memory
    const cachedSession = localStorage.getItem('neural_link_active_session');
    if (cachedSession) {
        try {
            window.currentUserSession = JSON.parse(cachedSession);
            console.log(`👤 Active Session Authenticated: ${window.currentUserSession.name} [${window.currentUserSession.role}]`);
            
            // Run UI enforcement filters immediately upon successful state detection
            window.enforceSecurityVisibilityUI();
        } catch (e) {
            console.error("Session Token Corruption detected. Flushing local tokens.");
            window.logoutSecureSession();
        }
    } else {
        console.warn("⚠️ No active user token verified. Access restricted.");
        // If we are not logged in and not on a login portal page, we will eventually summon the modal wall here!
    }
};

// 4. Security Enforcement Rules Matrix (Enforces Requirements #4 and #5)
window.checkRoutePermission = function(targetProgram, targetYear) {
    if (!window.currentUserSession) return false;
    
    // Super admins and Regional auditors bypass all strict program-year locks
    if (window.currentUserSession.role === 'SUPER_ADMIN' || window.currentUserSession.role === 'REGIONAL_ADMIN') {
        return true;
    }
    
    // Strict match verification for standard students (Requirement #4)
    const accessGranted = (window.currentUserSession.program.toLowerCase() === targetProgram.toLowerCase()) &&
                          (String(window.currentUserSession.year) === String(targetYear));
                          
    if (!accessGranted) {
        console.warn(`🛑 Access Denied: User profile mismatch for route path: ${targetProgram} Year ${targetYear}`);
    }
    return accessGranted;
};

// 5. Dynamic UI Hiding/Showing Engine (Enforces Requirement #5)
window.enforceSecurityVisibilityUI = function() {
    const sessionExists = !!window.currentUserSession;
    const userRole = sessionExists ? window.currentUserSession.role : 'STUDENT';
    const isAdmin = sessionExists && (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN');

    // If a student somehow triggers a view update that recreates the button structure, 
    // this instantly wipes it completely out of existence.
    const adminHubButton = document.getElementById('admin-hub-btn'); 
    if (adminHubButton && !isAdmin) {
        adminHubButton.remove(); 
    }

    // Handle destructive layout elements (Delete Buttons) across Note cards
    const administrativeDestructors = document.querySelectorAll('.admin-delete-trigger');
    administrativeDestructors.forEach(button => {
        if (!isAdmin) {
            button.remove(); 
        }
    });
};
// 6. Logout / Session Destruction Routine (Smooth Fade-out + Secure Reload)


// Auto-run security scan when file finishes loading parsing
window.initSecuritySubsystem();
// ==========================================
// 🔑 PHASE A: CENTRAL AUTHENTICATION ROUTER
// ==========================================

// 🧬 LIGHTWEIGHT HARDWARE & CONTEXT FINGERPRINT GENERATOR
function generateBrowserFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        window.screen.colorDepth,
        `${window.screen.width}x${window.screen.height}`,
        new Date().getTimezoneOffset(),
        (() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return "no-canvas";
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.fillText("NeuralLink-Auth-V4", 2, 2);
            return canvas.toDataURL();
        })()
    ];
    
    // Hash the combined metrics array into a stable clean identifier string
    const stringData = components.join('||');
    let hash = 0;
    for (let i = 0; i < stringData.length; i++) {
        const char = stringData.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; 
    }
    return 'node_fp_' + Math.abs(hash);
}
function showPinChallengeModal() {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('custom-pin-challenge-modal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="custom-pin-challenge-modal" style="
                position: fixed; inset: 0; z-index: 10000;
                background: rgba(4, 7, 13, 0.85); backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center;
                font-family: inherit;">
                
                <div style="
                    background: #0d1322; border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px; padding: 28px; width: 100%; max-width: 360px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: center;">
                    
                    <div style="
                        width: 44px; height: 44px; background: rgba(37, 99, 235, 0.15); 
                        border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center; 
                        margin: 0 auto 16px; color: #60a5fa; font-size: 20px;">
                        🔒
                    </div>
                    
                    <h3 style="margin: 0 0 6px 0; color: #f8fafc; font-size: 1.15rem; font-weight: 600; letter-spacing: 0.5px;">Security Checkpoint</h3>
                    <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 0.85rem; line-height: 1.4;">Enter your 4-digit Security PIN to authenticate session.</p>
                    
                    <form id="pin-challenge-form">
                        <input type="password" id="pin-challenge-input" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="••••" required style="
                            width: 100%; box-sizing: border-box; background: #060913; border: 1px solid #1e293b;
                            color: #f8fafc; font-size: 1.5rem; letter-spacing: 12px; text-align: center;
                            padding: 12px; border-radius: 8px; outline: none; margin-bottom: 20px;
                            transition: border-color 0.2s, box-shadow 0.2s;">
                        
                        <div style="display: flex; gap: 10px;">
                            <button type="button" id="pin-challenge-cancel" style="
                                flex: 1; background: transparent; border: 1px solid #334155; color: #94a3b8;
                                padding: 10px; border-radius: 6px; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: 0.2s;">Cancel</button>
                            <button type="submit" style="
                                flex: 1; background: #2563eb; border: none; color: #ffffff;
                                padding: 10px; border-radius: 6px; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: 0.2s;">Verify PIN</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('custom-pin-challenge-modal');
        const input = document.getElementById('pin-challenge-input');
        const form = document.getElementById('pin-challenge-form');
        const cancelBtn = document.getElementById('pin-challenge-cancel');

        setTimeout(() => input.focus(), 50);

        input.onfocus = () => {
            input.style.borderColor = '#3b82f6';
            input.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
        };
        input.onblur = () => {
            input.style.borderColor = '#1e293b';
            input.style.boxShadow = 'none';
        };

        const close = (val) => {
            modal.remove();
            resolve(val);
        };

        form.onsubmit = (e) => {
            e.preventDefault();
            close(input.value.trim());
        };

        cancelBtn.onclick = () => close(null);
    });
}

window.handlePortalLogin = async function(event) {
    // Prevent default form transmission reload loops if fired inside a submit event listener context
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    console.log("🔒 Running access authentication verification sequence...");

    // 1. Resolve input components from the DOM Canvas
    const nameInput = document.getElementById('login-full-name');
    const studentNumberInput = document.getElementById('login-student-number');

    if (!nameInput || !studentNumberInput) {
        if (typeof window.showToast === 'function') {
            window.showToast("Configuration Fault", "Login credential form fields could not be successfully mapped to the active DOM template view.", "error");
        } else {
            alert("System Configuration Fault: Login credential form fields could not be mapped.");
        }
        return;
    }

    const typedName = nameInput.value.trim();
    const typedNumber = studentNumberInput.value.trim();

    // Field parameter safety checks
    if (!typedName || !typedNumber) {
        if (typeof window.showToast === 'function') {
            window.showToast("Authentication Blocked", "Please provide both your Full Name and Student Key/Number to pass security checkpoints.", "warning");
        } else {
            alert("Authentication Blocked: Please provide both your Full Name and Student Key/Number.");
        }
        return;
    }

    const lowerNumber = typedNumber.toLowerCase();

    
    if (lowerNumber === "cbucnl-287-ah" || lowerNumber === "cbucnl-287-a" || lowerNumber === "cbucnl-287-a") {
        try {
            console.log("📡 Admin identifier detected. Routing to secure FastAPI cluster...");
            
            const response = await fetch("http://127.0.0.1:8000/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: typedNumber,
                    name: typedName
                })
            });

            if (!response.ok) {
                console.warn("🛑 Administrative credentials rejected by secure backend validation server.");
                if (typeof window.showToast === 'function') {
                    window.showToast("Authentication Fault", "Invalid administrative credential set provided.", "error");
                } else {
                    alert("Authentication Fault: Invalid administrative credentials.");
                }
                return;
            }

            const adminProfile = await response.json();
            console.log(`⚡ Admin validation successful [${adminProfile.role}]. Synchronizing access payload...`);

            window.commitSessionAndRedirect({
                name: adminProfile.name,
                studentNumber: adminProfile.studentNumber,
                program: adminProfile.program,
                year: adminProfile.year,
                role: adminProfile.role,
                accessMode: adminProfile.accessMode || "ADMIN_HUB"
            });

            // 🎯 FORCE SPA DASHBOARD RENDER ON VERIFICATION
            if (typeof showDashboard === 'function') {
                await showDashboard();
            }
            return; // Halt execution path early

        } catch (error) {
            console.error("❌ Secure Admin Backend Link Failure:", error);
            if (typeof window.showToast === 'function') {
                window.showToast("Security Link Error", "Unable to establish connection with the secure admin backend cluster.", "error");
            }
            return;
        }
    }

    // =========================================================================
    // 🎓 FALLBACK ROUTE: STANDARD STUDENT SUPABASE DATABASE AUTHENTICATION
    // =========================================================================
    
    // 2. STAGE 1 RECONNAISSANCE: Scan Immutable Master Key Arrays
    let adminMatch = null;
    if (Array.isArray(window.MASTER_ADMIN_KEYS)) {
        adminMatch = window.MASTER_ADMIN_KEYS.find(key => 
            String(key.studentNumber).trim().toLowerCase() === typedNumber.toLowerCase()
        );
    }

    if (adminMatch) {
        console.log(`👑 Administrative Key Match Verified: Granting [${adminMatch.role}] Access...`);
        
        const adminSessionToken = {
            name: adminMatch.name,
            studentNumber: adminMatch.studentNumber,
            program: adminMatch.program,
            year: adminMatch.year,
            role: adminMatch.role,
            accessMode: "ADMIN_HUB"
        };

        window.commitSessionAndRedirect(adminSessionToken);
        
        // 🎯 FORCE SPA DASHBOARD RENDER ON VERIFICATION
        if (typeof showDashboard === 'function') {
            await showDashboard();
        }
        return;
    }

    // 3. STAGE 2 RECONNAISSANCE: Scan the Live Supabase Database Engine
    let studentMatch = null;
    try {
        console.log("🌐 Dialing Supabase API gateway to query student record...");
        const { data, error } = await window.supabase
            .from('authorized_students_registry')
            .select('*')
            .eq('student_number', typedNumber)
            .maybeSingle();

        if (error) throw error;
        studentMatch = data;
    } catch (e) {
        console.error("❌ Supabase Network Connection Failure:", e);
        if (typeof window.showToast === 'function') {
            window.showToast("Database Link Error", "Unable to establish a secure connection with the live authentication server.", "error");
        }
        return;
    }

    if (studentMatch) {
        if (studentMatch.name.toLowerCase() !== typedName.toLowerCase()) {
            if (typeof window.showToast === 'function') {
                window.showToast("Security Mismatch Fault", "The submitted name parameter identity does not align with the security token record registered to this Student Number.", "warning");
            } else {
                alert("Security Mismatch: The provided Name does not align with the security record registered to this Student Number.");
            }
            return;
        }

        // =========================================================================
        // 🔑 STAGE 3 INTERCEPT: SECURITY PIN VERIFICATION FOR RETURNING STUDENTS
        // =========================================================================
        const hasExistingPin = studentMatch.security_pin && String(studentMatch.security_pin).trim() !== '';

        if (hasExistingPin) {
            console.log("🔑 Security PIN detected for returning student. Initiating PIN verification checkpoint...");
            
            // Check for DOM input field `#login-security-pin` or trigger modal dialog
            const pinInputElement = document.getElementById('login-security-pin');
            let enteredPin = pinInputElement ? pinInputElement.value.trim() : null;

            if (!enteredPin) {
                enteredPin = await showPinChallengeModal();
            }

            if (!enteredPin || enteredPin.trim() !== String(studentMatch.security_pin).trim()) {
                console.warn("🛑 Access Denied: Invalid Security PIN provided.");
                if (typeof window.showToast === 'function') {
                    window.showToast("Access Denied", "Invalid Security PIN entered. Authentication halted.", "error");
                } else {
                    alert("Access Denied: Invalid Security PIN.");
                }
                return;
            }
            console.log("✅ Security PIN successfully validated.");
        }
        console.log("👤 Authorized Student Key Match Verified. Checking for active multi-device conflicts...");
        
        // 🛠️ GENERATE FINGERPRINT AT POINT OF LOGIN
        const hardwareFingerprint = typeof generateBrowserFingerprint === 'function' ? generateBrowserFingerprint() : "fallback-fingerprint";

        // Assemble initial user payload token context
        const studentSessionToken = {
            name: studentMatch.name,
            studentNumber: studentMatch.student_number,
            program: studentMatch.program, 
            year: studentMatch.year,      
            role: studentMatch.role || "STUDENT",
            accessMode: "STANDARD_STUDENT",
            deviceFingerprint: hardwareFingerprint,
            pin_required: !hasExistingPin,
            payment_status: studentMatch.payment_status || "UNPAID",
            isSubscribed: (studentMatch.payment_status === "PAID")
        };

        try {
            // 📡 Check the backend session ledger safely using .maybeSingle()
            const { data: activeSession, error: sessionErr } = await window.supabase
                .from('portal_active_sessions_ledger')
                .select('*')
                .eq('student_number', studentSessionToken.studentNumber)
                .maybeSingle();

            if (sessionErr) throw sessionErr;

            if (!activeSession) {
                console.log("ℹ️ No active session record found for this student.");
            } else {
                console.log("🔒 Active session detected:", activeSession);
            }

            // 🛑 CRITICAL INTERCEPTION POINT: Account is active elsewhere!
            if (activeSession) {
                const challengePassed = typeof window.handleSessionConflictFlow === 'function' ? await window.handleSessionConflictFlow(studentSessionToken.studentNumber) : true;
                
                if (!challengePassed) {
                    console.log("❌ Login sequence cancelled or blocked by student device override checkpoint.");
                    return; 
                }
                
                console.log("✨ Challenge passed! Overwriting active terminal node context via direct override challenge query.");
                
                // Fetch updated credentials post-challenge safely using .maybeSingle()
                const { data: updatedMatch } = await window.supabase
                    .from('authorized_students_registry')
                    .select('*')
                    .eq('student_number', studentSessionToken.studentNumber)
                    .maybeSingle();

                if (updatedMatch) {
                    studentSessionToken.payment_status = updatedMatch.payment_status || "UNPAID";
                    studentSessionToken.isSubscribed = (updatedMatch.payment_status === "PAID");
                    console.log(`📡 Live payment status synchronized post-challenge: ${studentSessionToken.payment_status}`);
                }
            }

            // Register or overwrite session token atomically using upsert
            console.log("📡 Registering live hardware tracking token to persistent ledger...");
            const { error: upsertErr } = await window.supabase
                .from('portal_active_sessions_ledger')
                .upsert(
                    {
                        student_number: studentSessionToken.studentNumber,
                        name: studentSessionToken.name,
                        program: studentSessionToken.program,
                        year: Number(studentSessionToken.year),
                        last_active_time: new Date().toLocaleTimeString(),
                        device_fingerprint: hardwareFingerprint
                    },
                    { onConflict: 'student_number' }
                );

            if (upsertErr) throw upsertErr;

            localStorage.setItem('neural_link_device_fingerprint', hardwareFingerprint);
            console.log("✅ Database session hardware footprint written securely.");

        } catch (err) {
            console.error("❌ Failed to resolve concurrent checkpoint logic layer:", err);
            if (typeof window.showToast === 'function') {
                window.showToast("System Interconnection Error", "Unable to finalize structural conflict resolution checking routines.", "error");
            }
            return;
        }

        // 🚀 Final Entry: Save dynamic verified state
        window.commitSessionAndRedirect(studentSessionToken);
        
        // 🎯 FORCE SPA DASHBOARD RENDER ON VERIFICATION
        if (typeof showDashboard === 'function') {
            console.log("Executing UI view state transition to core workspace...");
            await showDashboard();
        }
        return;
    }

    // 4. FALLBACK: Rejection Protocol
    console.warn("🛑 Access Violation: Credentials rejected by security subsystem.");
    
    if (typeof window.showToast === 'function') {
        window.showToast("Authentication Fault", "Access Denied. Your credentials were not recognized by the central identity registry node.", "error");
    } else {
        alert("ACCESS DENIED\nYour credentials were not recognized by the security system registry.");
    }
};
window.initializeHeartbeatMonitor = function(studentNumber) {
    if (!studentNumber) return;
    
    const channelName = `live-sync-${studentNumber}`;
    console.log(`📡 Opening real-time Supabase synchronization channel for student: ${studentNumber}`);

    // 1. Initial Safety Check: Ensure the user actually has an active UI session context
    const activeSessionData = sessionStorage.getItem('neural_link_active_session');
    if (!activeSessionData) {
        console.log("🛑 Active session payload missing. Skipping real-time synchronization link.");
        return;
    }

    // 🎯 CRITICAL BUG FIX: If an active channel already exists for this subscription path, purge it first!
    if (window.activeStudentChannel) {
        console.log(`♻️ Stale real-time client instance detected. Unsubscribing from existing pipeline...`);
        window.supabase.removeChannel(window.activeStudentChannel);
    }

    // 2. Kill switch helper to clean up the channel if the user logs out or gets locked out
    const terminateRealtimeChannel = () => {
        console.log(`🔌 Severing real-time channel link for: ${studentNumber}`);
        window.supabase.removeChannel(studentChannel);
    };

    // 3. Create a single combined channel to listen for BOTH profile updates and session evictions
    const studentChannel = window.supabase.channel(channelName)
        // 🔄 STREAM A: Listen for changes to the Student's Registry Profile
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'authorized_students_registry',
                filter: `student_number=eq.${studentNumber}`
            },
            (payload) => {
                const updatedProfile = payload.new;
                if (!updatedProfile) return;
                
                console.log("💓 Real-time profile state change detected:", updatedProfile.payment_status);

                const identityRack = document.querySelector('#terminal-identity-rack');

                // 🟡 HANDLE 'PROCESSING' STATE DIRECTLY TO PREVENT UI OVERWRITE
                if (updatedProfile.payment_status === "PROCESSING") {
                    if (identityRack) {
                        identityRack.innerHTML = `
                            <span class="px-3 py-1 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                                Verifying Payment...
                            </span>
                        `;
                    }
                } else if (updatedProfile.payment_status === "UNPAID") {
                    console.warn("⚠️ Subscription timeline exhaustion caught by real-time stream!");
                    
                    terminateRealtimeChannel();

                    if (typeof window.triggerLockoutOverlay === 'function') {
                        window.triggerLockoutOverlay();
                    } else {
                        window.location.reload();
                    }
                }
            }
        )
        // 🛑 STREAM B: Listen for Session Deletions (Multi-device concurrent conflict kick-out)
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'portal_active_sessions_ledger',
                filter: `student_number=eq.${studentNumber}`
            },
            (payload) => {
                console.warn("💥 Concurrent session conflict: This terminal instance has been overridden!");
                
                terminateRealtimeChannel();

                if (typeof window.showToast === 'function') {
                    window.showToast("Session Terminated", "This account has logged in from another device. Terminating current instance.", "error");
                }
                
                // Force-clear session and route back to entry security gate
                sessionStorage.removeItem('neural_link_active_session');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`🚀 Secure real-time pipeline established for node ${studentNumber}. Monitoring changes...`);
            }
        });

    // Attach the channel instance to the window space globally
    window.activeStudentChannel = studentChannel;
};
window.handleSessionConflictFlow = function(studentNumber) {
    return new Promise((resolve) => {
        // 1. Create the persistent wrapper overlay
        const overlay = document.createElement('div');
        overlay.id = "security-challenge-overlay";
        overlay.className = "fixed inset-0 w-screen h-screen bg-[#0a0e17]/85 backdrop-blur-md flex items-center justify-center font-sans z-[999999]";
        
        // Append it immediately to the body
        document.body.appendChild(overlay);

        // State variables
        let currentStep = "confirm"; // Options: confirm | pin

        // 2. Render Engine Function to easily swap steps without page reloads
        function renderWizard() {
            if (currentStep === "confirm") {
                overlay.innerHTML = `
                    <div class="relative z-[1000000] bg-gradient-to-br from-[#161c2a] to-[#0e121b] border border-blue-500/20 shadow-2xl rounded-xl p-8 max-w-md w-[90%] text-center text-gray-100 animate-in fade-in zoom-in duration-300">
                        <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-5 text-blue-400 text-3xl animate-pulse">
                            ℹ️
                        </div>
                        <h3 class="m-0 mb-2 text-xl font-semibold tracking-tight text-white">Active Session Detected</h3>
                        <p class="m-0 mb-1 text-xs uppercase text-gray-400 tracking-wider font-medium">Clinical Neural Link Security Gate</p>
                        <hr class="border-0 border-t border-white/10 my-4">
                        <p class="m-0 mb-6 text-sm leading-relaxed text-gray-300 text-left">
                            This student profile currently holds an active connection lease on another node terminal. Authorizing this terminal will issue an automatic remote eviction command to the alternative device. Do you wish to assume session control?
                        </p>
                        <div class="flex flex-col sm:flex-row gap-3">
                            <button type="button" id="wizard-cancel-btn" class="w-full bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium py-3 px-5 text-sm rounded-md transition duration-200 cursor-pointer border border-slate-700">Cancel Request</button>
                            <button type="button" id="wizard-proceed-btn" class="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-5 text-sm rounded-md transition duration-200 shadow-lg shadow-blue-500/10 hover:opacity-90 cursor-pointer">Authorize Terminal</button>
                        </div>
                    </div>
                `;
                
                // Event bindings for Step 1
                document.getElementById('wizard-cancel-btn').onclick = () => { overlay.remove(); resolve(false); };
                document.getElementById('wizard-proceed-btn').onclick = () => { currentStep = "pin"; renderWizard(); };
            
            } else if (currentStep === "pin") {
                overlay.innerHTML = `
                    <div class="relative z-[1000000] bg-gradient-to-br from-[#161c2a] to-[#0e121b] border border-amber-500/20 shadow-2xl rounded-xl p-8 max-w-md w-[90%] text-center text-gray-100 animate-in slide-in-from-right duration-300">
                        <div class="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-400 text-3xl">
                            🔒
                        </div>
                        <h3 class="m-0 mb-2 text-xl font-semibold tracking-tight text-white">Security Identity Challenge</h3>
                        <p class="m-0 mb-1 text-xs uppercase text-gray-400 tracking-wider font-medium">Verify Session Authorization Context</p>
                        <hr class="border-0 border-t border-white/10 my-4">
                        <p class="m-0 mb-4 text-sm leading-relaxed text-gray-300 text-left">
                            Please provide your institutional 4-digit Security PIN to safely transfer your active session identity ledger to this hardware target.
                        </p>
                        
                        <!-- Dynamic Error Alert Sub-Partition Container -->
                        <div id="wizard-error-box" class="hidden mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-left font-medium animate-in fade-in"></div>

                        <form id="wizard-pin-form" class="flex flex-col gap-4">
                            <input type="password" id="wizard-pin-input" maxlength="4" placeholder="••••" required autocomplete="off"
                                class="border p-3 rounded-lg text-center tracking-[1em] font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-800 text-white border-slate-600">
                            
                            <div class="flex flex-col sm:flex-row gap-3">
                                <button type="button" id="wizard-back-btn" class="w-full bg-slate-800 hover:bg-slate-700 text-gray-300 font-medium py-3 px-5 text-sm rounded-md transition duration-200 cursor-pointer border border-slate-700">Back</button>
                                <button type="submit" id="wizard-submit-btn" class="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold py-3 px-5 text-sm rounded-md transition duration-200 shadow-lg shadow-amber-500/10 hover:opacity-90 cursor-pointer">Verify & Connect</button>
                            </div>
                        </form>
                    </div>
                `;

                // Focus pin input instantly
                setTimeout(() => document.getElementById('wizard-pin-input')?.focus(), 50);

                // Event bindings for Step 2
                document.getElementById('wizard-back-btn').onclick = () => { currentStep = "confirm"; renderWizard(); };
                
                document.getElementById('wizard-pin-form').onsubmit = async (e) => {
                    e.preventDefault();
                    const enteredPin = document.getElementById('wizard-pin-input').value.trim();
                    const errorBox = document.getElementById('wizard-error-box');
                    const submitBtn = document.getElementById('wizard-submit-btn');

                    if (enteredPin.length < 4) {
                        errorBox.textContent = "Authentication Blocked: Complete 4-digit Security PIN verification is required.";
                        errorBox.classList.remove('hidden');
                        return;
                    }

                    // Visual Loading State Indication
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Verifying Link...";
                    errorBox.classList.add('hidden');

                    try {
                        // 📡 STEP 1: Verify PIN directly from Supabase authorized registry
                        const { data: studentRecord, error: fetchErr } = await window.supabase
                            .from('authorized_students_registry')
                            .select('security_pin')
                            .eq('student_number', studentNumber)
                            .maybeSingle();

                        if (fetchErr || !studentRecord) {
                            throw new Error("Student identity node could not be retrieved.");
                        }

                        // Check input pin mismatch against the source of truth profile record
                        if (String(studentRecord.security_pin).trim() !== enteredPin) {
                            errorBox.textContent = "Access Denied: The provided Security PIN context is invalid.";
                            errorBox.classList.remove('hidden');
                            submitBtn.disabled = false;
                            submitBtn.textContent = "Verify & Connect";
                            return;
                        }

                        // 📡 STEP 2: PIN matches! Clear out conflicting active session ledger row
                        // This triggers the real-time kickout event on the other device instantly!
                        const { error: deleteErr } = await window.supabase
                            .from('portal_active_sessions_ledger')
                            .delete()
                            .eq('student_number', studentNumber);

                        if (deleteErr) {
                            throw new Error("Unable to clear existing connection lease constraints.");
                        }

                        // Success! Dismantle overlay layer completely and exit out cleanly
                        overlay.remove();
                        resolve(true);

                    } catch (err) {
                        console.error("❌ Session clear execution fault:", err);
                        errorBox.textContent = "System Fault: Identity verification communication timed out or database dropped link.";
                        errorBox.classList.remove('hidden');
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Verify & Connect";
                    }
                };
            }
        }

        // Initialize the wizard's baseline state loop
        renderWizard();
    });
};
// 📦 COMPANION SESSION MANAGER: SERIALIZES CREDENTIALS AND RECONFIGURES HOME VIEWPORT
window.commitSessionAndRedirect = function(sessionTokenObject) {
    // 🚀 STAMP THE TIMEFINGERPRINT: Ensure this specific node instance gets a unique millisecond marker
    if (!sessionTokenObject.loginEpoch) {
        sessionTokenObject.loginEpoch = Date.now();
    }

    // 🔄 OPTION A UPDATE: Save session payload to session storage registry tracking partition
    sessionStorage.setItem('neural_link_active_session', JSON.stringify(sessionTokenObject));
    window.currentUserSession = sessionTokenObject;
    
    // 📡 LIVE HEARTBEAT MONITORED: Spin up background tracking if a normal student profile logs in
    if (sessionTokenObject.role === "STUDENT" && typeof window.initializeHeartbeatMonitor === 'function') {
        window.initializeHeartbeatMonitor(sessionTokenObject.studentNumber);
    }

    // 🚀 SUCCESS: Trigger the professional theme-matched toast notification
    if (typeof window.showToast === 'function') {
        window.showToast(
            "Access Matrix Verified", 
            `Welcome back, ${sessionTokenObject.name.toUpperCase()}! Secure portal workspace session node initialized successfully.`, 
            "success"
        );
        
        setTimeout(() => {
            // 🚦 THE ROUTING GATEWAY
            if (sessionTokenObject.accessMode === "ADMIN_HUB") {
                console.log("🛠️ Route Match: Initializing Admin Workspace via toast redirect delay...");
                if (typeof window.showAdminWorkspace === 'function') {
                    window.showAdminWorkspace();
                } else {
                    console.error("CRITICAL: window.showAdminWorkspace is not defined!");
                    window.location.reload();
                }
            } else {
                console.log("🎓 Route Match: Initializing Student/Godmode Dashboard via toast redirect delay...");
                if (typeof window.showDashboard === 'function') {
                    window.showDashboard();
                } else if (typeof window.renderMainDashboardView === 'function') {
                    window.renderMainDashboardView();
                } else {
                    window.location.reload();
                }
            }
        }, 2500);

    } else {
        // Safe fallback protection layer
        alert(`Welcome back, ${sessionTokenObject.name.toUpperCase()}!\nAccess token verified successfully.`);
        
        if (sessionTokenObject.accessMode === "ADMIN_HUB") {
            if (typeof window.showAdminWorkspace === 'function') {
                window.showAdminWorkspace();
            } else {
                window.location.reload();
            }
        } else {
            if (typeof window.showDashboard === 'function') {
                window.showDashboard();
            } else if (typeof window.renderMainDashboardView === 'function') {
                window.renderMainDashboardView();
            } else {
                window.location.reload();
            }
        }
    }
};
// 🟢 LIVE TRACKING HELPER: MANAGEMENT ENGINE FOR LIVE RECORD MONITORS (Requirement #3)
window.registerLiveActiveSession = async function(sessionToken) {
    console.log("📡 Registering live node parameters into the Supabase session ledger...");

    // 1. Format payload to match your PostgreSQL table columns exactly
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Retrieve the persistent device fingerprint built during initial login checkpoint checks
    const hardwareFingerprint = localStorage.getItem('neural_link_device_fingerprint') || "UNKNOWN_NODE";

    const sessionPayload = {
        student_number: String(sessionToken.studentNumber),
        name: sessionToken.name,
        // Fallback safety checks for system admins/backdoors
        program: sessionToken.program === "ALL" ? "mbchb" : sessionToken.program, 
        year: sessionToken.year === "ALL" ? 3 : parseInt(sessionToken.year, 10),
        last_active_time: timeString,
        device_fingerprint: hardwareFingerprint
    };

    try {
        // 2. Transmit session row directly to your Supabase engine via an atomic upsert command
       // 2. Transmit session row directly to your Supabase engine via an atomic upsert command
        const { data, error } = await window.supabase
            .from('portal_active_sessions_ledger')
            .upsert(sessionPayload, { onConflict: 'student_number' })
            .select();

        // If the Supabase request fails, throw the error context straight to the catch block
        if (error) throw error;

        console.log("✅ Session ledger successfully written to central Supabase cloud ledger:", data);

    } catch (error) {
        console.warn("ℹ️ Supabase session ledger sync failed or skipped:", error?.message || error);
        if (typeof triggerLocalFallback === 'function') {
            triggerLocalFallback(sessionToken, timeString);
        }
    }
    
};

// Helper function to handle the local storage fallback cleanly without duplicating code
function triggerLocalFallback(sessionToken, timeString) {
    let globalActiveSessions = [];
    try {
        globalActiveSessions = JSON.parse(localStorage.getItem('portal_active_sessions_ledger')) || [];
    } catch(e) {
        globalActiveSessions = [];
    }

    // Retrieve the device fingerprint to keep the payload consistent
    const hardwareFingerprint = localStorage.getItem('neural_link_device_fingerprint') || "UNKNOWN_NODE";

    // 🎯 FIXED: Filter using the correct unified column property name
    globalActiveSessions = globalActiveSessions.filter(s => 
        (s.student_number || s.studentNumber) !== (sessionToken.studentNumber || sessionToken.student_number)
    );
    
    // 🎯 FIXED: Format fields to match your PostgreSQL table columns exactly (snake_case)
    globalActiveSessions.push({
        student_number: String(sessionToken.studentNumber || sessionToken.student_number),
        name: sessionToken.name,
        program: sessionToken.program === "ALL" ? "mbchb" : sessionToken.program,
        year: sessionToken.year === "ALL" ? 3 : parseInt(sessionToken.year, 10),
        last_active_time: timeString,
        device_fingerprint: hardwareFingerprint
    });

    localStorage.setItem('portal_active_sessions_ledger', JSON.stringify(globalActiveSessions));
    console.log("💾 Offline Fallback Engine: Synchronized session state to local backup ledger.");
}
// ==========================================
// 🛡️ PHASE B: PORTAL CONTROL SYSTEM ENGINE
// ==========================================

// 1. RENDER CALL: Generates the Identity & Access Management Control Panel Canvas
window.renderPortalControlSystemView = async function() {
    const contentArea = document.getElementById('dashboard-content');
    if (!contentArea) return;

    // 1. Security Gate Check: Hard restriction blocking unauthorized access attempts
    if (!window.currentUserSession || window.currentUserSession.role !== 'SUPER_ADMIN') {
        contentArea.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center text-center p-12">
                <div class="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20 mb-4 animate-bounce">
                    <i data-lucide="shield-alert" class="w-8 h-8"></i>
                </div>
                <h2 class="text-xl font-black text-white uppercase tracking-wider">Access Level Violation</h2>
                <p class="text-xs text-slate-500 uppercase tracking-widest mt-2 max-w-sm">This system node contains administrative tools restricted exclusively to SUPER_ADMIN identities.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // 2. Render Temporary UX Pipeline Loading State
    contentArea.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-center p-12 animate-pulse">
            <i data-lucide="refresh-cw" class="w-6 h-6 text-purple-500 animate-spin mb-3"></i>
            <span class="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Querying live identity registry matrix...</span>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    // 3. Establish Live Supabase Network Synchronization
    let registeredStudents = [];
    let liveSessions = [];
    
    try {
        // Query live student roster records sequentially from Supabase
        const studentsQuery = await window.supabase
            .from('authorized_students_registry')
            .select('*');
        
        if (studentsQuery.error) throw studentsQuery.error;
        registeredStudents = studentsQuery.data || [];
        
        // Query live session layers directly from your cloud database tracking ledger
        const sessionsQuery = await window.supabase
            .from('portal_active_sessions_ledger')
            .select('*');

        if (sessionsQuery.error) {
            console.warn("⚠️ Cloud session fetch skipped. Triggering engine fallback array mapping...", sessionsQuery.error);
            // Gracefully drop back into local redundancy matrix if table fetch fails
            liveSessions = JSON.parse(localStorage.getItem('portal_active_sessions_ledger')) || [];
        } else {
            liveSessions = sessionsQuery.data || [];
        }

    } catch(e) {
        console.error("Critical fault syncing registry rosters from live Supabase infrastructure:", e);
        contentArea.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center text-center p-12">
                <div class="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20 mb-4">
                    <i data-lucide="wifi-off" class="w-5 h-5"></i>
                </div>
                <h2 class="text-xs font-black text-white uppercase tracking-wider">Database Connection Failure</h2>
                <p class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Unable to pull roster indices from the backend cloud architecture.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    // Mapping dictionary for clean human-readable presentation labels
    const programLabels = {
        'mbchb': 'MBChB Program',
        'biomedical': 'Biomedical Sciences',
        'public_health': 'Public Health',
        'environmental': 'Environmental Health'
    };

    // Structural Grouping Engine: Split student nodes cleanly by program configurations
    const groupedPrograms = { mbchb: [], biomedical: [], public_health: [], environmental: [] };
    
    registeredStudents.forEach(student => {
        const progKey = (student.program || '').toLowerCase();
        if (groupedPrograms[progKey] !== undefined) {
            groupedPrograms[progKey].push(student);
        } else {
            // Default fallback safety valve for undefined entries
            if (!groupedPrograms['mbchb']) groupedPrograms['mbchb'] = [];
            groupedPrograms['mbchb'].push(student);
        }
    });

    // Sort inner array items structurally by Year Level sequentially (Year 2 -> Year 6)
    Object.keys(groupedPrograms).forEach(key => {
        groupedPrograms[key].sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    });

    // 4. Paint the Main Central Security Console Canvas
    contentArea.innerHTML = `
        <div class="w-full h-full max-w-6xl mx-auto flex flex-col animate-in fade-in duration-300 pt-6 px-4 pb-12 overflow-y-auto">
            
            <div class="mb-8 border-b border-slate-800/40 pb-4">
                <h2 class="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    Central Security Console
                </h2>
                <p class="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">Identity directory administration & active session monitors</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                <div class="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
                    <h3 class="text-xs font-black text-white uppercase tracking-widest mb-6 pb-2 border-b border-slate-800 flex items-center gap-2 text-purple-400">
                        <i data-lucide="user-plus" class="w-4 h-4"></i> Authorize New Access Node
                    </h3>
                    
                    <form id="admin-add-student-form" onsubmit="window.handleRegisterNewStudent(event)" class="space-y-5">
                        <div>
                            <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Student Full Name</label>
                            <input type="text" id="reg-student-name" required placeholder="e.g. Danny Phiri" autocomplete="off"
                                class="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white rounded-xl p-3 outline-none transition-all font-medium">
                        </div>

                        <div>
                            <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Assign Student Key / ID Number</label>
                            <input type="text" id="reg-student-number" required placeholder="e.g. 20261004" autocomplete="off"
                                class="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white rounded-xl p-3 outline-none transition-all font-mono">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Academic Program</label>
                                <select id="reg-student-program" class="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white rounded-xl p-3 outline-none transition-all cursor-pointer">
                                    <option value="mbchb">MBChB</option>
                                    <option value="biomedical">Biomedical</option>
                                    <option value="public_health">Public Health</option>
                                    <option value="environmental">Environmental</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Assigned Year</label>
                                <select id="reg-student-year" class="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white rounded-xl p-3 outline-none transition-all cursor-pointer">
                                    <option value="2">Year 02</option>
                                    <option value="3">Year 03</option>
                                    <option value="4">Year 04</option>
                                    <option value="5">Year 05</option>
                                    <option value="6">Year 06</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl py-3.5 shadow-lg shadow-purple-950/40 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2">
                            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Grant Portal Access
                        </button>
                    </form>
                </div>

                <div class="lg:col-span-7 space-y-8">
                    
                    <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
                        <h3 class="text-xs font-black text-white uppercase tracking-widest mb-4 pb-2 border-b border-slate-800 flex items-center gap-2 text-emerald-400">
                            <i data-lucide="activity" class="w-4 h-4"></i> Live Session Monitor
                        </h3>
                        
                        <div class="overflow-x-auto w-full">
                            <table class="w-full text-left text-xs text-slate-300 border-collapse">
                                <thead>
                                    <tr class="border-b border-slate-800/50 text-[9px] uppercase tracking-wider font-black text-slate-500">
                                        <th class="py-3 px-2">Active User</th>
                                        <th class="py-3 px-2">Access Role / Core Scope</th>
                                        <th class="py-3 px-2 text-right">Last Interaction</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-800/30">
                                    ${liveSessions.length === 0 ? `
                                        <tr>
                                            <td colspan="3" class="py-6 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">No active remote node sessions detected.</td>
                                        </tr>
                                    ` : liveSessions.map(session => {
                                        const currentStudentNumber = session.student_number || session.studentNumber;
                                        const activeTime = session.last_active_time || session.lastActiveTime;
                                        return `
                                        <tr class="hover:bg-slate-800/20 transition-colors">
                                            <td class="py-3 px-2 flex items-center gap-2">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow shadow-emerald-400 animate-ping"></span>
                                                <div>
                                                    <span class="font-black text-white uppercase block">${session.name}</span>
                                                    <span class="text-[9px] font-mono text-slate-500">${currentStudentNumber}</span>
                                                </div>
                                            </td>
                                            <td class="py-3 px-2 vertical-middle">
                                                <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 tracking-wider text-purple-400">
                                                    ${String(session.program).toUpperCase()} — Y0${session.year}
                                                </span>
                                            </td>
                                            <td class="py-3 px-2 text-right font-mono text-[10px] text-emerald-400 font-bold">${activeTime}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
                        <h3 class="text-xs font-black text-white uppercase tracking-widest mb-4 pb-2 border-b border-slate-800 flex items-center gap-2 text-blue-400">
                            <i data-lucide="users" class="w-4 h-4"></i> Authorized Access Directory
                        </h3>
                        
                        <div class="w-full max-h-[480px] overflow-y-auto space-y-6 pr-1">
                            ${registeredStudents.length === 0 ? `
                                <table class="w-full text-left text-xs text-slate-300 border-collapse">
                                    <tbody>
                                        <tr>
                                            <td class="py-6 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Access Directory registry database is empty.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ` : Object.keys(groupedPrograms).map(programKey => {
                                const studentsInProgram = groupedPrograms[programKey];
                                if (studentsInProgram.length === 0) return ''; // Skip empty program tables cleanly
                                
                                return `
                                    <div class="border border-slate-800/60 rounded-xl bg-slate-950/30 overflow-hidden">
                                        <div class="bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 flex justify-between items-center">
                                            <h4 class="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                ${programLabels[programKey] || programKey.toUpperCase()}
                                            </h4>
                                            <span class="text-[9px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold">
                                                COUNT: ${studentsInProgram.length}
                                            </span>
                                        </div>
                                        <table class="w-full text-left text-xs text-slate-300 border-collapse">
                                            <thead>
                                                <tr class="border-b border-slate-800/30 text-[8px] uppercase tracking-wider font-black text-slate-600 bg-slate-950/40">
                                                    <th class="py-2 px-4">Registered Student</th>
                                                    <th class="py-2 px-2">Assigned Year</th>
                                                    <th class="py-2 px-4 text-right">Management Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-slate-800/20">
                                                ${studentsInProgram.map(student => {
                                                    const currentStudentNumber = student.student_number || student.studentNumber;
                                                    return `
                                                    <tr class="hover:bg-slate-800/10 transition-colors">
                                                        <td class="py-2.5 px-4">
                                                            <span class="font-bold text-white uppercase block text-xs">${student.name}</span>
                                                            <span class="text-[9px] font-mono text-purple-400 font-bold">${currentStudentNumber}</span>
                                                        </td>
                                                        <td class="py-2.5 px-2">
                                                            <span class="text-[9px] font-mono bg-blue-950/60 text-blue-400 border border-blue-900/60 px-2 py-0.5 rounded-md uppercase tracking-wider font-bold">
                                                                Year ${student.year}
                                                            </span>
                                                        </td>
                                                        <td class="py-2.5 px-4 text-right">
                                                            <button onclick="window.handleRevokeStudentAccess('${currentStudentNumber}')"
                                                                class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                                                                Revoke Access
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
};
// ==========================================
// 🛡️ RE-ENGINEERED REVOCATION PROTOCOL (PHASE 2)
// ==========================================
window.handleRevokeStudentAccess = async function(studentNumberTarget) {
    if (!confirm("CRITICAL ADMINISTRATIVE SECURITY WARNING:\n\nAre you sure you want to revoke this student's portal clearance credentials?\nThey will be immediately logged out and blocked from logging in.")) {
        return;
    }

    try {
        console.log(`📡 Initializing eviction protocol in Supabase cloud layers for target: [${studentNumberTarget}]`);

       // 1. Execute direct database elimination from the primary student roster
const studentEviction = await window.supabase
    .from('authorized_students_registry') // 🟩 Fixed: Points to your real database table
    .delete()
    .eq('student_number', studentNumberTarget);

        if (studentEviction.error) throw studentEviction.error;
        console.log("✅ Identity successfully expunged from primary 'students' database table.");

        // 2. Clear out any active sessions from the central tracking ledger
        const sessionEviction = await window.supabase
            .from('portal_active_sessions_ledger')
            .delete()
            .eq('student_number', studentNumberTarget);

        if (sessionEviction.error) {
            console.warn("⚠️ Remote session eviction skipped or ledger clear missed:", sessionEviction.error);
        } else {
            console.log("✅ Active session record terminated in cloud tracking ledger.");
        }

        // 3. Keep local fallback redundancy array synchronized
        let activeSessions = [];
        try {
            activeSessions = JSON.parse(localStorage.getItem('portal_active_sessions_ledger')) || [];
        } catch(e) { 
            activeSessions = []; 
        }
        
        // Filter using both property forms defensively to maintain absolute local safety
        activeSessions = activeSessions.filter(s => 
            String(s.studentNumber || s.student_number) !== String(studentNumberTarget)
        );
        localStorage.setItem('portal_active_sessions_ledger', JSON.stringify(activeSessions));

        // 4. Force state engine redraw to visually drop them out of the tables instantly
        if (typeof window.renderPortalControlSystemView === 'function') {
            await window.renderPortalControlSystemView();
        }

    } catch (error) {
        console.error("❌ Critical System Exception caught during Supabase eviction execution:", error);
        alert(`System Link Failure:\n${error.message || "Could not execute access revocation command on the database."}`);
    }
};
// 2. FORM ACTION CONTROLLER: PERSISTS NEW USERS INTO LOCAL STORAGE ROSTERS
window.handleRegisterNewStudent = async function(event) {
    event.preventDefault();

    const nameNode = document.getElementById('reg-student-name');
    const numberNode = document.getElementById('reg-student-number');
    const programNode = document.getElementById('reg-student-program');
    const yearNode = document.getElementById('reg-student-year');

    if (!nameNode || !numberNode || !programNode || !yearNode) return;

    // 1. Build Payload mapped explicitly to match your Supabase column structures
    const newStudentPayload = {
        name: nameNode.value.trim(),
        student_number: numberNode.value.trim(),   // Snake_case target matches database structure
        program: programNode.value.toLowerCase(),   // Normalizing case formatting
        year: parseInt(yearNode.value, 10),         // Enforces clean integer numbers for PostgreSQL
        role: "STUDENT",
        pin_required: true,                         // Maps to your pin_required boolean column
        security_pin: null                          // 🎯 FIX: Changed 'pin' to 'security_pin' to match your schema
    };

    // Parameter baseline validation
    if (!newStudentPayload.name || !newStudentPayload.student_number || !newStudentPayload.program || isNaN(newStudentPayload.year)) {
        alert("Registration Blocked: Ensure all registration input fields are filled out correctly.");
        return;
    }

    try {
        console.log("📡 Dispatching provisioning parameters to Supabase cloud table layer...");
        
        // 2. Execute database injection to Supabase table
        const { data, error } = await window.supabase
            .from('authorized_students_registry')
            .insert([newStudentPayload])
            .select();

        // 3. Evaluate Supabase Database Responses
        if (error) {
            console.error("Supabase engine execution rejected entry payload:", error);
            // Catching duplicate identity codes (PostgreSQL code '23505' for unique constraint violations)
            let errorMsg = error.message || "Database transmission rejected.";
            if (error.code === '23505') {
                errorMsg = `A record with the identification key "${newStudentPayload.student_number}" already exists in the registry.`;
            }
            alert(`Registry Registration Fault:\n${errorMsg}`);
            return;
        }

        const savedStudent = data && data[0] ? data[0] : newStudentPayload;
        
        // 4. Reset DOM Input Node states cleanly
        nameNode.value = "";
        numberNode.value = "";
        
        alert(`Success: ${savedStudent.name.toUpperCase()} has been authorized entry permissions into the platform matrix.`);
        
        // 5. Trigger an asynchronous re-render of your dynamic console grid view
        if (typeof window.renderPortalControlSystemView === 'function') {
            await window.renderPortalControlSystemView();
        }

    } catch (error) {
        console.error("❌ Critical System Exception caught during cloud pipeline execution:", error);
        alert("System Link Failure: Could not establish contact with the live identity registry architecture.");
    }
};
// 3. ADMINISTRATIVE DESTRUCTIVE ACTIONS: WIPES OUT STUDENT CREDENTIAL NODES INSTANTLY

// Inside js/access_management.js

// 🟢 Explicitly attach to the window object to resolve the cross-file reference error
// Toggle student number visibility between masked dots and clear text
window.toggleStudentNumberVisibility = function() {
    const input = document.getElementById('login-student-number');
    const eyeIconContainer = document.getElementById('eye-icon-container');
    if (!input || !eyeIconContainer) return;

    if (input.type === 'password') {
        input.type = 'text';
        eyeIconContainer.innerHTML = `<i data-lucide="eye-off" class="w-6 h-6"></i>`;
    } else {
        input.type = 'password';
        eyeIconContainer.innerHTML = `<i data-lucide="eye" class="w-6 h-6"></i>`;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
};

window.renderLogin = function() {
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;
    
    // Explicit flex reset centering container layout style
    viewport.className = "w-full h-full flex items-center justify-center bg-[#050b18]";
    
    viewport.innerHTML = `
        <div id="login-container" class="w-full flex justify-center animate-in fade-in zoom-in duration-700">
            <div class="bg-slate-900 p-12 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
                
                <div class="flex justify-center mb-6">
                    <div class="bg-blue-100 p-4 rounded-full">
                        <i data-lucide="fingerprint" class="text-blue-900 w-12 h-12"></i>
                    </div>
                </div>

                <h1 class="text-3xl font-bold mb-8 text-center text-white tracking-tighter uppercase">Access Portal</h1>
                
                <form id="login-form" class="flex flex-col">
                    <input type="text" id="login-full-name" placeholder="Full Name" required autocomplete="off"
                        class="border p-4 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white border-slate-600 text-lg">
                    
                    <!-- Password-masked Student Number input with eye toggle button -->
                    <div class="relative w-full mb-8">
                        <input type="password" id="login-student-number" placeholder="Student Number" required autocomplete="off"
                            class="w-full border p-4 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-800 text-white border-slate-600 text-lg">
                        
                        <button type="button" onclick="window.toggleStudentNumberVisibility()" 
                            class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white focus:outline-none p-1 transition"
                            aria-label="Toggle Student Number Visibility">
                            <span id="eye-icon-container">
                                <i data-lucide="eye" class="w-6 h-6"></i>
                            </span>
                        </button>
                    </div>
                    
                    <button type="submit"
                        class="bg-blue-700 text-white font-bold rounded-lg py-4 shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition text-xl cursor-pointer">
                        Enter Portal
                    </button>
                </form>
            </div>
        </div>
    `;

    // Initialize Lucide icons on the newly rendered elements
    if (window.lucide) {
        lucide.createIcons();
    } else {
        console.warn("⚠️ Lucide engine not yet loaded on canvas viewport namespace.");
    }

    // Bind form submission to the authentication handler module
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (typeof window.handlePortalLogin === 'function') {
                window.handlePortalLogin();
            }
        });
    }
};
// ==========================================
// 🔔 ADVANCED DYNAMIC TOAST NOTIFICATION ENGINE
// ==========================================

// ==========================================
// 🔔 ADVANCED DYNAMIC TOAST NOTIFICATION ENGINE
// ==========================================
// Updated default duration parameter to 7000ms (7 seconds)
window.showToast = function(title, message, type = 'success', duration = 7000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Fallback protection if container is missing from the DOM canvas template
        console.warn(`[Toast Fallback]: ${title} - ${message}`);
        alert(`${title}\n${message}`);
        return;
    }

    // Enforce a minimum safety ceiling of 7 seconds so no calling script cuts it short
    const displayDuration = duration < 7000 ? 7000 : duration;

    // Assign custom styling vectors based on notification severity type
    const configurationMap = {
        success: {
            bg: 'bg-slate-900/90 border-emerald-500/30 shadow-emerald-950/20',
            iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            icon: 'shield-check',
            textColor: 'text-emerald-400'
        },
        error: {
            bg: 'bg-slate-900/90 border-red-500/30 shadow-red-950/20',
            iconBg: 'bg-red-500/10 text-red-400 border-red-500/20',
            icon: 'shield-alert',
            textColor: 'text-red-400'
        },
        warning: {
            bg: 'bg-slate-900/90 border-amber-500/30 shadow-amber-950/20',
            iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            icon: 'alert-triangle',
            textColor: 'text-amber-400'
        }
    };

    const config = configurationMap[type] || configurationMap.success;

    // Create toast wrapper node element
    const toast = document.createElement('div');
    toast.className = `flex items-start gap-4 p-4 rounded-xl border border-transparent ${config.bg} min-w-[320px] max-w-md shadow-2xl backdrop-blur-md pointer-events-auto transition-all duration-500 transform translate-x-12 opacity-0 animate-in slide-in-from-right-12 fade-in`;

    toast.innerHTML = `
        <div class="p-2 rounded-lg border ${config.iconBg} shrink-0">
            <i data-lucide="${config.icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0 pt-0.5">
            <h4 class="text-[11px] font-black uppercase tracking-wider ${config.textColor}">${title}</h4>
            <p class="text-[10px] text-slate-400 font-medium tracking-normal leading-relaxed mt-0.5 normal-case">${message}</p>
        </div>
        <button class="text-slate-600 hover:text-slate-400 transition-colors shrink-0 pt-0.5 cursor-pointer" onclick="this.parentElement.remove()">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
    `;

    // Append to screen canvas layout
    container.appendChild(toast);

    // Render Lucide icons specifically inside the new component element context
    if (window.lucide) {
        lucide.createIcons({
            attrs: { class: 'lucide' },
            nameAttr: 'data-lucide',
            node: toast
        });
    }

    // Trigger smooth fly-in animation frames
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-12', 'opacity-0');
    });

    // Automated linear countdown teardown execution sequence using calculated displayDuration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('translate-x-12', 'opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, displayDuration);
};
// ==========================================
// 🛡️ ROLE-BASED UI VISIBILITY FILTER
// ==========================================
window.enforceSecurityVisibilityUI = function() {
    // 🎯 STRATEGY A: If we are intentionally inside the Admin Hub view, 
    // stop the security checking function from overriding the active layout!
    if (window.appCurrentViewMode === 'ADMIN_HUB') {
        console.log("🛡️ Security UI adjustments paused: Admin Hub View Mode is explicitly Active.");
        return;
    }

    // 🛡️ SECURITY FALLBACK: If session data is completely missing or blank, force safe default role
    const sessionExists = !!window.currentUserSession;
    const userRole = sessionExists ? window.currentUserSession.role : 'STUDENT';

    // 1. Evaluate clean status permissions for administration interfaces
    const isAdmin = sessionExists && (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN');

    console.log(`📡 Security Sync Active: Role="${userRole}" | Access Privileges Passed=${isAdmin}`);

    // 2. Target the Admin Hub button using the precise ID from your template layout
    const adminHubButton = document.getElementById('admin-hub-btn'); 
    
    if (adminHubButton) {
        if (isAdmin) {
            adminHubButton.classList.remove('hidden');
        } else {
            adminHubButton.classList.add('hidden');
        }
    }

    // 3. Handle destructive structural items (Delete Buttons) across layout cards safely
    const administrativeDestructors = document.querySelectorAll('.admin-delete-trigger');
    administrativeDestructors.forEach(button => {
        if (isAdmin) {
            button.classList.remove('hidden');
        } else {
            if (typeof button.remove === 'function') {
                button.remove(); 
            } else if (button.parentNode) {
                button.parentNode.removeChild(button);
            }
        }
    });
};