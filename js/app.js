// ===== CUSTOM SELECT FOR UE SIMULATOR =====
let customSelectCleanupHandler = null;

function setupCustomSelect() {
  const customSelect = document.getElementById("custom-ue-select");
  if (!customSelect) return;
  const selected = customSelect.querySelector(".custom-select-selected");
  const options = customSelect.querySelector(".custom-select-options");
  const hiddenInput = customSelect.querySelector("input[type='hidden']");
  const optionDivs = customSelect.querySelectorAll(".custom-select-option");

  // Remove old listener if exists
  if (customSelectCleanupHandler) {
    document.removeEventListener("click", customSelectCleanupHandler);
  }

  // Open/close dropdown
  selected.addEventListener("click", function (e) {
    e.stopPropagation();
    customSelect.classList.toggle("open");
  });

  // Option click
  optionDivs.forEach((opt) => {
    opt.addEventListener("click", function (e) {
      e.stopPropagation();
      optionDivs.forEach((o) => o.classList.remove("selected"));
      this.classList.add("selected");
      selected.textContent = this.textContent;
      hiddenInput.value = this.dataset.value;
      customSelect.classList.remove("open");
      // Trigger change event for simulator
      const event = new Event("change");
      hiddenInput.dispatchEvent(event);
    });
  });

  // Close dropdown on outside click with cleanup
  customSelectCleanupHandler = function (e) {
    if (!customSelect.contains(e.target)) {
      customSelect.classList.remove("open");
    }
  };
  document.addEventListener("click", customSelectCleanupHandler);
}
// ===== CONFIGURATION =====
const blocsConfig = {
  graphes: { coeff: 6, ues: ["ga", "ps"], ueCoeffs: { ga: 1, ps: 1 } },
  maths: {
    coeff: 6,
    ues: ["proba", "signal"],
    ueCoeffs: { proba: 1, signal: 1 },
  },
  archi: {
    coeff: 9,
    ues: ["ase", "reseaux"],
    ueCoeffs: { ase: 2, reseaux: 1 },
  },
  bdd: { coeff: 6, ues: ["bd2", "gl"], ueCoeffs: { bd2: 1, gl: 1 } },
};

// Mapping of note_field to coefficient for each UE
const noteFieldCoeffs = {
  ga: { ecrit: 1, tp: 1 },
  ps: { pr1: 1, pr2: 1 },
  proba: { tp: 2, ecrit: 3, qcm: 1 },
  signal: { ecrit1: 1, ecrit2: 2 },
  ase: { qcm: 3, tp: 3, ecrit: 3 },
  reseaux: { tp: 1, ecrit: 1 },
  bd2: { projet: 1, ecrit: 1 },
  gl: { projet: 1, ecrit: 2 },
};

// ===== S6 CONFIGURATION =====
let currentSemester = "S5";
let s5Moyenne = 0; // stored whenever S5 is active, used for L3 calculation
let hasShownLicenceCelebration = false;

const s6Choices = {
  info_opt: "reseaux_loc",
  ouv_opt: "droit",
};

const noteFieldCoeffsS6 = {
  // UE Théorie des langages
  tdl: { ecrit1: 1, ecrit2: 1, ecrit3: 2 },
  // UE Projet intégrateur
  projet_s6: { projet: 1 },
  // UE Informatique — matières fixes
  ihm: { oral: 1, rendus: 1, realisation: 2 },
  ia: { ecrit: 3, projet: 2 },
  // UE Informatique — matière au choix
  reseaux_loc: { ecrit: 1, rendu: 1 },
  geo3d: { tp: 2, ecrit: 3 },
  mobile: { rendu: 2, ecrit: 3 },
  // UE Ouverture — matière fixe
  methodo: { ecrit: 3, quizz: 2 },
  // UE Ouverture — matière au choix
  droit: { assiduite: 2, ecrit1: 9, ecrit2: 9 },
  mediation: { rapport: 1, soutenance: 1 },
  // Langue — non comptabilisée dans la moyenne générale (éval par niveau)
};

function getS6BlocsConfig() {
  const infoOpt = s6Choices.info_opt;
  const ouvOpt = s6Choices.ouv_opt;
  return {
    tdl: { coeff: 6, ues: ["tdl"], ueCoeffs: { tdl: 1 } },
    projet_s6: { coeff: 6, ues: ["projet_s6"], ueCoeffs: { projet_s6: 1 } },
    info_s6: {
      coeff: 9,
      ues: ["ihm", "ia", infoOpt],
      ueCoeffs: { ihm: 1, ia: 1, [infoOpt]: 1 },
    },
    ouverture_s6: {
      coeff: 6,
      ues: ["methodo", ouvOpt],
      ueCoeffs: { methodo: 1, [ouvOpt]: 1 },
    },
    // langue_s6 exclue du calcul (évaluation par niveau uniquement)
  };
}

function getActiveBlocsConfig() {
  return currentSemester === "S6" ? getS6BlocsConfig() : blocsConfig;
}

// ===== L3 TRACKER =====
function updateL3Tracker(s6Average) {
  const neededEl = document.getElementById("l3-needed");
  const statusEl = document.getElementById("l3-status");
  if (!neededEl || !statusEl) return;

  if (s5Moyenne === 0) {
    neededEl.textContent = "—";
    statusEl.textContent = "Importe tes notes S5 d'abord";
    statusEl.className = "l3-status pending";
    return;
  }

  const needed = 20 - s5Moyenne;
  const l3Average = (s5Moyenne + s6Average) / 2;

  neededEl.textContent = needed <= 0 ? "0.00 ✓" : needed.toFixed(2);

  if (l3Average >= 10) {
    statusEl.textContent = `✓ Licence validée ! (moy. L3 : ${l3Average.toFixed(2)})`;
    statusEl.className = "l3-status achieved";
    checkLicenceCelebration(s6Average, l3Average);
  } else if (needed > 20) {
    statusEl.textContent = `Score S5 insuffisant (moy. L3 actuelle : ${l3Average.toFixed(2)})`;
    statusEl.className = "l3-status impossible";
  } else {
    statusEl.textContent = `Moy. L3 actuelle : ${l3Average.toFixed(2)}/20`;
    statusEl.className = "l3-status pending";
  }
}

function checkLicenceCelebration(s6Avg, l3Avg) {
  if (hasShownLicenceCelebration) return;
  // Only trigger if student has actually entered some S6 notes
  const hasS6Notes = Array.from(
    document.querySelectorAll("#s6-content .note-input")
  ).some((i) => i.value !== "");
  if (!hasS6Notes) return;

  hasShownLicenceCelebration = true;
  setTimeout(() => {
    const overlay = document.getElementById("licence-celebration");
    if (overlay && !overlay.classList.contains("show")) {
      document.getElementById("lic-s5-val").textContent = s5Moyenne.toFixed(2) + "/20";
      document.getElementById("lic-s6-val").textContent = s6Avg.toFixed(2) + "/20";
      document.getElementById("lic-l3-val").textContent = l3Avg.toFixed(2) + "/20";
      overlay.classList.add("show");
      createConfetti();
    }
  }, 400);
}

