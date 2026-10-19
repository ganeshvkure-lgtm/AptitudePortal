/* =====================================================
   GLOBAL STATE & INITIALIZATION
   Version: 2.0
===================================================== */

let questions = [];
let currentQuestion = 0;
let userAnswers = [];
let timerInterval = null;
let timeRemaining = 0;

document.addEventListener("DOMContentLoaded", () => {
  displayUsername();
  applySavedTheme();

  // Initialize Quiz Engine if on the Quiz page
  if (document.getElementById("questionText")) {
    initQuiz();
    
    // ATTACH BUTTON LISTENERS
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    if (nextBtn) nextBtn.onclick = () => changeQuestion(1);
    if (prevBtn) prevBtn.onclick = () => changeQuestion(-1);
    if (submitBtn) submitBtn.onclick = () => submitQuiz();
  }

  // Initialize Results Dashboard if on the Result page
  if (document.getElementById("resultDashboard")) {
    renderResultDashboard();
  }
  
  // Add smooth scrolling to all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});

/* =====================================================
   USER & NAVIGATION
===================================================== */
function displayUsername() {
  const username = localStorage.getItem("username");
  const display = document.getElementById("usernameDisplay");
  const welcomeName = document.getElementById("welcomeName");
  
  if (display && username) {
    display.innerText = username;
  }
  if (welcomeName && username) {
    welcomeName.innerText = username.split(' ')[0];
  }
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("username");
    localStorage.removeItem("userLoginID");
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem("currentTestId");
    localStorage.removeItem("currentTestTime");
    localStorage.removeItem("currentTestTitle");
    localStorage.removeItem("currentCompany");
    localStorage.removeItem("currentSection");
    window.location.href = "login.html";
  }
}

function goBack() {
  if (confirm("Are you sure you want to go back? Your progress may be lost.")) {
    window.history.back();
  }
}

// Redirects to Test Selection instead of directly to quiz
function startQuiz(company, section) {
  localStorage.setItem("currentCompany", company);
  localStorage.setItem("currentSection", section);
  window.location.href = "test-select.html"; 
}

/* =====================================================
   DARK MODE
===================================================== */
function toggleDarkMode() {
  const html = document.documentElement;
  const themeBtn = document.getElementById("themeBtn");
  
  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    localStorage.theme = "light";
    if (themeBtn) themeBtn.innerText = "🌙";
  } else {
    html.classList.add("dark");
    localStorage.theme = "dark";
    if (themeBtn) themeBtn.innerText = "☀️";
  }
}

