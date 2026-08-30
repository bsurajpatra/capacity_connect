import React, { useState, useEffect } from 'react';
import {
  saveModuleQuizApi,
  saveFinalAssessmentApi,
  deleteAssessmentApi,
} from '../services/api';
import Button from './Button';
import ErrorMessage from './ErrorMessage';
import AiQuestionGeneratorModal from './AiQuestionGeneratorModal';
import PdfQuestionImportModal from './PdfQuestionImportModal';
import {
  X,
  Plus,
  Minus,
  Trash2,
  HelpCircle,
  CheckCircle2,
  Percent,
  FileCheck,
  AlertCircle,
  Layers,
  Maximize2,
  Minimize2,
  Bot,
  Sparkles,
  FileText,
  Upload,
} from 'lucide-react';

const QuizBuilderModal = ({
  isOpen,
  onClose,
  onSaved,
  type = 'module', // 'module' | 'final'
  moduleId = null,
  courseId,
  moduleTitle = '',
  courseTitle = '',
  modules = [],
  initialAssessment = null,
}) => {
  const isFinal = type === 'final';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [timeLimit, setTimeLimit] = useState(30);
  const [allowedAttempts, setAllowedAttempts] = useState(3);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [status, setStatus] = useState('draft');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Sub-modals for Phase 7.7
  const [showAiGenModal, setShowAiGenModal] = useState(false);
  const [showPdfImportModal, setShowPdfImportModal] = useState(false);

  useEffect(() => {
    if (initialAssessment) {
      setTitle(initialAssessment.title || '');
      setDescription(initialAssessment.description || '');
      setPassingPercentage(
        initialAssessment.passingPercentage !== undefined
          ? initialAssessment.passingPercentage
          : isFinal
          ? 60
          : 50
      );
      setTimeLimit(initialAssessment.timeLimit !== undefined ? initialAssessment.timeLimit : 30);
      setAllowedAttempts(initialAssessment.allowedAttempts !== undefined ? initialAssessment.allowedAttempts : 3);
      setRandomizeQuestions(Boolean(initialAssessment.randomizeQuestions));
      setStatus(initialAssessment.status || 'draft');
      setQuestions(
        initialAssessment.questions && initialAssessment.questions.length > 0
          ? initialAssessment.questions.map((q) => ({
              _id: q._id,
              questionText: q.questionText || '',
              optionA: q.optionA || '',
              optionB: q.optionB || '',
              optionC: q.optionC || '',
              optionD: q.optionD || '',
              correctOption: (q.correctOption || 'A').toUpperCase(),
              marks: q.marks || 1,
              explanation: q.explanation || '',
              difficulty: q.difficulty || 'medium',
              topic: q.topic || '',
            }))
          : [createNewQuestion(1)]
      );
    } else {
      setTitle(isFinal ? `${courseTitle} — Final Assessment` : `${moduleTitle} Quiz`);
      setDescription('');
      setPassingPercentage(isFinal ? 60 : 50);
      setTimeLimit(30);
      setAllowedAttempts(3);
      setRandomizeQuestions(false);
      setStatus('draft');
      setQuestions([createNewQuestion(1)]);
    }
    setError(null);
  }, [initialAssessment, isFinal, courseTitle, moduleTitle, isOpen]);

  function createNewQuestion(index) {
    return {
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      marks: 1,
      explanation: '',
      difficulty: 'medium',
      topic: '',
    };
  }

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createNewQuestion(prev.length + 1)]);
  };

  const handleBatchAddQuestions = (newQuestions) => {
    if (!Array.isArray(newQuestions) || newQuestions.length === 0) return;
    setQuestions((prev) => {
      // If the current list only contains 1 empty placeholder question, replace it
      if (
        prev.length === 1 &&
        !prev[0].questionText.trim() &&
        !prev[0].optionA.trim()
      ) {
        return newQuestions;
      }
      return [...prev, ...newQuestions];
    });
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length === 1) {
      setError('An assessment must have at least 1 question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  };

  const validateForm = (intendedStatus) => {
    if (!title.trim()) {
      setError('Please provide an assessment title.');
      return false;
    }

    const passPct = parseInt(passingPercentage, 10);
    if (isNaN(passPct) || passPct < 0 || passPct > 100) {
      setError('Passing percentage must be between 0% and 100%.');
      return false;
    }

    if (questions.length === 0) {
      setError('Please add at least 1 question.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setError(`Question ${i + 1} text cannot be empty.`);
        return false;
      }
      if (!q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()) {
        setError(`Question ${i + 1} must have all 4 options (A, B, C, D) filled in.`);
        return false;
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correctOption)) {
        setError(`Question ${i + 1} must have a designated correct option (A, B, C, or D).`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (submitStatus) => {
    setError(null);
    if (!validateForm(submitStatus)) return;

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        status: submitStatus,
        passingPercentage: parseInt(passingPercentage, 10) || (isFinal ? 60 : 50),
        timeLimit: Math.max(0, parseInt(timeLimit, 10) || 0),
        allowedAttempts: Math.max(1, parseInt(allowedAttempts, 10) || 3),
        randomizeQuestions: Boolean(randomizeQuestions),
        questions: questions.map((q) => ({
          questionText: q.questionText.trim(),
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC.trim(),
          optionD: q.optionD.trim(),
          correctOption: q.correctOption,
          marks: Math.max(1, parseInt(q.marks, 10) || 1),
          explanation: q.explanation ? q.explanation.trim() : '',
          difficulty: q.difficulty || 'medium',
          topic: q.topic ? q.topic.trim() : '',
        })),
      };

      if (isFinal) {
        await saveFinalAssessmentApi(courseId, payload);
      } else {
        await saveModuleQuizApi(moduleId, payload);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialAssessment?._id) return;
    const confirm = window.confirm(
      'Are you sure you want to delete this assessment? All trainee attempts will also be removed.'
    );
    if (!confirm) return;

    setLoading(true);
    try {
      await deleteAssessmentApi(initialAssessment._id);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete assessment.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-3 sm:p-6'
      }`}
    >
      <div
        className={`bg-[var(--surface)] shadow-2xl flex flex-col overflow-hidden border border-[var(--border)] transition-all duration-200 animate-fadeIn ${
          isFullscreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none'
            : 'max-w-5xl w-full max-h-[92vh] rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isFinal
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                  : 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border,#BFDBFE)]'
              }`}
            >
              {isFinal ? <FileCheck className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isFinal ? 'Final Course Assessment Builder' : `Module Quiz: ${moduleTitle}`}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Configure MCQ questions, correct answers, and passing criteria.
              </p>
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

        {/* Scrollable Form Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          <div className="max-w-5xl mx-auto w-full space-y-6">
            {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

            {/* Assessment Title & Description */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                  Assessment Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. React Fundamentals Mastery Assessment"
                  className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-medium text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                  Instructions / Description <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Guidelines for learners taking this assessment..."
                  className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-secondary)] bg-[var(--surface)] transition-colors"
                />
              </div>

              {/* Assessment Parameters: Passing %, Time Limit, Attempts, Randomize */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Passing Percentage */}
                <div
                  className={`rounded-xl p-3 border ${
                    isFinal
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                      : 'bg-[var(--primary-soft)] border-[var(--primary-border,#BFDBFE)]'
                  }`}
                >
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                    Pass Threshold (%)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={passingPercentage}
                      onChange={(e) => setPassingPercentage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold font-mono border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                    <span className="text-xs font-bold text-[var(--text-muted)]">%</span>
                  </div>
                </div>

                {/* Time Limit */}
                <div className="rounded-xl p-3 border border-[var(--border)] bg-[var(--surface-muted)]">
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                    Time Limit (Mins)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold font-mono border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)]"
                    />
                    <span className="text-[11px] text-[var(--text-muted)] font-semibold">mins</span>
                  </div>
                </div>

                {/* Max Attempts */}
                <div className="rounded-xl p-3 border border-[var(--border)] bg-[var(--surface-muted)]">
                  <label className="block text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1">
                    Allowed Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={allowedAttempts}
                    onChange={(e) => setAllowedAttempts(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Randomize Toggle */}
              <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">Randomize Questions Order</span>
                  <p className="text-[11px] text-[var(--text-muted)]">Shuffle question sequence for each trainee attempt.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={(e) => setRandomizeQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
                  />
                </label>
              </div>
            </div>

            {/* Question List Section */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    MCQ Questions ({questions.length})
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Add questions manually, generate with AI from curriculum, or analyze uploaded document (PDF, Word, PPT).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Add Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAiGenModal(true)}
                    className="px-3 py-1.5 bg-[var(--cc-accent-soft)] hover:opacity-90 text-[var(--cc-accent)] border border-[var(--cc-accent-border,#CCFBF1)] rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate with AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPdfImportModal(true)}
                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Import Document (PDF/DOC/PPT)</span>
                  </button>
                </div>
              </div>

              {/* Questions Container */}
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-4 space-y-3 relative group hover:border-[var(--primary-border,#BFDBFE)] transition-colors"
                  >
                    {/* Question Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--surface)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                          Q{idx + 1}
                        </span>
                        {/* Difficulty Select */}
                        <select
                          value={q.difficulty || 'medium'}
                          onChange={(e) => handleQuestionChange(idx, 'difficulty', e.target.value)}
                          className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)]"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Topic Tag */}
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <span>Topic:</span>
                          <input
                            type="text"
                            value={q.topic || ''}
                            onChange={(e) => handleQuestionChange(idx, 'topic', e.target.value)}
                            placeholder="e.g. Async Await"
                            className="w-28 px-2 py-0.5 text-xs font-medium border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--text-primary)]"
                          />
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <span>Marks:</span>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={q.marks}
                            onChange={(e) =>
                              handleQuestionChange(idx, 'marks', parseInt(e.target.value, 10) || 1)
                            }
                            className="w-12 px-2 py-0.5 text-xs font-bold text-center border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--text-primary)]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          disabled={questions.length === 1}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-600 rounded transition-colors disabled:opacity-30"
                          title="Delete question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div>
                      <input
                        type="text"
                        required
                        value={q.questionText}
                        onChange={(e) => handleQuestionChange(idx, 'questionText', e.target.value)}
                        placeholder={`Enter Question ${idx + 1} prompt...`}
                        className="w-full px-3 py-2 text-xs font-semibold border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    {/* Options (A, B, C, D) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {['A', 'B', 'C', 'D'].map((optKey) => {
                        const field = `option${optKey}`;
                        const isCorrect = q.correctOption === optKey;

                        return (
                          <div
                            key={optKey}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                              isCorrect
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400'
                                : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary-border,#BFDBFE)]'
                            }`}
                          >
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <input
                                type="radio"
                                name={`correct-opt-${idx}`}
                                checked={isCorrect}
                                onChange={() => handleQuestionChange(idx, 'correctOption', optKey)}
                                className="w-3.5 h-3.5 text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span
                                className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
                                }`}
                              >
                                {optKey}
                              </span>
                            </label>
                            <input
                              type="text"
                              required
                              value={q[field]}
                              onChange={(e) => handleQuestionChange(idx, field, e.target.value)}
                              placeholder={`Option ${optKey} text`}
                              className="w-full text-xs bg-transparent border-none focus:outline-none text-[var(--text-primary)]"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Answer Explanation (Optional) */}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Answer Explanation <span className="text-[var(--text-muted)] font-normal">(Optional &bull; displayed to trainee during post-attempt review)</span>
                      </label>
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={q.explanation || ''}
                        onChange={(e) => handleQuestionChange(idx, 'explanation', e.target.value)}
                        placeholder="Explain why the designated answer is correct and provide learning context..."
                        className="w-full px-3 py-1.5 text-xs border border-[var(--border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="w-full py-2.5 border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] text-[var(--text-muted)] hover:text-[var(--primary)] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-[var(--surface-muted)]/50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Question</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-muted)] flex-shrink-0">
          <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-3">
            <div>
              {initialAssessment && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Assessment</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('draft')}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-muted)] border border-[var(--border)] hover:bg-[var(--border)] rounded-lg transition-colors"
              >
                Save Draft
              </button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={loading}
                disabled={loading}
                onClick={() => handleSubmit('published')}
                className="px-5 text-xs font-bold"
              >
                Publish Assessment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Modal 1: AI Question Generator */}
      {showAiGenModal && (
        <AiQuestionGeneratorModal
          isOpen={showAiGenModal}
          onClose={() => setShowAiGenModal(false)}
          courseId={courseId}
          moduleId={moduleId}
          courseTitle={courseTitle}
          moduleTitle={moduleTitle}
          modules={modules}
          existingQuestions={questions}
          onAddQuestions={handleBatchAddQuestions}
        />
      )}

      {/* Sub-Modal 2: PDF Question Importer */}
      {showPdfImportModal && (
        <PdfQuestionImportModal
          isOpen={showPdfImportModal}
          onClose={() => setShowPdfImportModal(false)}
          courseId={courseId}
          moduleId={moduleId}
          existingQuestions={questions}
          onAddQuestions={handleBatchAddQuestions}
        />
      )}
    </div>
  );
};

export default QuizBuilderModal;