window.closeLicenceCelebration = function () {
  const overlay = document.getElementById("licence-celebration");
  if (overlay) overlay.classList.remove("show");
};

// ===== SEMESTER SWITCH =====
window.switchSemester = function (sem) {
  currentSemester = sem;

  document.getElementById("tab-s5").classList.toggle("active", sem === "S5");
  document.getElementById("tab-s6").classList.toggle("active", sem === "S6");

  const s5Content = document.getElementById("s5-content");
  const s6Content = document.getElementById("s6-content");
  if (s5Content) s5Content.style.display = sem === "S5" ? "" : "none";
  if (s6Content) s6Content.style.display = sem === "S6" ? "" : "none";

  const badge = document.getElementById("semester-badge");
  if (badge) badge.textContent = sem === "S5" ? "L3 Informatique • S5A" : "L3 Informatique • S6A";

  updateSimulatorUEOptions();
  updateAll();
};

// ===== S6 CHOICE SELECTION =====
window.selectS6Choice = function (group, choice, btn) {
  s6Choices[group] = choice;

  // Update tab highlight
  const choiceSection = btn.closest(".choice-section");
  choiceSection.querySelectorAll(".choice-tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");

  // Show/hide choice content panels
  choiceSection.querySelectorAll(".choice-content").forEach((c) => c.classList.remove("active"));
  const panel = choiceSection.querySelector(`.choice-content[data-choice="${choice}"]`);
  if (panel) panel.classList.add("active");

  updateSimulatorUEOptions();
  updateAll();
};

// ===== AUTO-DETECT S6 CHOICES FROM LOADED GRADES =====
function applyS6Choice(group, choice) {
  s6Choices[group] = choice;

  const s6Content = document.getElementById("s6-content");
  if (!s6Content) return;

  const targetPanel = s6Content.querySelector(`.choice-content[data-choice="${choice}"]`);
  if (!targetPanel) return;

  const choiceSection = targetPanel.closest(".choice-section");
  if (!choiceSection) return;

  choiceSection.querySelectorAll(".choice-tab").forEach((t) => {
    const onclick = t.getAttribute("onclick") || "";
    t.classList.toggle("active", onclick.includes(`'${choice}'`));
  });

  choiceSection.querySelectorAll(".choice-content").forEach((c) => c.classList.remove("active"));
  targetPanel.classList.add("active");
}

function autoDetectS6Choices() {
  const infoChoices = ["reseaux_loc", "geo3d", "mobile"];
  for (const choice of infoChoices) {
    const hasGrade = Array.from(
      document.querySelectorAll(`#s6-content .note-input[data-ue="${choice}"]`)
    ).some((i) => i.value !== "");
    if (hasGrade) { applyS6Choice("info_opt", choice); break; }
  }

  const ouvChoices = ["droit", "mediation"];
  for (const choice of ouvChoices) {
    const hasGrade = Array.from(
      document.querySelectorAll(`#s6-content .note-input[data-ue="${choice}"]`)
    ).some((i) => i.value !== "");
    if (hasGrade) { applyS6Choice("ouv_opt", choice); break; }
  }

  updateSimulatorUEOptions();
}

// ===== SIMULATOR UE OPTIONS =====
function updateSimulatorUEOptions() {
  const customSelect = document.getElementById("custom-ue-select");
  if (!customSelect) return;
  const optionsContainer = customSelect.querySelector(".custom-select-options");
  const selected = customSelect.querySelector(".custom-select-selected");
  const hiddenInput = customSelect.querySelector("input[type='hidden']");
  if (!optionsContainer || !selected || !hiddenInput) return;

  // Reset selection
  selected.textContent = "Choisis une UE...";
  hiddenInput.value = "";

  let optionsHTML = "";
  if (currentSemester === "S5") {
    optionsHTML = `
      <div class="custom-select-option" data-value="ga">Graphes et algorithmes</div>
      <div class="custom-select-option" data-value="ps">Problem solving</div>
      <div class="custom-select-option" data-value="proba">Probabilités et Statistiques</div>
      <div class="custom-select-option" data-value="signal">Traitement du signal</div>
      <div class="custom-select-option" data-value="ase">Architecture des Systèmes d'Exploitation</div>
      <div class="custom-select-option" data-value="reseaux">Algorithmes réseaux</div>
      <div class="custom-select-option" data-value="bd2">Bases de données 2</div>
      <div class="custom-select-option" data-value="gl">Génie logiciel</div>
    `;
  } else {
    const infoOptLabel =
      s6Choices.info_opt === "reseaux_loc" ? "Réseaux locaux" :
      s6Choices.info_opt === "geo3d" ? "Géométrie pour la 3D" : "Programmation mobile";
    const ouvOptLabel = s6Choices.ouv_opt === "droit" ? "Droit" : "Médiation scientifique";
    optionsHTML = `
      <div class="custom-select-option" data-value="tdl">Théorie des langages</div>
      <div class="custom-select-option" data-value="projet_s6">Projet intégrateur</div>
      <div class="custom-select-option" data-value="ihm">Interaction hommes-machines</div>
      <div class="custom-select-option" data-value="ia">Intelligence artificielle</div>
      <div class="custom-select-option" data-value="${s6Choices.info_opt}">${infoOptLabel}</div>
      <div class="custom-select-option" data-value="methodo">Méthodologie scientifique</div>
      <div class="custom-select-option" data-value="${s6Choices.ouv_opt}">${ouvOptLabel}</div>
    `;
  }
  optionsContainer.innerHTML = optionsHTML;
  setupCustomSelect();
}

// Celebration constants
const CONFETTI_COUNT = 50;
const CONFETTI_ANIMATION_DELAY_MAX = 2; // seconds
const CONFETTI_ANIMATION_DURATION_MIN = 2; // seconds
const CONFETTI_ANIMATION_DURATION_MAX = 4; // seconds
const CONFETTI_LIFETIME = 5000; // milliseconds

// ===== LOCAL STORAGE =====
function saveNotes() {
  const notes = {};
  document.querySelectorAll(".note-input").forEach((input) => {
    notes[`${input.dataset.ue}-${input.dataset.note}`] = input.value;
  });
  localStorage.setItem("manote-notes", JSON.stringify(notes));
  showToast("Notes sauvegardées !");
}

function loadNotes() {
  const saved = localStorage.getItem("manote-notes");
  if (saved) {
    try {
      const notes = JSON.parse(saved);
      document.querySelectorAll(".note-input").forEach((input) => {
        const key = `${input.dataset.ue}-${input.dataset.note}`;
        if (notes[key]) input.value = notes[key];
      });
    } catch (error) {
      console.error("Error loading notes:", error);
      localStorage.removeItem("manote-notes");
    }
  }
}

function autoSave() {
  const notes = {};
  document.querySelectorAll(".note-input").forEach((input) => {
    notes[`${input.dataset.ue}-${input.dataset.note}`] = input.value;
  });
  try {
    localStorage.setItem("manote-notes", JSON.stringify(notes));
  } catch (e) {
    console.error("LocalStorage error during auto-save:", e);
    // Don't show toast on auto-save failure to avoid annoying users
  }
}