function applySavedTheme() {
  const html = document.documentElement;
  if (localStorage.theme === "dark" || (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    html.classList.add("dark");
    const themeBtn = document.getElementById("themeBtn");
    if (themeBtn) themeBtn.innerText = "☀️";
  } else {
    html.classList.remove("dark");
    const themeBtn = document.getElementById("themeBtn");
    if (themeBtn) themeBtn.innerText = "🌙";
  }
}

/* =====================================================
   QUIZ ENGINE
===================================================== */
async function initQuiz() {
  const company = localStorage.getItem("currentCompany");
  const section = localStorage.getItem("currentSection");
  const testId = localStorage.getItem("currentTestId");
  
  // Show loading state
  const questionText = document.getElementById("questionText");
  if (questionText) {
    questionText.innerHTML = '<div class="loader"></div><p class="text-center mt-4">Loading questions...</p>';
  }
  
  try {
    // Try to load from Firebase first if db is available
    if (typeof db !== 'undefined' && testId) {
      const snapshot = await db.collection("questions").where("testId", "==", testId).get();
      if (!snapshot.empty) {
        questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }
    
    // Fallback to getQuestions function
    if (questions.length === 0 && typeof getQuestions === "function") {
      questions = await getQuestions();
    }
    
    // Final fallback to localStorage
    if (questions.length === 0) {
      const allQuestions = JSON.parse(localStorage.getItem("customQuestions")) || [];
      questions = allQuestions.filter(q => q.testId === testId);
    }
  } catch (error) {
    console.error("Error loading questions:", error);
    questions = [];
  }

  if (!questions || questions.length === 0) {
    if (questionText) {
      questionText.innerHTML = "⚠️ No questions found. Please contact administrator or add questions in Admin Panel.";
    }
    return;
  }

  // Initialize user answers
  userAnswers = new Array(questions.length).fill(null);
  
  // Load saved answers if any
  const savedAnswers = sessionStorage.getItem(`quiz_answers_${testId}`);
  if (savedAnswers) {
    const parsed = JSON.parse(savedAnswers);
    if (parsed.length === questions.length) {
      userAnswers = parsed;
    }
  }
  
  generatePalette();
  loadQuestion();
  startTimer();
}

function loadQuestion() {
  const q = questions[currentQuestion];
  if (!q) return;
  
  // Update Question UI
  const qNum = document.getElementById("qNum");
  if (qNum) qNum.innerText = `${currentQuestion + 1}/${questions.length}`;
  
  const qText = document.getElementById("questionText");
  if (qText) qText.innerText = q.text;
  
  const subjectBadge = document.getElementById("subjectBadge");
  if (subjectBadge) subjectBadge.innerText = q.subject || "General";

  const optionsDiv = document.getElementById("optionsContainer");
  if (!optionsDiv) return;
  
  optionsDiv.innerHTML = "";
  
  // Render Options
  q.options.forEach((opt, index) => {
    const letter = String.fromCharCode(65 + index);
    const isSelected = userAnswers[currentQuestion] === index;
    
    const btn = document.createElement("button");
    btn.className = `option ${isSelected ? 'selected' : ''}`;
    btn.innerHTML = `
      <span class="option-letter">${letter}</span>
      <span class="option-text">${opt}</span>
    `;
    btn.onclick = () => selectOption(index);
    optionsDiv.appendChild(btn);
  });

  // Update navigation buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (prevBtn) {
    prevBtn.style.display = currentQuestion === 0 ? 'none' : 'inline-flex';
  }
  if (nextBtn) {
    const nextBtnText = document.getElementById('nextBtnText');
    if (nextBtnText) {
      nextBtnText.innerText = currentQuestion === questions.length - 1 ? "finish" : "save & next";
    }
  }

  updatePalette();
  updateProgress();
}

function selectOption(index) {
  userAnswers[currentQuestion] = index;
  
  // Save to sessionStorage
  const testId = localStorage.getItem("currentTestId");
  sessionStorage.setItem(`quiz_answers_${testId}`, JSON.stringify(userAnswers));
  
  // Update UI
  const btns = document.querySelectorAll(".option");
  btns.forEach((btn, i) => {
    if (i === index) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });
  
  updatePalette();
  updateProgress();
}

function changeQuestion(step) {
  currentQuestion += step;
  if (currentQuestion < 0) currentQuestion = 0;
  
  if (currentQuestion >= questions.length) {
    submitQuiz();
  } else {
    loadQuestion();
  }
}

function jumpToQuestion(index) {
  currentQuestion = index;
  loadQuestion();
}

/* =====================================================
   TIMER FUNCTIONALITY
===================================================== */
function startTimer() {
  const totalSeconds = parseInt(localStorage.getItem("currentTestTime") || 30) * 60;
  timeRemaining = parseInt(localStorage.getItem("remainingTime")) || totalSeconds;
  
  const timerElement = document.getElementById("timer");
  if (!timerElement) return;
  
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerElement.innerText = "00:00";
      timerElement.classList.add("timer-warning");
      submitQuiz();
      return;
    }
    
    timeRemaining--;
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    timerElement.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    // Warning when less than 1 minute
    if (timeRemaining < 60) {
      timerElement.classList.add("timer-warning");
    } else {
      timerElement.classList.remove("timer-warning");
    }
    
    localStorage.setItem("remainingTime", timeRemaining);
  }, 1000);
}

/* =====================================================
   UI UPDATES (Palette & Progress)
===================================================== */
function generatePalette() {
  const palette = document.getElementById("paletteGrid");
  if (!palette) return;
  palette.innerHTML = "";
  
  questions.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.className = "palette-num";
    btn.innerText = i + 1;
    btn.onclick = () => { 
      currentQuestion = i; 
      loadQuestion(); 
    };
    palette.appendChild(btn);
  });
}

function updatePalette() {
  const nums = document.querySelectorAll(".palette-num");
  nums.forEach((btn, i) => {
    btn.classList.remove("current", "answered");
    if (i === currentQuestion) btn.classList.add("current");
    if (userAnswers[i] !== null) btn.classList.add("answered");
  });
}

