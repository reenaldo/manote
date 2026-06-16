-- ============================================================
-- MIGRATION: Add coeff column and set correct coefficients
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Step 1: Add the coeff column (safe to run multiple times)
ALTER TABLE student_grades ADD COLUMN IF NOT EXISTS coeff NUMERIC DEFAULT 1;

-- Step 2: Set correct coefficients per UE + note_field

-- ── S5 ──────────────────────────────────────────────────────

-- Graphes et algorithmes
UPDATE student_grades SET coeff = 1 WHERE ue = 'ga' AND note_field IN ('ecrit', 'tp');

-- Problem Solving
UPDATE student_grades SET coeff = 1 WHERE ue = 'ps' AND note_field IN ('pr1', 'pr2');

-- Probabilités et Statistiques
UPDATE student_grades SET coeff = 2 WHERE ue = 'proba' AND note_field = 'tp';
UPDATE student_grades SET coeff = 3 WHERE ue = 'proba' AND note_field = 'ecrit';
UPDATE student_grades SET coeff = 1 WHERE ue = 'proba' AND note_field = 'qcm';

-- Traitement du signal
UPDATE student_grades SET coeff = 1 WHERE ue = 'signal' AND note_field = 'ecrit1';
UPDATE student_grades SET coeff = 2 WHERE ue = 'signal' AND note_field = 'ecrit2';

-- Architecture des Systèmes d'Exploitation
UPDATE student_grades SET coeff = 3 WHERE ue = 'ase' AND note_field IN ('qcm', 'tp', 'ecrit');

-- Algorithmes réseaux
UPDATE student_grades SET coeff = 1 WHERE ue = 'reseaux' AND note_field IN ('tp', 'ecrit');

-- Bases de données 2
UPDATE student_grades SET coeff = 1 WHERE ue = 'bd2' AND note_field = 'projet';
UPDATE student_grades SET coeff = 1 WHERE ue = 'bd2' AND note_field = 'ecrit';

-- Génie logiciel
UPDATE student_grades SET coeff = 1 WHERE ue = 'gl' AND note_field = 'projet';
UPDATE student_grades SET coeff = 2 WHERE ue = 'gl' AND note_field = 'ecrit';

-- ── S6 ──────────────────────────────────────────────────────

-- Théorie des langages
UPDATE student_grades SET coeff = 1 WHERE ue = 'tdl' AND note_field IN ('ecrit1', 'ecrit2');
UPDATE student_grades SET coeff = 2 WHERE ue = 'tdl' AND note_field = 'ecrit3';

-- Projet intégrateur
UPDATE student_grades SET coeff = 1 WHERE ue = 'projet_s6' AND note_field = 'projet';

-- Interaction hommes-machines
UPDATE student_grades SET coeff = 1 WHERE ue = 'ihm' AND note_field IN ('oral', 'rendus');
UPDATE student_grades SET coeff = 2 WHERE ue = 'ihm' AND note_field = 'realisation';

-- Intelligence artificielle
UPDATE student_grades SET coeff = 3 WHERE ue = 'ia' AND note_field = 'ecrit';
UPDATE student_grades SET coeff = 2 WHERE ue = 'ia' AND note_field = 'projet';

-- Réseaux locaux
UPDATE student_grades SET coeff = 1 WHERE ue = 'reseaux_loc' AND note_field IN ('ecrit', 'rendu');

-- Géométrie pour la 3D
UPDATE student_grades SET coeff = 2 WHERE ue = 'geo3d' AND note_field = 'tp';
UPDATE student_grades SET coeff = 3 WHERE ue = 'geo3d' AND note_field = 'ecrit';

-- Programmation mobile
UPDATE student_grades SET coeff = 2 WHERE ue = 'mobile' AND note_field = 'rendu';
UPDATE student_grades SET coeff = 3 WHERE ue = 'mobile' AND note_field = 'ecrit';

-- Méthodologie scientifique (new format)
UPDATE student_grades SET coeff = 3 WHERE ue = 'methodo' AND note_field = 'ecrit';
UPDATE student_grades SET coeff = 2 WHERE ue = 'methodo' AND note_field = 'quizz';
-- Méthodologie scientifique (old format — equal weight until re-uploaded)
UPDATE student_grades SET coeff = 1 WHERE ue = 'methodo' AND note_field IN ('quizz1', 'quizz2', 'quizz3');

-- Droit
UPDATE student_grades SET coeff = 2  WHERE ue = 'droit' AND note_field = 'assiduite';
UPDATE student_grades SET coeff = 9  WHERE ue = 'droit' AND note_field IN ('ecrit1', 'ecrit2');

-- Médiation scientifique
UPDATE student_grades SET coeff = 1 WHERE ue = 'mediation' AND note_field IN ('rapport', 'soutenance');