function clearAllNotes() {
  const clearModal = document.getElementById("clear-modal");
  if (clearModal && !clearModal.classList.contains("show")) {
    clearModal.classList.add("show");
  }
}

// Make functions globally accessible for onclick handlers
window.closeClearModal = function () {
  const clearModal = document.getElementById("clear-modal");
  if (clearModal) {
    clearModal.classList.remove("show");
  }
};

window.confirmClearNotes = function () {
  document.querySelectorAll(".note-input").forEach((input) => {
    input.value = "";
  });
  localStorage.removeItem("manote-notes");
  localStorage.removeItem("manote-celebration-shown");
  localStorage.removeItem("manote-student-number");
  localStorage.removeItem("manote-welcome-skipped");
  hasShownCelebration = false;
  hasShownLicenceCelebration = false;
  s5Moyenne = 0;
  updateAll();
  updateSubtitle("");
  window.closeClearModal();
  showToast("Toutes les notes ont été effacées");
};

// ===== RANKING MODAL =====
window.closeRankingModal = function () {
  const rankingModal = document.getElementById("ranking-modal");
  if (rankingModal) {
    rankingModal.classList.remove("show");
  }
};

window.openRankingModal = function () {
  const rankingModal = document.getElementById("ranking-modal");
  if (rankingModal) {
    rankingModal.classList.add("show");
  }
  loadAndDisplayRanking();
};

// Load student grades from ranking click
window.loadStudentFromRanking = async function (studentNumber) {
  // Close the ranking modal
  closeRankingModal();

  // Show loading modal
  const loadingModal = document.getElementById("loading-modal");
  if (loadingModal && !loadingModal.classList.contains("show")) {
    loadingModal.classList.add("show");
  }

  try {
    updateLoadingText("Chargement des notes...");
    updateProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    updateProgress(30);

    if (!window.supabaseClient) {
      throw new Error("Supabase non configuré");
    }

    // Fetch grades from Supabase
    updateProgress(50);
    const { data, error } = await window.supabaseClient
      .from(window.GRADES_TABLE)
      .select("*")
      .eq("student_number", studentNumber);

    if (error) {
      throw new Error("Erreur lors de la récupération des données");
    }

    updateProgress(70);
    updateLoadingText("Application des notes...");

    // Clear all previous notes
    document.querySelectorAll(".note-input").forEach((input) => {
      input.value = "";
    });
    localStorage.removeItem("manote-notes");

    let gradesFound = 0;

    // Process the grades
    if (data && data.length > 0) {
      data.forEach((record) => {
        const input = document.querySelector(
          `input[data-ue="${record.ue}"][data-note="${record.note_field}"]`,
        );
        if (input) {
          input.value = Number(record.grade).toFixed(3);
          gradesFound++;
        }
      });
    }

    updateProgress(90);

    // Save student number
    try {
      localStorage.setItem("manote-student-number", studentNumber);
    } catch (e) {
      console.error("LocalStorage error:", e);
    }

    // Update subtitle
    updateSubtitle(studentNumber);

    updateProgress(100);
    updateLoadingText("Terminé !");

    await new Promise((resolve) => setTimeout(resolve, 400));

    // Close loading modal
    if (loadingModal) {
      loadingModal.classList.remove("show");
    }

    // Auto-select S6 choices based on loaded grades
    autoDetectS6Choices();

    // Update all calculations
    updateAll();

    // Update ranking position card for the new student
    loadAndDisplayRanking();

    // Show result
    if (gradesFound > 0) {
      showToast(`✨ Notes de ${studentNumber} chargées (${gradesFound} notes)`);
    } else {
      showToast("ℹ️ Aucune note trouvée pour cet étudiant");
    }
  } catch (error) {
    console.error("Load error:", error);

    // Close loading modal
    const loadingModalClose = document.getElementById("loading-modal");
    if (loadingModalClose) {
      loadingModalClose.classList.remove("show");
    }

    showToast(`❌ ${error.message}`);
  }
};

// Detect S6 choices from a student's gradesByUE map
function detectStudentS6Choices(gradesByUE) {
  let info_opt = "reseaux_loc";
  for (const choice of ["reseaux_loc", "geo3d", "mobile"]) {
    if (gradesByUE[choice] && Object.keys(gradesByUE[choice]).length > 0) {
      info_opt = choice;
      break;
    }
  }
  let ouv_opt = "droit";
  for (const choice of ["droit", "mediation"]) {
    if (gradesByUE[choice] && Object.keys(gradesByUE[choice]).length > 0) {
      ouv_opt = choice;
      break;
    }
  }
  return { info_opt, ouv_opt };
}

// Calculate average for a specific student number (S5 or S6)
async function calculateStudentAverage(studentNumber, semester = "S5") {
  if (!window.supabaseClient) return null;

  try {
    const { data, error } = await window.supabaseClient
      .from(window.GRADES_TABLE)
      .select("*")
      .eq("student_number", studentNumber);

    if (error || !data || data.length === 0) return null;

    // Organize grades by UE and note_field
    const gradesByUE = {};
    data.forEach((record) => {
      if (!gradesByUE[record.ue]) gradesByUE[record.ue] = {};
      gradesByUE[record.ue][record.note_field] = parseFloat(record.grade) || 0;
    });

    // Pick the right config for the semester
    let activeNoteFieldCoeffs, activeConfig;
    if (semester === "S6") {
      activeNoteFieldCoeffs = noteFieldCoeffsS6;
      const { info_opt, ouv_opt } = detectStudentS6Choices(gradesByUE);
      activeConfig = {
        tdl: { coeff: 6, ues: ["tdl"], ueCoeffs: { tdl: 1 } },
        projet_s6: { coeff: 6, ues: ["projet_s6"], ueCoeffs: { projet_s6: 1 } },
        info_s6: {
          coeff: 9,
          ues: ["ihm", "ia", info_opt],
          ueCoeffs: { ihm: 1, ia: 1, [info_opt]: 1 },
        },
        ouverture_s6: {
          coeff: 6,
          ues: ["methodo", ouv_opt],
          ueCoeffs: { methodo: 1, [ouv_opt]: 1 },
        },
      };
    } else {
      activeNoteFieldCoeffs = noteFieldCoeffs;
      activeConfig = blocsConfig;
    }

    // Calculate UE averages
    const ueAverages = {};
    Object.keys(gradesByUE).forEach((ue) => {
      const notes = gradesByUE[ue];
      const coeffs = activeNoteFieldCoeffs[ue] || {};
      let points = 0, coeff = 0;
      Object.keys(coeffs).forEach((noteField) => {
        points += (notes[noteField] || 0) * (coeffs[noteField] || 1);
        coeff += coeffs[noteField] || 1;
      });
      ueAverages[ue] = coeff > 0 ? points / coeff : 0;
    });

    // If the student has no grades for this semester's UE codes, exclude them
    const semesterUEs = Object.values(activeConfig).flatMap((c) => c.ues);
    const hasAnySemesterGrade = semesterUEs.some((ue) => ueAverages[ue] !== undefined);
    if (!hasAnySemesterGrade) return null;

    // Calculate general average
    let totalPoints = 0, totalCoeff = 0;
    Object.keys(activeConfig).forEach((blocCode) => {
      const config = activeConfig[blocCode];
      let blocPoints = 0, blocCoeff = 0;
      config.ues.forEach((ue) => {
        blocPoints += (ueAverages[ue] || 0) * (config.ueCoeffs[ue] || 1);
        blocCoeff += config.ueCoeffs[ue] || 1;
      });
      const blocAvg = blocCoeff > 0 ? blocPoints / blocCoeff : 0;
      totalPoints += blocAvg * config.coeff;
      totalCoeff += config.coeff;
    });

    const generalAverage = totalCoeff > 0 ? totalPoints / totalCoeff : 0;
    return Math.max(0, Math.min(20, generalAverage));
  } catch (error) {
    console.error("Error calculating student average:", error);
    return null;
  }
}