function updateProgress() {
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const total = questions.length;
  const progressPercent = (answeredCount / total) * 100;
  
  const progressBar = document.getElementById("progress");
  const progressStats = document.getElementById("progressStats");
  
  if (progressBar) progressBar.style.width = `${progressPercent}%`;
  if (progressStats) progressStats.innerText = `${answeredCount}/${total}`;
}

/* =====================================================
   SUBMISSION & RESULTS
===================================================== */
async function submitQuiz() {
  if (timerInterval) clearInterval(timerInterval);
  
  let score = 0;
  questions.forEach((q, i) => {
    if (userAnswers[i] === q.correct) score++;
  });
  
  const percentage = Math.round((score / questions.length) * 100);
  
  // Save to Firebase if available
  if (typeof db !== 'undefined') {
    try {
      await db.collection("results").add({
        username: localStorage.getItem("username"),
        testTitle: localStorage.getItem("currentTestTitle"),
        score: score,
        total: questions.length,
        percentage: percentage,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error("Error saving to cloud:", e);
    }
  }
  
  localStorage.setItem("finalScore", score);
  localStorage.setItem("totalQuestions", questions.length);
  localStorage.setItem("lastTestTitle", localStorage.getItem("currentTestTitle"));
  localStorage.setItem("lastPercentage", percentage);
  
  // Clear saved answers
  const testId = localStorage.getItem("currentTestId");
  sessionStorage.removeItem(`quiz_answers_${testId}`);
  localStorage.removeItem("remainingTime");
  
  window.location.href = "result.html";
}

function renderResultDashboard() {
  const total = parseInt(localStorage.getItem("totalQuestions")) || 0;
  const correct = parseInt(localStorage.getItem("finalScore")) || 0;
  const wrong = total - correct;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const percentage = parseInt(localStorage.getItem("lastPercentage")) || percent;

  const dashboardDiv = document.getElementById("resultDashboard");
  if (!dashboardDiv) return;
  
  // Determine performance level
  let performanceLevel = "Needs Practice";
  let performanceColor = "var(--danger)";
  let performanceIcon = "📚";
  
  if (percentage >= 80) {
    performanceLevel = "Excellent";
    performanceColor = "var(--success)";
    performanceIcon = "🏆";
  } else if (percentage >= 60) {
    performanceLevel = "Good";
    performanceColor = "var(--primary)";
    performanceIcon = "📈";
  } else if (percentage >= 40) {
    performanceLevel = "Fair";
    performanceColor = "var(--warning)";
    performanceIcon = "📊";
  }

  dashboardDiv.innerHTML = `
    <div style="text-align: center; margin-bottom: 2rem;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">${performanceIcon}</div>
      <h2 style="color: ${performanceColor};">${performanceLevel}!</h2>
      <p style="color: var(--text-muted);">You scored ${percentage}% on this assessment</p>
    </div>
    <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px; margin: 2rem 0;">
      <div class="card" style="width: 150px; padding: 1.5rem; text-align: center;">
        <h2 style="font-size: 2rem; color: var(--primary);">${total}</h2>
        <p style="font-weight: 600;">Questions</p>
      </div>
      <div class="card" style="width: 150px; padding: 1.5rem; text-align: center;">
        <h2 style="font-size: 2rem; color: var(--success);">${correct}</h2>
        <p style="font-weight: 600;">Correct</p>
      </div>
      <div class="card" style="width: 150px; padding: 1.5rem; text-align: center;">
        <h2 style="font-size: 2rem; color: var(--danger);">${wrong}</h2>
        <p style="font-weight: 600;">Wrong</p>
      </div>
      <div class="card" style="width: 150px; padding: 1.5rem; text-align: center;">
        <h2 style="font-size: 2rem; color: var(--warning);">${percentage}%</h2>
        <p style="font-weight: 600;">Score</p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 2rem;">
      <button onclick="window.location.href='test-select.html'" class="btn-primary">Try Another Test</button>
      <button onclick="window.location.href='index.html'" class="btn-secondary" style="margin-left: 1rem;">Back to Home</button>
    </div>
  `;
}

/* =====================================================
   SCROLL TO TOP
===================================================== */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =====================================================
   COPY TO CLIPBOARD
===================================================== */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface-color);
    color: var(--text-main);
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: fadeInUp 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, duration);
}