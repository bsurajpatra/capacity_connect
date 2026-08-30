import React, { useState, useEffect, useRef } from 'react';
import {
  importAssessmentPdfApi,
  suggestPdfQuestionAnswersApi,
} from '../services/api';
import {
  FileText,
  UploadCloud,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Trash2,
  Check,
  FileCheck,
  HelpCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
  BookOpen,
  Layers,
  Bot,
} from 'lucide-react';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

const PdfQuestionImportModal = ({
  isOpen,
  onClose,
  courseId,
  moduleId = null,
  existingQuestions = [],
  onAddQuestions,
}) => {
  const [step, setStep] = useState('upload'); // 'upload' | 'processing' | 'review'
  const [importMode, setImportMode] = useState('matter'); // 'matter' | 'exam_sheet'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Matter generation configuration
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [topic, setTopic] = useState('');

  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [hasAnswerKey, setHasAnswerKey] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [isSuggestingAnswers, setIsSuggestingAnswers] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setImportMode('matter');
      setSelectedFile(null);
      setQuestionCount(5);
      setDifficulty('medium');
      setTopic('');
      setExtractedQuestions([]);
      setHasAnswerKey(true);
      setSelectedIndices(new Set());
      setEditingIndex(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'processing') {
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

  const isDuplicateOfExisting = (questionText) => {
    if (!questionText || !existingQuestions || existingQuestions.length === 0) return false;
    const clean = questionText.toLowerCase().replace(/[^a-z0-9]/g, '');
    return existingQuestions.some((eq) => {
      const eqClean = (eq.questionText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean.length > 10 && (eqClean.includes(clean) || clean.includes(eqClean));
    });
  };

  const ALLOWED_EXTS = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md'];

  const validateFile = (file) => {
    if (!file) return 'Please choose a document file to upload.';
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return 'Please upload a supported document: PDF (.pdf), Word (.docx, .doc), PowerPoint (.pptx, .ppt), or Text (.txt, .md).';
    }
    if (file.size > 15 * 1024 * 1024) {
      return 'File size exceeds the maximum 15MB limit.';
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const valError = validateFile(file);
      if (valError) {
        setError(valError);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const valError = validateFile(file);
      if (valError) {
        setError(valError);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Please choose a PDF file to upload.');
      return;
    }

    setError(null);
    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('courseId', courseId);
      if (moduleId) formData.append('moduleId', moduleId);
      formData.append('importType', importMode === 'matter' ? 'content_matter' : 'question_sheet');
      formData.append('count', questionCount);
      formData.append('difficulty', difficulty);
      formData.append('topic', topic.trim());

      const res = await importAssessmentPdfApi(formData);

      if (res?.success && Array.isArray(res.data?.questions)) {
        const questionsList = res.data.questions;
        setExtractedQuestions(questionsList);
        setHasAnswerKey(Boolean(res.data.hasAnswerKey ?? true));
        setSelectedIndices(new Set(questionsList.map((_, idx) => idx)));
        setStep('review');
      } else {
        throw new Error(res?.message || 'Failed to extract questions from PDF.');
      }
    } catch (err) {
      console.error('PDF Import error:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "We couldn't extract readable text from this PDF. This PDF may contain scanned images. Please upload a text-based PDF or use manual entry."
      );
      setStep('upload');
    }
  };

  const handleSuggestAnswersWithAi = async () => {
    setIsSuggestingAnswers(true);
    setError(null);

    try {
      const res = await suggestPdfQuestionAnswersApi({
        questions: extractedQuestions,
        courseId,
        moduleId,
      });

      if (res?.success && Array.isArray(res.data?.questions)) {
        setExtractedQuestions(res.data.questions);
        setHasAnswerKey(true);
      }
    } catch (err) {
      console.error('Error suggesting answers:', err);
      setError('Could not suggest answers automatically. You can edit answers manually.');
    } finally {
      setIsSuggestingAnswers(false);
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
    if (selectedIndices.size === extractedQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(extractedQuestions.map((_, idx) => idx)));
    }
  };

  const handleDeleteExtracted = (index) => {
    setExtractedQuestions((prev) => prev.filter((_, idx) => idx !== index));
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

  const handleFieldChange = (index, field, value) => {
    setExtractedQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, [field]: value } : q))
    );
  };

  const handleAddSelectedToAssessment = () => {
    const selected = extractedQuestions.filter((_, idx) => selectedIndices.has(idx));
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
            : 'max-w-5xl w-full max-h-[92vh] rounded-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                  Document Matter Analyzer
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-accent)] bg-[var(--cc-accent-soft)] px-2 py-0.5 rounded-md border border-[var(--cc-accent-border,#CCFBF1)]">
                  PDF &bull; Word &bull; PPTX &bull; Text
                </span>
              </div>
              <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                Generate Questions from Document Matter (PDF, Word, PPTX)
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

            {/* STEP 1: UPLOAD & CONFIGURE */}
            {step === 'upload' && (
              <div className="space-y-6">
                {/* Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setImportMode('matter')}
                    className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      importMode === 'matter'
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                        : 'bg-[var(--surface-muted)] border-[var(--border)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">
                          Study Material / Document Matter (PDF, DOCX, PPTX, TXT)
                        </h4>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Upload lecture notes, textbook chapters, PowerPoint slides, or reference docs. AI analyzes the content matter and generates grounded MCQs.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('exam_sheet')}
                    className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      importMode === 'exam_sheet'
                        ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                        : 'bg-[var(--surface-muted)] border-[var(--border)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Pre-Formatted Exam Sheet PDF
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">
                        Upload a quiz document containing already numbered questions with options (A, B, C, D) and answer keys.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Matter Configuration Options */}
                {importMode === 'matter' && (
                  <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                      <span>Question Generation Parameters</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Question Count */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-[var(--text-secondary)]">
                          Number of Questions
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[3, 5, 10, 15, 20].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setQuestionCount(cnt)}
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
                                questionCount === cnt
                                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface-muted)]'
                              }`}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Difficulty */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-[var(--text-secondary)]">
                          Difficulty Level
                        </label>
                        <div className="flex items-center gap-1.5">
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
                              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors border ${
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

                      {/* Focus Topic */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-[var(--text-secondary)]">
                          Topic Focus (Optional)
                        </label>
                        <input
                          type="text"
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="e.g. Chapter 3, Architecture..."
                          className="w-full px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : selectedFile
                      ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-[var(--border)] hover:border-[var(--primary-border,#BFDBFE)] bg-[var(--surface-muted)]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,text/plain"
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
                        <FileCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">{selectedFile.name}</h4>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready to analyze
                        </p>
                      </div>
                      <span className="inline-block text-[11px] font-semibold text-[var(--primary)] hover:underline pt-1">
                        Change Document
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] text-[var(--primary)] border border-[var(--border)] flex items-center justify-center mx-auto shadow-2xs">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          {importMode === 'matter'
                            ? 'Drop your Study Material (PDF, DOCX, PPTX, TXT) here'
                            : 'Drop your Question Sheet Document here'}
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          or click to browse from your computer (PDF, Word, PowerPoint, Text &bull; Max 15MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: PROCESSING */}
            {step === 'processing' && (
              <div className="py-14 flex flex-col items-center justify-center space-y-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 animate-pulse">
                  <Bot className="w-7 h-7" />
                </div>

                <div className="space-y-2 max-w-sm">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {importMode === 'matter'
                      ? 'Analyzing PDF Matter & Synthesizing Questions'
                      : 'Extracting Questions from PDF'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {importMode === 'matter'
                      ? 'Reading document text stream, extracting core concepts, and generating grounded 4-option MCQs...'
                      : 'Parsing selectable text streams, extracting MCQs, and validating answer keys...'}
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-2 text-left text-xs bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border)]">
                  <div className={`flex items-center gap-2 ${loadingStep >= 1 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 1 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                    <span>Reading text from PDF document</span>
                  </div>
                  <div className={`flex items-center gap-2 ${loadingStep >= 2 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 2 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                    <span>Analyzing concepts & formulating MCQs</span>
                  </div>
                  <div className={`flex items-center gap-2 ${loadingStep >= 3 ? 'text-[var(--text-primary)] font-bold' : 'text-[var(--text-muted)]'}`}>
                    <CheckCircle2 className={`w-4 h-4 ${loadingStep >= 3 ? 'text-emerald-500' : 'text-[var(--border)]'}`} />
                    <span>Grounding answer keys & explanations</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW & SELECTION */}
            {step === 'review' && (
              <div className="space-y-4">
                {/* Missing Answer Key Banner */}
                {!hasAnswerKey && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No Answer Key Found in PDF</span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-300">
                      The uploaded PDF does not appear to contain an explicit answer key. Would you like AI to suggest the correct answers based on the question text?
                    </p>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSuggestAnswersWithAi}
                        disabled={isSuggestingAnswers}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isSuggestingAnswers ? 'animate-spin' : ''}`} />
                        <span>{isSuggestingAnswers ? 'Suggesting Answers...' : 'Yes, Suggest Answers with AI'}</span>
                      </button>
                      <span className="text-[11px] text-amber-800 dark:text-amber-400">or review/select correct answers manually below</span>
                    </div>
                  </div>
                )}

                {/* Review Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-muted)] p-3.5 rounded-xl border border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {extractedQuestions.length} Questions Generated from PDF
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      PDF Matter &bull; Draft
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                    >
                      <span>
                        {selectedIndices.size === extractedQuestions.length ? 'Deselect All' : 'Select All'}
                      </span>
                    </button>
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      ({selectedIndices.size} selected)
                    </span>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                  {extractedQuestions.map((q, idx) => {
                    const isSelected = selectedIndices.has(idx);
                    const isEditing = editingIndex === idx;
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
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                              q.difficulty === 'hard'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : q.difficulty === 'medium'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {q.difficulty || 'medium'}
                            </span>
                            {q.topic && (
                              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded border border-[var(--border)] truncate max-w-[160px]">
                                {q.topic}
                              </span>
                            )}
                            {q.isAiSuggestedAnswer && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                AI Suggested Answer &bull; Review Required
                              </span>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="flex items-center gap-1.5">
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
                              onClick={() => handleDeleteExtracted(idx)}
                              className="p-1.5 text-[var(--text-muted)] hover:text-rose-600 rounded hover:bg-[var(--surface-muted)] transition-colors"
                              title="Delete question"
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
                              onClick={() => handleDeleteExtracted(idx)}
                              className="text-[11px] font-bold text-rose-600 hover:underline"
                            >
                              Remove Duplicate
                            </button>
                          </div>
                        )}

                        {/* Card Content */}
                        {isEditing ? (
                          <div className="space-y-3 pt-1 text-xs">
                            <div>
                              <label className="block font-bold text-[var(--text-secondary)] mb-1">Question Prompt</label>
                              <input
                                type="text"
                                value={q.questionText}
                                onChange={(e) => handleFieldChange(idx, 'questionText', e.target.value)}
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
                                    onChange={(e) => handleFieldChange(idx, `option${optKey}`, e.target.value)}
                                    className="w-full px-2.5 py-1 text-xs border border-[var(--border)] rounded bg-[var(--surface)] text-[var(--text-primary)]"
                                  />
                                  <input
                                    type="radio"
                                    name={`correct-pdf-${idx}`}
                                    checked={q.correctOption === optKey}
                                    onChange={() => handleFieldChange(idx, 'correctOption', optKey)}
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
                                onChange={(e) => handleFieldChange(idx, 'explanation', e.target.value)}
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
                                <strong className="not-italic text-[var(--text-secondary)] font-semibold">Note:</strong> {q.explanation}
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
            {step === 'upload' ? (
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
                  onClick={handleExtract}
                  disabled={!selectedFile}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg transition-colors shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{importMode === 'matter' ? `Generate ${questionCount} Questions` : 'Extract Questions'}</span>
                </button>
              </>
            ) : step === 'processing' ? (
              <div className="w-full text-center text-xs text-[var(--text-muted)]">
                Analyzing PDF document and synthesizing questions. Please do not close this window.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  &larr; Upload Another PDF
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

export default PdfQuestionImportModal;