// Load and display ranking
async function loadAndDisplayRanking() {
  const rankingList = document.getElementById("ranking-list");
  const rankingFooter = document.getElementById("ranking-footer");
  const currentStudentNumber = localStorage.getItem("manote-student-number");

  if (!window.supabaseClient) {
    rankingList.innerHTML =
      '<div class="ranking-error">❌ Supabase non configuré</div>';
    return;
  }

  rankingList.innerHTML =
    '<div class="ranking-loading">Chargement du classement...</div>';

  try {
    // Get all unique student numbers from grades
    const { data: allGrades, error } = await window.supabaseClient
      .from(window.GRADES_TABLE)
      .select("student_number");

    if (error || !allGrades) {
      rankingList.innerHTML =
        '<div class="ranking-error">❌ Erreur lors du chargement</div>';
      return;
    }

    // Get all students from students table
    const { data: allStudents, error: studentsError } =
      await window.supabaseClient
        .from("students")
        .select("student_number, first_name, last_name");

    if (studentsError || !allStudents) {
      rankingList.innerHTML =
        '<div class="ranking-error">❌ Erreur chargement étudiants</div>';
      return;
    }

    // Get unique student numbers from grades
    const studentsWithGrades = [
      ...new Set(allGrades.map((g) => g.student_number)),
    ];
    const allStudentNumbers = allStudents.map((s) => s.student_number);

    // Update ranking modal subtitle to reflect current semester
    const rankingSubtitle = document.querySelector(".ranking-subtitle");
    if (rankingSubtitle) {
      rankingSubtitle.textContent = currentSemester === "S6"
        ? "Classement Semestre 6"
        : "Classement Semestre 5";
    }

    // Calculate averages for all students with grades
    const studentAverages = [];
    const averagePromises = studentsWithGrades.map(async (studentNumber) => {
      const average = await calculateStudentAverage(studentNumber, currentSemester);
      let firstName = "Étudiant";
      let lastName = studentNumber;
      const studentData = allStudents.find(
        (s) => s.student_number === studentNumber,
      );
      if (studentData) {
        firstName = studentData.first_name;
        lastName = studentData.last_name;
      }
      if (average !== null) {
        return {
          studentNumber,
          firstName,
          lastName,
          average,
          isCurrent: studentNumber === currentStudentNumber,
          hasGrade: true,
        };
      }
      return null;
    });

    // Add students with no grades
    const studentsWithoutGrades = allStudents.filter(
      (s) => !studentsWithGrades.includes(s.student_number),
    );
    studentsWithoutGrades.forEach((s) => {
      studentAverages.push({
        studentNumber: s.student_number,
        firstName: s.first_name,
        lastName: s.last_name,
        average: 0,
        isCurrent: s.student_number === currentStudentNumber,
        hasGrade: false,
      });
    });

    const results = await Promise.all(averagePromises);
    results.forEach((student) => {
      if (student) {
        studentAverages.push(student);
      }
    });

    // Sort by average descending, then by name for those with no grades
    studentAverages.sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      if (a.hasGrade !== b.hasGrade) return a.hasGrade ? -1 : 1;
      return (a.lastName || "").localeCompare(b.lastName || "");
    });

    // Render ranking
    let rankingHTML = '<div class="ranking-list-wrapper">';

    studentAverages.forEach((student, index) => {
      const rank = index + 1;
      const medal =
        rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
      const highlight = student.isCurrent ? "current-student" : "";
      const averageClass =
        student.average >= 10 ? "validated" : "not-validated";
      let extraLabel = "";
      if (!student.hasGrade) {
        extraLabel = '<span class="ranking-badge no-grade">Aucune note</span>';
      } else if (student.isCurrent) {
        extraLabel = '<span class="ranking-badge">C\'est toi</span>';
      }
      rankingHTML += `
        <div class="ranking-item ${highlight} clickable" onclick="loadStudentFromRanking('${student.studentNumber}')" title="Cliquer pour voir les notes">
          <div class="ranking-position">
            <span class="ranking-medal">${medal}</span>
            <span class="ranking-rank">#${rank}</span>
          </div>
          <div class="ranking-student">
            <div class="ranking-name">${student.firstName} ${student.lastName}</div>
            <div class="ranking-number">${student.studentNumber}</div>
            ${extraLabel}
          </div>
          <div class="ranking-average ${averageClass}">
            ${student.average.toFixed(2)}/20
          </div>
        </div>
      `;
    });

    rankingHTML += "</div>";
    rankingList.innerHTML = rankingHTML;
    setupRankingSearch(studentAverages);

    // Update footer with stats
    const currentRank = studentAverages.findIndex((s) => s.isCurrent) + 1;
    const classTotal = studentAverages.length;

    // Update the ranking card in scenarios section
    const rankingPositionEl = document.getElementById("ranking-position");
    const rankingDetailEl = document.getElementById("ranking-detail");

    if (currentStudentNumber && rankingPositionEl && rankingDetailEl) {
      if (currentRank > 0 && currentRank <= classTotal) {
        const percentAbove = Math.round(
          ((classTotal - currentRank + 1) / classTotal) * 100,
        );
        rankingPositionEl.textContent = `#${currentRank}`;
        rankingDetailEl.textContent = `dans le top ${percentAbove}% de la promo`;
      } else {
        rankingPositionEl.textContent = "--";
        rankingDetailEl.textContent = "Non trouvé";
      }
    }

    if (currentStudentNumber) {
      rankingFooter.innerHTML = `
        <div class="ranking-stats">
          <span>Tu es au <strong>#${currentRank}</strong> sur <strong>${classTotal}</strong></span>
          <span>•</span>
          <span>top ${Math.round(
            ((classTotal - currentRank + 1) / classTotal) * 100,
          )}% de la promo</span>
        </div>
      `;
    } else {
      rankingFooter.innerHTML = `<div class="ranking-stats"><span>Total: <strong>${classTotal}</strong> étudiants</span></div>`;
    }
  } catch (error) {
    console.error("Error loading ranking:", error);
    rankingList.innerHTML =
      '<div class="ranking-error">❌ Erreur lors du chargement</div>';
  }
}

