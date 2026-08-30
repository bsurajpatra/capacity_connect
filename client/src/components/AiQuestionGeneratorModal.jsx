import React, { useState, useEffect } from 'react';
import {
  generateAiAssessmentQuestionsApi,
  regenerateAiAssessmentQuestionApi,
} from '../services/api';
import {
  Bot,
  Sparkles,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  Check,
  Layers,
  BookOpen,
  ArrowRight,
  HelpCircle,
  AlertCircle,
  Copy,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

const AiQuestionGeneratorModal = ({
  isOpen,
  onClose,
  courseId,
  moduleId = null,
  courseTitle = '',
  moduleTitle = '',
  modules = [],
  existingQuestions = [],
  onAddQuestions,
}) => {
  const [step, setStep] = useState('config'); // 'config' | 'generating' | 'review'
  const [selectedSource, setSelectedSource] = useState(moduleId ? 'module' : 'course'); // 'module' | 'course'
  const [selectedModuleId, setSelectedModuleId] = useState(moduleId || '');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard' | 'mixed'
  const [topic, setTopic] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);

  const [draftQuestions, setDraftQuestions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setSelectedSource(moduleId ? 'module' : 'course');
      setSelectedModuleId(moduleId || (modules[0]?._id || ''));
      setCount(5);
      setDifficulty('medium');
      setTopic('');
      setDraftQuestions([]);
      setSelectedIndices(new Set());
      setEditingIndex(null);
      setError(null);
    }
  }, [isOpen, moduleId, modules]);

  // Loading animation simulation for multi-step progress
  useEffect(() => {
    if (step === 'generating') {
      setLoadingStep(1);
      const t1 = setTimeout(() => setLoadingStep(2), 1200);
      const t2 = setTimeout(() => setLoadingStep(3), 2600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [step]);

  if (!isOpen) return null;

  // Duplicate detection helper
  const isDuplicateOfExisting = (questionText) => {
    if (!questionText || !existingQuestions || existingQuestions.length === 0) return false;
    const clean = questionText.toLowerCase().replace(/[^a-z0-9]/g, '');
    return existingQuestions.some((eq) => {
      const eqClean = (eq.questionText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean.length > 10 && (eqClean.includes(clean) || clean.includes(eqClean));
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setStep('generating');

    try {
      const activeModuleId = selectedSource === 'module' ? (selectedModuleId || moduleId) : null;
      const res = await generateAiAssessmentQuestionsApi({
        courseId,
        moduleId: activeModuleId,
        count: Math.max(1, Math.min(20, count)),
        difficulty,
        topic: topic.trim(),
      });

      if (res && res.success && Array.isArray(res.data?.questions)) {
        const questionsList = res.data.questions;
        setDraftQuestions(questionsList);
        // Default select all questions
        setSelectedIndices(new Set(questionsList.map((_, idx) => idx)));
        setStep('review');
      } else {
        throw new Error(res?.message || 'Failed to generate assessment questions.');
      }
    } catch (err) {
      console.error('AI Question Generation error:', err);
      setError(err.response?.data?.message || err.message || 'AI Question Generation failed. Please try again.');
      setStep('config');
    }
  };

  const handleRegenerateQuestion = async (index) => {
    const targetQ = draftQuestions[index];
    if (!targetQ) return;

    setRegeneratingIndex(index);
    try {
      const activeModuleId = selectedSource === 'module' ? (selectedModuleId || moduleId) : null;
      const res = await regenerateAiAssessmentQuestionApi({
        courseId,
        moduleId: activeModuleId,
        existingQuestionText: targetQ.questionText,
        difficulty: targetQ.difficulty || difficulty,
        topic: targetQ.topic || topic,
      });

      if (res?.success && res.data?.question) {
        const fresh = res.data.question;
        setDraftQuestions((prev) =>
          prev.map((q, idx) => (idx === index ? { ...fresh } : q))
        );
      }
    } catch (err) {
      console.error('Error regenerating question:', err);
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleToggleSelect = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIndices.size === draftQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(draftQuestions.map((_, idx) => idx)));
    }
  };

  const handleDeleteDraft = (index) => {
    setDraftQuestions((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedIndices((prev) => {
      const next = new Set();
      prev.forEach((val) => {
        if (val < index) next.add(val);
        else if (val > index) next.add(val - 1);
      });
      return next;
    });
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleDraftFieldChange = (index, field, value) => {
    setDraftQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  };

  const handleAddSelectedToAssessment = () => {
    const selected = draftQuestions.filter((_, idx) => selectedIndices.has(idx));
    if (selected.length === 0) {
      setError('Please select at least 1 question to add.');
      return;
    }

    onAddQuestions(selected);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[60] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-3 sm:p-6'
      } animate-fadeIn`}
    >
      <div
        className={`bg-[var(--surface)] shadow-2xl border border-[var(--border)] flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none'
            : 'max-w-4xl w-full max-h-[92vh] rounded-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border,#CCFBF1)] text-[var(--cc-accent)] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-accent)] bg-[var(--cc-accent-soft)] px-2 py-0.5 rounded-md border border-[var(--cc-accent-border,#CCFBF1)]">
                  AI Question Generator
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                Generate Questions from Course Content
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

          {/* STEP 1: CONFIGURATION */}
          {step === 'config' && (
            <div className="space-y-5">
              {/* Content Grounding Notice */}
              <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">Strictly Grounded in Course Content</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    AI synthesizes questions from the selected course description, module objectives, learning outcomes, and attached resources. AI will not invent questions outside your curriculum.
                  </p>
                </div>
              </div>

              {/* Source Scope Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Question Source Scope
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('module')}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      selectedSource === 'module'
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-1 ring-[var(--primary)]'
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary-border,#BFDBFE)]'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] block">
                        {moduleTitle ? `Current Module (${moduleTitle})` : 'Specific Module'}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Focus strictly on learning outcomes for this module.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('course')}
                    className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      selectedSource === 'course'
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-1 ring-[var(--primary)]'
                        : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary-border,#BFDBFE)]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-[var(--text-primary)] block">Entire Course</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Comprehensive curriculum coverage across all course modules.
                      </span>
                    </div>
                  </button>
                </div>

                {/* Specific Module Selector Dropdown if in Module source */}
                {selectedSource === 'module' && modules.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                      Choose Target Module
                    </label>
                    <select
                      value={selectedModuleId}
                      onChange={(e) => setSelectedModuleId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      {modules.map((m, idx) => (
                        <option key={m._id || idx} value={m._id}>
                          Module {m.order || idx + 1}: {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Number of Questions Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Number of Questions to Generate
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCount(num)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                        count === num
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-muted)]'
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Question Difficulty Level
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'easy', label: 'Easy' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'hard', label: 'Hard' },
                    { id: 'mixed', label: 'Mixed' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all border text-center ${
                        difficulty === d.id
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-muted)]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Topic Focus (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Specific Topic / Focus Area (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., State Management, Context API, Async Thunks"
                  className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* Question Type Lock */}
              <div className="pt-1 flex items-center justify-between text-xs text-[var(--text-muted)] bg-[var(--surface-muted)] p-3 rounded-xl border border-[var(--border)]">
                <span className="font-semibold">Question Type: Multiple Choice (4 Options with 1 Correct Answer)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Standard MCQ</span>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING PROGRESS */}
          {step === 'generating' && (
            <div className="py-14 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)] flex items-center justify-center border border-[var(--cc-accent-border,#CCFBF1)] animate-bounce">
                <Sparkles className="w-7 h-7" />
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Generating Grounded Assessment Questions
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Analyzing syllabus material, formulating distractors, and structuring explanations...
                </p>
              </div>

              {/* Step checklist */}
              <div className="w-full max-w-xs space-y-2 text-left text-xs bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border)]">
                <div className={`flex items-center gap-2 ${loadingStep >= 1 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 1 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                  <span>Retrieving course curriculum & outcomes</span>
                </div>
                <div className={`flex items-center gap-2 ${loadingStep >= 2 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 2 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                  <span>Formulating {count} concept questions</span>
                </div>
                <div className={`flex items-center gap-2 ${loadingStep >= 3 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 3 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                  <span>Validating distractors & explanations</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & SELECTION */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Review Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-muted)] p-3.5 rounded-xl border border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {draftQuestions.length} Questions Generated
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Draft &bull; Unsaved
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>
                      {selectedIndices.size === draftQuestions.length ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                  <span className="text-xs font-bold text-[var(--text-muted)]">
                    ({selectedIndices.size} selected)
                  </span>
                </div>
              </div>

              {/* Draft Questions List */}
              <div className="space-y-4">
                {draftQuestions.map((q, idx) => {
                  const isSelected = selectedIndices.has(idx);
                  const isEditing = editingIndex === idx;
                  const isRegenerating = regeneratingIndex === idx;
                  const isDuplicate = isDuplicateOfExisting(q.questionText);

                  return (
                    <div
                      key={idx}
                      className={`bg-[var(--surface)] border rounded-xl p-4 transition-all space-y-3 ${
                        isSelected
                          ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                          : 'border-[var(--border)] opacity-75'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(idx)}
                            className="w-4 h-4 text-[var(--primary)] rounded focus:ring-[var(--primary)] cursor-pointer"
                          />
                          <span className="text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded border border-[var(--border)]">
                            Q{idx + 1}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                            {q.difficulty || 'medium'}
                          </span>
                          {q.topic && (
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">
                              &bull; {q.topic}
                            </span>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRegenerateQuestion(idx)}
                            disabled={isRegenerating}
                            title="Regenerate this question with AI"
                            className="px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-muted)] hover:bg-[var(--border)] rounded-md border border-[var(--border)] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                            <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingIndex(isEditing ? null : idx)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] rounded hover:bg-[var(--surface-muted)] transition-colors"
                            title={isEditing ? 'Done Editing' : 'Edit Question'}
                          >
                            {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Edit2 className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(idx)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-rose-600 rounded hover:bg-[var(--surface-muted)] transition-colors"
                            title="Delete question from drafts"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Duplicate Warning Callout */}
                      {isDuplicate && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Similar question already exists in this assessment.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(idx)}
                            className="text-[11px] font-bold text-rose-600 hover:underline"
                          >
                            Remove Duplicate
                          </button>
                        </div>
                      )}

                      {/* Question Body */}
                      {isEditing ? (
                        <div className="space-y-3 pt-1 text-xs">
                          <div>
                            <label className="block font-bold text-[var(--text-secondary)] mb-1">Question Prompt</label>
                            <input
                              type="text"
                              value={q.questionText}
                              onChange={(e) => handleDraftFieldChange(idx, 'questionText', e.target.value)}
                              className="w-full px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] font-semibold"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {['A', 'B', 'C', 'D'].map((optKey) => (
                              <div key={optKey} className="flex items-center gap-2">
                                <span className="font-bold text-[11px] font-mono text-[var(--text-muted)]">{optKey}:</span>
                                <input
                                  type="text"
                                  value={q[`option${optKey}`]}
                                  onChange={(e) => handleDraftFieldChange(idx, `option${optKey}`, e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-primary)]"
                                />
                                <input
                                  type="radio"
                                  name={`correct-draft-${idx}`}
                                  checked={q.correctOption === optKey}
                                  onChange={() => handleDraftFieldChange(idx, 'correctOption', optKey)}
                                  title="Set as correct answer"
                                  className="w-3.5 h-3.5 text-[var(--primary)] cursor-pointer"
                                />
                              </div>
                            ))}
                          </div>

                          <div>
                            <label className="block font-bold text-[var(--text-secondary)] mb-1">Explanation</label>
                            <textarea
                              rows={2}
                              value={q.explanation}
                              onChange={(e) => handleDraftFieldChange(idx, 'explanation', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-primary)]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <h4 className="font-bold text-[var(--text-primary)] leading-snug">
                            {q.questionText}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {['A', 'B', 'C', 'D'].map((optKey) => {
                              const isCorrect = q.correctOption === optKey;
                              return (
                                <div
                                  key={optKey}
                                  className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                                    isCorrect
                                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                                      : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
                                    }`}
                                  >
                                    {optKey}
                                  </span>
                                  <span className="truncate">{q[`option${optKey}`]}</span>
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <p className="text-[11px] text-[var(--text-muted)] italic bg-[var(--surface-muted)] p-2 rounded-lg border border-[var(--border)]">
                              <strong className="not-italic text-[var(--text-secondary)] font-semibold">Explanation:</strong> {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[var(--surface-muted)] border-t border-[var(--border)] shrink-0">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
            {step === 'config' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleGenerate}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate {count} Questions</span>
                </button>
              </>
            ) : step === 'generating' ? (
              <div className="w-full text-center text-xs text-[var(--text-muted)]">
                Generation in progress. Please do not close this window.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('config')}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  &larr; Back to Config
                </button>

                <button
                  type="button"
                  onClick={handleAddSelectedToAssessment}
                  disabled={selectedIndices.size === 0}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Add {selectedIndices.size} Questions to Assessment</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiQuestionGeneratorModal;