// ===== RANKING SEARCH/FILTER =====
function setupRankingSearch(studentAverages) {
  const searchInput = document.getElementById("ranking-search");
  const rankingList = document.getElementById("ranking-list");
  if (!searchInput || !rankingList) return;

  searchInput.addEventListener("input", function () {
    const query = searchInput.value.trim().toLowerCase();
    let filtered = studentAverages;
    if (query.length > 0) {
      filtered = studentAverages.filter((student) => {
        return (
          (student.firstName &&
            student.firstName.toLowerCase().includes(query)) ||
          (student.lastName &&
            student.lastName.toLowerCase().includes(query)) ||
          (student.studentNumber &&
            student.studentNumber.toString().includes(query))
        );
      });
    }
    // Render filtered ranking
    let rankingHTML = '<div class="ranking-list-wrapper">';
    filtered.forEach((student, index) => {
      const rank = studentAverages.indexOf(student) + 1;
      const medal =
        rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
      const highlight = student.isCurrent ? "current-student" : "";
      const averageClass =
        student.average >= 10 ? "validated" : "not-validated";
      rankingHTML += `
        <div class="ranking-item ${highlight} clickable" onclick="loadStudentFromRanking('${student.studentNumber}')" title="Cliquer pour voir les notes">
          <div class="ranking-position">
            <span class="ranking-medal">${medal}</span>
            <span class="ranking-rank">#${rank}</span>
          </div>
          <div class="ranking-student">
            <div class="ranking-name">${student.firstName} ${
              student.lastName
            }</div>
            <div class="ranking-number">${student.studentNumber}</div>
            ${
              student.isCurrent
                ? '<span class="ranking-badge">C\'est toi</span>'
                : ""
            }
          </div>
          <div class="ranking-average ${averageClass}">
            ${student.average.toFixed(2)}/20
          </div>
        </div>
      `;
    });
    rankingHTML += "</div>";
    rankingList.innerHTML = rankingHTML;
  });
}

// ===== TOAST NOTIFICATION =====
function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");
  if (!toast || !toastMessage) {
    console.error("Toast elements not found");
    return;
  }
  toastMessage.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ===== TOGGLE UE =====
// Make function globally accessible for onclick handlers
window.toggleUE = function (header) {
  header.closest(".ue-item").classList.toggle("expanded");
};

// ===== MOBILE STATS TOGGLE =====
window.toggleMobileStats = function () {
  const toggle = document.getElementById("mobile-stats-toggle");
  const container = document.getElementById("mobile-stats-container");

  if (toggle && container) {
    toggle.classList.toggle("open");
    container.classList.toggle("open");
  }
};

// Update mobile average display
function updateMobileAvgDisplay(average) {
  const mobileAvgDisplay = document.getElementById("mobile-avg-display");
  if (mobileAvgDisplay) {
    mobileAvgDisplay.textContent = average.toFixed(2);
  }
}

// ===== CALCULATIONS =====
function getUEInputs(ueCode) {
  return document.querySelectorAll(`input[data-ue="${ueCode}"]`);
}

function calcUE(ueCode) {
  let points = 0;
  let coeff = 0;
  getUEInputs(ueCode).forEach((input) => {
    const value = parseFloat(input.value) || 0;
    const inputCoeff = parseFloat(input.dataset.coeff) || 1;
    points += value * inputCoeff;
    coeff += inputCoeff;
  });
  return coeff > 0 ? points / coeff : 0;
}

function calcBloc(blocCode) {
  const config = getActiveBlocsConfig()[blocCode];
  let points = 0;
  let coeff = 0;
  config.ues.forEach((ueCode) => {
    points += calcUE(ueCode) * config.ueCoeffs[ueCode];
    coeff += config.ueCoeffs[ueCode];
  });
  return coeff > 0 ? points / coeff : 0;
}

function calcGeneral() {
  const config = getActiveBlocsConfig();
  let points = 0;
  let coeff = 0;
  Object.keys(config).forEach((blocCode) => {
    points += calcBloc(blocCode) * config[blocCode].coeff;
    coeff += config[blocCode].coeff;
  });
  return coeff > 0 ? points / coeff : 0;
}

// ===== SCENARIOS =====
function calcScenario(defaultValue) {
  const activeConfig = getActiveBlocsConfig();
  let points = 0;
  let coeff = 0;

  Object.keys(activeConfig).forEach((blocCode) => {
    const config = activeConfig[blocCode];
    let blocPoints = 0;
    let blocCoeff = 0;

    config.ues.forEach((ueCode) => {
      let uePoints = 0;
      let ueCoeff = 0;

      getUEInputs(ueCode).forEach((input) => {
        const value =
          input.value === "" ? defaultValue : parseFloat(input.value) || 0;
        const inputCoeff = parseFloat(input.dataset.coeff) || 1;
        uePoints += value * inputCoeff;
        ueCoeff += inputCoeff;
      });

      blocPoints +=
        (ueCoeff > 0 ? uePoints / ueCoeff : 0) * config.ueCoeffs[ueCode];
      blocCoeff += config.ueCoeffs[ueCode];
    });

    points += (blocCoeff > 0 ? blocPoints / blocCoeff : 0) * config.coeff;
    coeff += config.coeff;
  });

  return coeff > 0 ? points / coeff : 0;
}

function updateScenarios() {
  const bestScenario = document.getElementById("best-scenario");
  const currentScenario = document.getElementById("current-scenario");
  const bestDetail = document.getElementById("best-detail");

  if (!bestScenario || !currentScenario || !bestDetail) {
    return;
  }

  bestScenario.textContent = calcScenario(20).toFixed(2);
  currentScenario.textContent = calcGeneral().toFixed(2);

  // Count only inputs belonging to the active semester/config
  const activeConfig = getActiveBlocsConfig();
  let emptyCount = 0;
  Object.keys(activeConfig).forEach((blocCode) => {
    activeConfig[blocCode].ues.forEach((ueCode) => {
      getUEInputs(ueCode).forEach((input) => {
        if (input.value === "") emptyCount++;
      });
    });
  });

  bestDetail.textContent = emptyCount
    ? `20/20 sur ${emptyCount} notes`
    : "Complet";
}

// ===== SIMULATOR =====
function updateSimulator() {
  // General simulator (simple: 10 - current average)
  const el = document.getElementById("sim-general-result");
  const det = document.getElementById("sim-general-detail");

  if (!el || !det) {
    return;
  }

  const currentAvg = calcGeneral();
  const generalNeeded = 10 - currentAvg;

  // If already validated (average >= 10), show success message instead of negative number
  if (currentAvg >= 10) {
    el.textContent = "✓ Validé";
    el.className = "sim-result success";
    det.textContent = `Moyenne générale: ${currentAvg.toFixed(2)}/20`;
  } else {
    el.textContent = generalNeeded.toFixed(2);
    el.className = "sim-result";
    det.textContent = `Note moyenne nécessaire pour valider (10/20)`;
  }

  // UE simulator (calculate required note for 10/20 based on entered notes and coefficients)
  const simUESelect = document.getElementById("sim-ue-select");
  const ueEl = document.getElementById("sim-ue-result");
  const ueDet = document.getElementById("sim-ue-detail");

  if (!simUESelect || !ueEl || !ueDet) {
    return;
  }

  const selectedUE = simUESelect.value;

  if (!selectedUE) {
    ueEl.textContent = "--";
    ueEl.className = "sim-result";
    ueDet.textContent = "Sélectionne une UE";
    return;
  }

  // Get all inputs for the selected UE
  const inputs = getUEInputs(selectedUE);
  let sum = 0;
  let totalCoeff = 0;
  let emptyCoeff = 0;
  inputs.forEach((input) => {
    const val = parseFloat(input.value);
    const coeff = parseFloat(input.dataset.coeff) || 1;
    if (!isNaN(val)) {
      sum += val * coeff;
    } else {
      emptyCoeff += coeff;
    }
    totalCoeff += coeff;
  });

  if (emptyCoeff === 0) {
    // All notes filled
    const avg = totalCoeff > 0 ? sum / totalCoeff : 0;
    ueEl.textContent = avg >= 10 ? "✓ Validé" : "✗ Non validé";
    ueEl.className = "sim-result " + (avg >= 10 ? "success" : "danger");
    ueDet.textContent = `Moyenne: ${avg.toFixed(2)}/20`;
    return;
  }

  // Calculate required note for empty fields to reach 10/20
  // Prevent division by zero
  if (emptyCoeff === 0) {
    ueEl.textContent = "Erreur";
    ueEl.className = "sim-result danger";
    ueDet.textContent = "Aucune note vide";
    return;
  }

  const ueNeeded = (10 * totalCoeff - sum) / emptyCoeff;
  if (ueNeeded > 20) {
    ueEl.textContent = "Impossible";
    ueEl.className = "sim-result danger";
    ueDet.textContent = `Il faudrait ${ueNeeded.toFixed(2)}/20 (impossible)`;
  } else if (ueNeeded <= 0) {
    ueEl.textContent = "✓ OK";
    ueEl.className = "sim-result success";
    ueDet.textContent = "Déjà validé !";
  } else {
    ueEl.textContent = ueNeeded.toFixed(2);
    ueEl.className = "sim-result " + (ueNeeded > 15 ? "warning" : "");
    ueDet.textContent = `Note nécessaire sur les ${emptyCoeff} coeff restants`;
  }
}

// ===== CELEBRATION =====
let hasShownCelebration =
  localStorage.getItem("manote-celebration-shown") === "true";
let wasValidated = false;

function showCelebration(average) {
  const overlay = document.getElementById("celebration");
  const celebrationAverage = document.getElementById("celebration-average");

  if (!overlay || !celebrationAverage) {
    return;
  }

  // Prevent showing multiple times
  if (overlay.classList.contains("show")) {
    return;
  }

  celebrationAverage.textContent = `${average.toFixed(2)}/20`;
  overlay.classList.add("show");
  createConfetti();
  hasShownCelebration = true;
  localStorage.setItem("manote-celebration-shown", "true");
}

// Make function globally accessible for onclick handlers
window.closeCelebration = function () {
  const celebration = document.getElementById("celebration");
  if (celebration) {
    celebration.classList.remove("show");
  }
};

function createConfetti() {
  const colors = [
    "#00f5d4",
    "#f72585",
    "#7209b7",
    "#4361ee",
    "#ff9f1c",
    "#06d6a0",
  ];
  const overlay = document.getElementById("celebration");

  if (!overlay) {
    return;
  }

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.top = "-10px";
    confetti.style.backgroundColor =
      colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    confetti.style.animationDelay =
      Math.random() * CONFETTI_ANIMATION_DELAY_MAX + "s";
    confetti.style.animationDuration =
      Math.random() *
        (CONFETTI_ANIMATION_DURATION_MAX - CONFETTI_ANIMATION_DURATION_MIN) +
      CONFETTI_ANIMATION_DURATION_MIN +
      "s";
    overlay.appendChild(confetti);

    setTimeout(() => confetti.classList.add("animate"), 10);
    setTimeout(() => confetti.remove(), CONFETTI_LIFETIME);
  }
}

function checkCelebration(average) {
  const isValidated = average >= 10;

  // Show celebration only when transitioning from not validated to validated
  if (isValidated && !wasValidated && !hasShownCelebration) {
    // Check if at least one note is filled
    let hasNotes = false;
    document.querySelectorAll(".note-input").forEach((input) => {
      if (input.value !== "") hasNotes = true;
    });

    if (hasNotes) {
      setTimeout(() => showCelebration(average), 300);
    }
  }

  // Reset celebration flag if goes below 10
  if (!isValidated) {
    hasShownCelebration = false;
    localStorage.removeItem("manote-celebration-shown");
  }

  // Always update wasValidated to track current state
  wasValidated = isValidated;
}

// ===== UPDATE ALL =====
function updateAll() {
  const activeConfig = getActiveBlocsConfig();
  let ueValidated = 0;
  let blocsValidated = 0;
  let totalUECount = 0;
  let totalBlocCount = Object.keys(activeConfig).length;
  let totalCoeff = 0;

  // Update UE and blocs
  Object.keys(activeConfig).forEach((blocCode) => {
    const bloc = activeConfig[blocCode];
    totalUECount += bloc.ues.length;
    totalCoeff += bloc.coeff;

    bloc.ues.forEach((ueCode) => {
      const avg = calcUE(ueCode);
      const moyenneEl = document.getElementById(`moyenne-${ueCode}`);
      const badge = document.getElementById(`validation-${ueCode}`);

      if (moyenneEl) {
        moyenneEl.textContent = avg.toFixed(2);
      }

      if (badge) {
        if (avg >= 10) {
          badge.textContent = "Validée ✓";
          badge.className = "validation-badge validated";
          ueValidated++;
        } else {
          badge.textContent = "Non validée";
          badge.className = "validation-badge not-validated";
        }
      }
    });

    // Update bloc
    const blocAvg = calcBloc(blocCode);
    const blocMoyenneEl = document.getElementById(`moyenne-${blocCode}`);
    const blocProgressEl = document.getElementById(`progress-${blocCode}`);

    if (blocMoyenneEl) {
      blocMoyenneEl.textContent = blocAvg.toFixed(2);
    }

    if (blocProgressEl) {
      const progressPercentage = Math.max(
        0,
        Math.min(100, (blocAvg / 20) * 100),
      );
      blocProgressEl.style.width = `${progressPercentage}%`;
    }

    if (blocAvg >= 10) blocsValidated++;
  });

  // Update stats
  const generalAverage = calcGeneral();
  const moyenneGeneraleEl = document.getElementById("moyenne-generale");
  const blocsValidesEl = document.getElementById("blocs-valides");
  const ueValideesEl = document.getElementById("ue-validees");
  const totalCoeffEl = document.getElementById("total-coeff");

  if (moyenneGeneraleEl) {
    moyenneGeneraleEl.textContent = generalAverage.toFixed(2);
  }

  // Update mobile average display
  updateMobileAvgDisplay(generalAverage);

  if (blocsValidesEl) {
    blocsValidesEl.textContent = `${blocsValidated}/${totalBlocCount}`;
  }

  if (ueValideesEl) {
    ueValideesEl.textContent = `${ueValidated}/${totalUECount}`;
  }

  if (totalCoeffEl) {
    totalCoeffEl.textContent = totalCoeff;
  }

  // S5 results display (read-only) + store S5 moyenne for L3 tracker
  if (currentSemester === "S5") {
    s5Moyenne = generalAverage;
    ["graphes", "maths", "archi", "bdd"].forEach((bloc) => {
      const avg = calcBloc(bloc);
      const moyEl = document.getElementById(`s5-moy-${bloc}`);
      const validEl = document.getElementById(`s5-valid-${bloc}`);
      if (moyEl) moyEl.textContent = avg.toFixed(2);
      if (validEl) {
        validEl.textContent = avg >= 10 ? "Validé ✓" : "Non validé";
        validEl.className = `validation-badge ${avg >= 10 ? "validated" : "not-validated"}`;
      }
    });
    const s5Final = document.getElementById("s5-moy-generale");
    if (s5Final) s5Final.textContent = generalAverage.toFixed(2);
  }

  // S6: update L3 tracker
  if (currentSemester === "S6") {
    updateL3Tracker(generalAverage);
  }

  // Check for celebration
  checkCelebration(generalAverage);

  // Update scenarios and simulator
  updateScenarios();
  updateSimulator();

  // Auto save
  autoSave();
}

// ===== STUDENT NUMBER & IMPORT =====
// Make function globally accessible for onclick handler
window.skipWelcome = function () {
  const welcomeModal = document.getElementById("welcome-modal");
  if (welcomeModal) {
    welcomeModal.classList.remove("show");
  }
  // PRIVACY FIX: Clear all localStorage when user skips (shared device)
  localStorage.removeItem("manote-notes");
  localStorage.removeItem("manote-student-number");
  localStorage.removeItem("manote-celebration-shown");
  localStorage.removeItem("manote-welcome-skipped");
};

function changeStudent() {
  // Get current student BEFORE clearing (for modal text)
  const currentStudent = localStorage.getItem("manote-student-number");

  // Clear all current notes first
  document.querySelectorAll(".note-input").forEach((input) => {
    input.value = "";
  });

  // PRIVACY FIX: Clear all sensitive localStorage data
  localStorage.removeItem("manote-notes");
  localStorage.removeItem("manote-student-number");
  localStorage.removeItem("manote-celebration-shown");
  localStorage.removeItem("manote-welcome-skipped");

  // Update calculations to show empty state
  updateAll();

  // Clear the current student number input
  const studentNumberInput = document.getElementById("student-number-input");
  if (studentNumberInput) {
    studentNumberInput.value = "";
  }

  // Update welcome modal text for switching context
  const welcomeTitle = document.querySelector(".welcome-title");
  const welcomeMessage = document.querySelector(".welcome-message");
  const welcomeInstruction = document.querySelector(".welcome-instruction");

  if (welcomeTitle && welcomeMessage && welcomeInstruction) {
    if (currentStudent) {
      welcomeTitle.textContent = "Changer d'étudiant";
      welcomeMessage.innerHTML =
        "Tu veux voir les notes de <span class=\"highlight\">quelqu'un d'autre</span> ?";
      welcomeInstruction.innerHTML =
        "Entre un nouveau <strong>numéro d'étudiant</strong> pour importer ses notes.";
    } else {
      welcomeTitle.textContent = "Bonjour !";
      welcomeMessage.innerHTML =
        'Bienvenue sur <span class="highlight">MaNote</span>, ton calculateur de moyenne personnalisé.';
      welcomeInstruction.innerHTML =
        "Pour commencer, entre ton <strong>numéro d'étudiant</strong> afin d'importer automatiquement tes notes disponibles.";
    }
  }

  // Show the welcome modal again
  const welcomeModal = document.getElementById("welcome-modal");
  if (welcomeModal && !welcomeModal.classList.contains("show")) {
    welcomeModal.classList.add("show");
  }
}

// Make function globally accessible for onclick handler
window.importGradesFromSupabase = async function () {
  const studentNumberInput = document.getElementById("student-number-input");

  if (!studentNumberInput) {
    showToast("⚠️ Erreur: Champ numéro d'étudiant introuvable");
    return;
  }

  const studentNumber = studentNumberInput.value.trim();

  if (!studentNumber) {
    showToast("⚠️ Entre un numéro d'étudiant valide");
    return;
  }

  if (studentNumber.length !== 8) {
    showToast("⚠️ Le numéro doit contenir 8 chiffres");
    return;
  }

  // Validate that student number contains only digits
  if (!/^\d{8}$/.test(studentNumber)) {
    showToast("⚠️ Le numéro doit contenir uniquement des chiffres");
    return;
  }

  // Hide welcome modal and show loading modal
  const welcomeModal = document.getElementById("welcome-modal");
  const loadingModal = document.getElementById("loading-modal");

  if (welcomeModal) {
    welcomeModal.classList.remove("show");
  }

  if (loadingModal && !loadingModal.classList.contains("show")) {
    loadingModal.classList.add("show");
  }

  try {
    // Update loading text and progress
    updateLoadingText("Connexion en cours...");
    updateProgress(0);
    await new Promise((resolve) => setTimeout(resolve, 500));
    updateProgress(25);

    // Check if Supabase is configured
    if (!window.supabaseClient) {
      throw new Error(
        "Supabase n'est pas configuré. Ajoute tes credentials dans supabase-config.js",
      );
    }

    // Fetch grades from Supabase
    updateLoadingText("Récupération des données...");
    updateProgress(50);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const { data, error } = await window.supabaseClient
      .from(window.GRADES_TABLE)
      .select("*")
      .eq("student_number", studentNumber);

    if (error) {
      console.error("Supabase error:", error);
      throw new Error("Erreur lors de la récupération des données");
    }

    updateProgress(75);
    updateLoadingText("Importation de tes notes...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // IMPORTANT: Clear all previous notes before loading new student's data
    // This prevents notes from multiple students getting merged
    document.querySelectorAll(".note-input").forEach((input) => {
      input.value = "";
    });
    localStorage.removeItem("manote-notes");

    let gradesFound = 0;

    // Process the grades
    if (data && data.length > 0) {
      data.forEach((record) => {
        const input = document.querySelector(
          `input[data-ue="${record.ue}"][data-note="${record.note_field}"]`,
        );

        if (input) {
          input.value = record.grade;
          gradesFound++;
        }
      });
    }

    updateProgress(95);

    // Save student number with error handling
    try {
      localStorage.setItem("manote-student-number", studentNumber);
    } catch (e) {
      console.error("LocalStorage error:", e);
      showToast("⚠️ Impossible de sauvegarder (quota dépassé?)");
    }

    // Update subtitle to show current student
    updateSubtitle(studentNumber);

    updateProgress(100);
    updateLoadingText("Terminé");

    // Wait a bit for better UX
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Close loading modal
    const loadingModalClose = document.getElementById("loading-modal");
    if (loadingModalClose) {
      loadingModalClose.classList.remove("show");
    }

    // Auto-select S6 choices based on loaded grades
    autoDetectS6Choices();

    // Update all calculations
    updateAll();

    // Show result
    if (gradesFound > 0) {
      showToast(`✨ ${gradesFound} note(s) importée(s) avec succès !`);
    } else {
      showToast("ℹ️ Aucun étudiant trouvé avec ce numéro");
      updateSubtitle("");
    }

    // Load ranking to update the card
    loadAndDisplayRanking();
  } catch (error) {
    console.error("Import error:", error);

    // Close loading modal
    const loadingModalError = document.getElementById("loading-modal");
    if (loadingModalError) {
      loadingModalError.classList.remove("show");
    }

    // Show error toast
    showToast(`❌ ${error.message}`);

    // Show welcome modal again
    const welcomeModalError = document.getElementById("welcome-modal");
    if (welcomeModalError && !welcomeModalError.classList.contains("show")) {
      welcomeModalError.classList.add("show");
    }
  }
};

function updateSubtitle(studentNumber) {
  const subtitleEl = document.getElementById("subtitle");
  if (subtitleEl && studentNumber) {
    subtitleEl.textContent = `Notes de l'étudiant ${studentNumber} • Sauvegardées automatiquement`;
  } else {
    subtitleEl.textContent = "Tes notes sont sauvegardées automatiquement";
  }
}

function updateLoadingText(text) {
  const loadingTextEl = document.getElementById("loading-text");
  if (loadingTextEl) {
    loadingTextEl.textContent = text;
  }
}

function updateProgress(percentage) {
  const progressFill = document.getElementById("progress-fill");
  const progressPercentage = document.getElementById("progress-percentage");
  if (progressFill && progressPercentage) {
    // Clamp percentage between 0 and 100
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    progressFill.style.width = clampedPercentage + "%";
    progressPercentage.textContent = Math.round(clampedPercentage) + "%";
  }
}

// Check if student should see the welcome modal
function checkWelcomeModal() {
  // Always show the welcome modal on page load
  setTimeout(() => {
    const welcomeModal = document.getElementById("welcome-modal");
    if (welcomeModal && !welcomeModal.classList.contains("show")) {
      welcomeModal.classList.add("show");
    }
  }, 300);
}

// Allow Enter key to submit and validate student number input
function setupStudentInputEnter() {
  const input = document.getElementById("student-number-input");
  if (input) {
    // Allow only numbers in student number
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        importGradesFromSupabase();
        return;
      }
      // Allow only digits
      if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });

    // Also handle paste events
    input.addEventListener("input", function () {
      this.value = this.value.replace(/[^0-9]/g, "");
    });
  }
}

// ===== DEBOUNCE HELPER =====
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ===== EVENT LISTENERS =====
document.addEventListener("DOMContentLoaded", () => {
  // Create debounced version of updateAll for input events
  const debouncedUpdateAll = debounce(updateAll, 150);

  // Note inputs
  document.querySelectorAll(".note-input").forEach((input) => {
    // Prevent non-numeric input
    input.addEventListener("keypress", function (e) {
      // Allow only numbers and decimal point (both . and ,)
      const char = e.key;
      const currentValue = this.value;

      // Allow only digits and decimal separators (. or ,)
      if (!/[0-9.,]/.test(char)) {
        e.preventDefault();
        return;
      }

      // Prevent multiple decimal points (check for both . and ,)
      if (
        (char === "." || char === ",") &&
        (currentValue.includes(".") || currentValue.includes(","))
      ) {
        e.preventDefault();
        return;
      }

      // Predict what the new value would be after this keypress
      const selStart = this.selectionStart;
      const selEnd = this.selectionEnd;
      const newValue =
        currentValue.substring(0, selStart) +
        char +
        currentValue.substring(selEnd);
      // Normalize comma to dot for parsing
      const normalizedValue = newValue.replace(",", ".");
      const numValue = parseFloat(normalizedValue);

      // Block input if it would result in a value > 20
      if (!isNaN(numValue) && numValue > 20) {
        e.preventDefault();
        return;
      }
    });

    input.addEventListener("input", function () {
      // Replace comma with dot and remove any non-numeric characters (in case of paste)
      this.value = this.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");

      // Ensure only one decimal point
      const parts = this.value.split(".");
      if (parts.length > 2) {
        this.value = parts[0] + "." + parts.slice(1).join("");
      }

      // Validate min/max - block values > 20 instead of auto-correcting
      let value = parseFloat(this.value);
      if (value > 20) {
        // Remove the last character that caused the value to exceed 20
        this.value = this.value.slice(0, -1);
        value = parseFloat(this.value) || 0;
      }
      if (value < 0) this.value = 0;

      // Use debounced update for better performance
      debouncedUpdateAll();
    });

    // Also validate on blur (when user leaves the field)
    input.addEventListener("blur", function () {
      if (this.value !== "") {
        // Normalize comma to dot
        this.value = this.value.replace(/,/g, ".");

        // Check for invalid patterns (multiple dots, etc.)
        const dotCount = (this.value.match(/\./g) || []).length;
        if (dotCount > 1) {
          this.value = "";
          return;
        }

        let value = parseFloat(this.value);
        if (isNaN(value) || !isFinite(value)) {
          this.value = "";
        } else if (value > 20) {
          this.value = ""; // Clear invalid values instead of auto-correcting
        } else if (value < 0) {
          this.value = "0";
        } else {
          // Round to 2 decimal places for clean display
          this.value = Math.round(value * 100) / 100;
        }
      }
      updateAll();
    });
  });

  // UE selector
  const simUESelect = document.getElementById("sim-ue-select");
  if (simUESelect) {
    simUESelect.addEventListener("change", updateSimulator);
  }

  // Save button
  const saveBtn = document.getElementById("save-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveNotes);
  }

  // Change student button
  const changeStudentBtn = document.getElementById("change-student-btn");
  if (changeStudentBtn) {
    changeStudentBtn.addEventListener("click", changeStudent);
  }

  // Ranking button
  const rankingBtn = document.getElementById("ranking-btn");
  if (rankingBtn) {
    rankingBtn.addEventListener("click", openRankingModal);
  }

  // Clear button
  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllNotes);
  }

  // Initialize
  // DO NOT load notes from localStorage - this is a shared device, only load from database
  loadNotes();
  updateAll();
  setupStudentInputEnter();
  setupCustomSelect();
  checkWelcomeModal();

  // Update subtitle if student number exists
  const savedStudent = localStorage.getItem("manote-student-number");
  if (savedStudent) {
    updateSubtitle(savedStudent);
  }

  // ===== PRIVACY PROTECTION =====
  // Clear notes when page unloads (tab closed, browser closed, navigation away)
  // This prevents other users on the same device from seeing previous student's notes
  // beforeunload cleanup disabled: keep notes between sessions.
});
