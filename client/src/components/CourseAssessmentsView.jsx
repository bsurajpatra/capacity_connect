import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileCheck,
  Plus,
  Edit2,
  Copy,
  Trash2,
  Globe,
  Lock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  ArrowRight,
  Eye,
  HelpCircle,
  Clock,
  Shuffle,
  Tag,
  Percent,
  Layers,
  ChevronRight,
  Filter,
  GraduationCap,
  Award,
} from 'lucide-react';
import {
  getFinalAssessmentApi,
  getModuleQuizApi,
  toggleAssessmentStatusApi,
  deleteAssessmentApi,
  duplicateAssessmentApi,
  getCourseAssessmentResultsApi,
} from '../services/api';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import QuizBuilderModal from './QuizBuilderModal';
import AssessmentReviewModal from './AssessmentReviewModal';

const CourseAssessmentsView = ({
  courseId,
  courseTitle = 'Course',
  modules = [],
  onNotify,
}) => {
  const [subTab, setSubTab] = useState('overview'); // overview | question_bank | results
  const [assessments, setAssessments] = useState([]);
  const [resultsData, setResultsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Question Bank Search & Filter
  const [qbSearch, setQbSearch] = useState('');
  const [qbDifficulty, setQbDifficulty] = useState('all');

  // Results Filter & Search
  const [resultsSearch, setResultsSearch] = useState('');
  const [resultsStatusFilter, setResultsStatusFilter] = useState('all'); // all | passed | failed

  // Quiz Builder Modal Config
  const [quizModalConfig, setQuizModalConfig] = useState({
    isOpen: false,
    type: 'module',
    moduleId: null,
    moduleTitle: '',
    initialAssessment: null,
  });

  // Assessment Review Modal Config
  const [reviewModalConfig, setReviewModalConfig] = useState({
    isOpen: false,
    attemptId: null,
    assessmentTitle: '',
  });

  const fetchAssessmentsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = [];

      // 1. Fetch Final Assessment
      try {
        const finalRes = await getFinalAssessmentApi(courseId);
        if (finalRes && finalRes.success && finalRes.data?.assessment) {
          list.push({
            ...finalRes.data.assessment,
            isFinal: true,
            moduleTitle: null,
          });
        }
      } catch (e) {
        console.warn('No final assessment found or error:', e.message);
      }

      // 2. Fetch Module Quizzes for each module
      if (modules && modules.length > 0) {
        await Promise.all(
          modules.map(async (mod) => {
            try {
              const qRes = await getModuleQuizApi(mod._id);
              if (qRes && qRes.success && qRes.data?.quiz) {
                list.push({
                  ...qRes.data.quiz,
                  isFinal: false,
                  moduleTitle: mod.title,
                });
              }
            } catch (e) {
              console.warn(`No quiz for module ${mod.title}`);
            }
          })
        );
      }

      setAssessments(list);

      // 3. Fetch Course Results Roster (safely extract array from response)
      try {
        const resRoster = await getCourseAssessmentResultsApi(courseId);
        if (resRoster && resRoster.success) {
          const learnersList = Array.isArray(resRoster.data)
            ? resRoster.data
            : resRoster.data?.learners || [];
          setResultsData(learnersList);
        }
      } catch (e) {
        console.warn('Could not fetch assessment results roster:', e.message);
      }
    } catch (err) {
      console.error('Error fetching course assessments data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load course assessments.');
    } finally {
      setLoading(false);
    }
  }, [courseId, modules]);

  useEffect(() => {
    fetchAssessmentsData();
  }, [fetchAssessmentsData]);

  // Handler: Toggle Assessment Status (Draft / Published)
  const handleToggleStatus = async (assessmentId) => {
    setActionLoading(true);
    try {
      const res = await toggleAssessmentStatusApi(assessmentId);
      if (res && res.success) {
        if (onNotify) {
          onNotify({
            type: 'success',
            message: `Assessment status updated to "${res.data?.status}"`,
          });
        }
        await fetchAssessmentsData();
      }
    } catch (err) {
      if (onNotify) {
        onNotify({
          type: 'error',
          message: err.response?.data?.message || err.message || 'Failed to update assessment status.',
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Duplicate Assessment
  const handleDuplicate = async (assessmentId) => {
    setActionLoading(true);
    try {
      const res = await duplicateAssessmentApi(assessmentId);
      if (res && res.success) {
        if (onNotify) {
          onNotify({
            type: 'success',
            message: 'Assessment duplicated as draft.',
          });
        }
        await fetchAssessmentsData();
      }
    } catch (err) {
      if (onNotify) {
        onNotify({
          type: 'error',
          message: err.response?.data?.message || err.message || 'Failed to duplicate assessment.',
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Delete Assessment
  const handleDelete = async (assessmentId, assessmentTitle) => {
    const confirm = window.confirm(
      `Delete assessment "${assessmentTitle}"? This will also remove any trainee attempt records for this quiz.`
    );
    if (!confirm) return;

    setActionLoading(true);
    try {
      const res = await deleteAssessmentApi(assessmentId);
      if (res && res.success) {
        if (onNotify) {
          onNotify({
            type: 'success',
            message: 'Assessment removed successfully.',
          });
        }
        await fetchAssessmentsData();
      }
    } catch (err) {
      if (onNotify) {
        onNotify({
          type: 'error',
          message: err.response?.data?.message || err.message || 'Failed to delete assessment.',
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Compute Overall KPI Metrics safely
  const kpis = useMemo(() => {
    const totalAssessments = assessments.length;
    const activeAssessments = assessments.filter((a) => a.status === 'published').length;

    const safeResults = Array.isArray(resultsData) ? resultsData : [];
    let totalAttempts = 0;
    let passedAttempts = 0;
    let sumScore = 0;
    let scoreCount = 0;

    safeResults.forEach((r) => {
      if (r.moduleQuizzesAttempted) {
        totalAttempts += r.moduleQuizzesAttempted;
      }
      if (r.finalAttemptId) {
        totalAttempts += 1;
        if (r.finalPassed) passedAttempts += 1;
        if (r.finalScore !== null && r.finalScore !== undefined) {
          sumScore += r.finalScore;
          scoreCount += 1;
        }
      }
      if (r.moduleQuizAvg !== null && r.moduleQuizAvg !== undefined) {
        sumScore += r.moduleQuizAvg;
        scoreCount += 1;
        if (r.moduleQuizAvg >= 50) {
          passedAttempts += (r.moduleQuizzesAttempted || 1);
        }
      }
    });

    const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
    const avgScore = scoreCount > 0 ? Math.round(sumScore / scoreCount) : null;

    return {
      totalAssessments,
      activeAssessments,
      totalAttempts,
      passRate,
      avgScore,
    };
  }, [assessments, resultsData]);

  // Aggregate All Questions for the Question Bank Tab
  const questionBankList = useMemo(() => {
    const questions = [];
    assessments.forEach((ass) => {
      (ass.questions || []).forEach((q, qIdx) => {
        questions.push({
          ...q,
          assessmentId: ass._id,
          assessmentTitle: ass.title,
          assessmentType: ass.type,
          moduleTitle: ass.moduleTitle,
          qNumber: qIdx + 1,
        });
      });
    });

    return questions.filter((q) => {
      const matchesSearch =
        qbSearch.trim() === '' ||
        q.questionText?.toLowerCase().includes(qbSearch.toLowerCase().trim()) ||
        q.topic?.toLowerCase().includes(qbSearch.toLowerCase().trim()) ||
        q.assessmentTitle?.toLowerCase().includes(qbSearch.toLowerCase().trim());

      const matchesDifficulty =
        qbDifficulty === 'all' || (q.difficulty || 'medium') === qbDifficulty;

      return matchesSearch && matchesDifficulty;
    });
  }, [assessments, qbSearch, qbDifficulty]);

  // Filter Results Roster safely
  const filteredResults = useMemo(() => {
    const safeResults = Array.isArray(resultsData) ? resultsData : [];
    return safeResults.filter((r) => {
      const traineeName = (r.name || r.trainee?.name || '').toLowerCase();
      const traineeEmail = (r.email || r.trainee?.email || '').toLowerCase();
      const q = resultsSearch.toLowerCase().trim();
      const matchesSearch = q === '' || traineeName.includes(q) || traineeEmail.includes(q);

      const hasPassed = (r.finalPassed) || (r.moduleQuizAvg !== null && r.moduleQuizAvg >= 50);
      const matchesStatus =
        resultsStatusFilter === 'all' ||
        (resultsStatusFilter === 'passed' && hasPassed) ||
        (resultsStatusFilter === 'failed' && !hasPassed);

      return matchesSearch && matchesStatus;
    });
  }, [resultsData, resultsSearch, resultsStatusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation Strip */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)] mb-1">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Assessment & Evaluation Hub</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Course Assessments & Knowledge Checks
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Design quizzes, manage question banks, review trainee score distributions, and verify competency attainment.
            </p>
          </div>

          {/* Quick Create Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                const finalAss = assessments.find((a) => a.isFinal);
                setQuizModalConfig({
                  isOpen: true,
                  type: 'final',
                  moduleId: null,
                  moduleTitle: '',
                  initialAssessment: finalAss || null,
                });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{assessments.some((a) => a.isFinal) ? 'Edit Final Exam' : 'Create Final Exam'}</span>
            </button>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)] text-xs">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              subTab === 'overview'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Overview ({assessments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('question_bank')}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              subTab === 'question_bank'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Question Bank ({questionBankList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('results')}
            className={`px-3.5 py-1.5 font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
              subTab === 'results'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Learner Results ({Array.isArray(resultsData) ? resultsData.length : 0})</span>
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading course assessments and attempt records..." />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchAssessmentsData} />
      ) : (
        <>
          {/* ====================================================
              SUB-TAB 1: ASSESSMENT OVERVIEW
              ==================================================== */}
          {subTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Summary KPI Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs text-center">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Total Quizzes</span>
                  <strong className="text-xl font-bold text-[var(--text-primary)]">{kpis.totalAssessments}</strong>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs text-center">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Published</span>
                  <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.activeAssessments}</strong>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs text-center">
                  <span className="text-[10px] font-bold uppercase text-[var(--primary)] block">Total Attempts</span>
                  <strong className="text-xl font-bold text-[var(--primary)]">{kpis.totalAttempts}</strong>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs text-center">
                  <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Avg Score</span>
                  <strong className="text-xl font-bold text-[var(--text-primary)]">
                    {kpis.avgScore !== null ? `${kpis.avgScore}%` : '--'}
                  </strong>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Pass Rate</span>
                  <strong className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{kpis.passRate}%</strong>
                </div>
              </div>

              {/* Assessment Table */}
              {assessments.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-3">
                  <FileCheck className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">No assessments created for this course yet</h3>
                  <p className="text-[var(--text-muted)] max-w-sm mx-auto">
                    Add module quizzes to reinforce each topic, or build a comprehensive Final Assessment to unlock digital certificate issuance.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuizModalConfig({
                        isOpen: true,
                        type: 'final',
                        moduleId: null,
                        moduleTitle: '',
                        initialAssessment: null,
                      });
                    }}
                    className="px-4 py-2 bg-[var(--primary)] text-white font-bold rounded-lg shadow-xs hover:bg-[var(--primary-hover)] transition-colors"
                  >
                    Build Final Assessment
                  </button>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3.5 px-4">Assessment Title & Placement</th>
                          <th className="py-3.5 px-4 text-center">Type</th>
                          <th className="py-3.5 px-4 text-center">Questions</th>
                          <th className="py-3.5 px-4 text-center">Time Limit</th>
                          <th className="py-3.5 px-4 text-center">Passing Req.</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                        {assessments.map((ass) => {
                          const isFinal = ass.isFinal || ass.type === 'final';
                          const isPublished = ass.status === 'published';
                          const qCount = ass.questions?.length || 0;
                          const totalMarks = (ass.questions || []).reduce((s, q) => s + (q.marks || 1), 0);

                          return (
                            <tr key={ass._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                              {/* Title & Placement */}
                              <td className="py-3.5 px-4">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-[var(--text-primary)] block text-xs">{ass.title}</span>
                                  {ass.moduleTitle ? (
                                    <span className="text-[11px] text-[var(--text-muted)]">
                                      Module: <strong className="text-[var(--text-primary)]">{ass.moduleTitle}</strong>
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[var(--primary)] font-semibold">
                                      Graduation Certification Exam
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Type */}
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                                    isFinal
                                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  }`}
                                >
                                  {isFinal ? 'Final Exam' : 'Module Quiz'}
                                </span>
                              </td>

                              {/* Questions & Marks */}
                              <td className="py-3.5 px-4 text-center font-mono">
                                <strong>{qCount}</strong> Qs &bull; {totalMarks} Marks
                              </td>

                              {/* Time Limit */}
                              <td className="py-3.5 px-4 text-center font-mono">
                                {ass.timeLimit ? `${ass.timeLimit} mins` : 'Untimed'}
                              </td>

                              {/* Passing Percentage */}
                              <td className="py-3.5 px-4 text-center font-bold text-[var(--text-primary)] font-mono">
                                {ass.passingPercentage || (isFinal ? 60 : 50)}%
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleToggleStatus(ass._id)}
                                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border transition-all ${
                                    isPublished
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                                  }`}
                                  title="Click to toggle publish status"
                                >
                                  {ass.status}
                                </button>
                              </td>

                              {/* Action Buttons */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit Quiz */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuizModalConfig({
                                        isOpen: true,
                                        type: isFinal ? 'final' : 'module',
                                        moduleId: ass.module || null,
                                        moduleTitle: ass.moduleTitle || '',
                                        initialAssessment: ass,
                                      })
                                    }
                                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
                                    title="Edit Assessment"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Duplicate Quiz */}
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleDuplicate(ass._id)}
                                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
                                    title="Duplicate Assessment"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete Quiz */}
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleDelete(ass._id, ass.title)}
                                    className="p-1.5 text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Delete Assessment"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================
              SUB-TAB 2: QUESTION BANK EXPLORER
              ==================================================== */}
          {subTab === 'question_bank' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Question Bank Toolbar */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={qbSearch}
                    onChange={(e) => setQbSearch(e.target.value)}
                    placeholder="Search questions by keyword, topic, or concept..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] placeholder-[var(--text-muted)] transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Difficulty:</span>
                    <select
                      value={qbDifficulty}
                      onChange={(e) => setQbDifficulty(e.target.value)}
                      className="bg-transparent font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Questions Grid */}
              {questionBankList.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
                  <Layers className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h4 className="font-bold text-[var(--text-primary)]">No questions found in question bank</h4>
                  <p className="text-[var(--text-muted)]">Create quizzes or adjust your search filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questionBankList.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs space-y-3 hover:border-[var(--primary-border,#BFDBFE)] transition-colors flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase truncate max-w-[200px]">
                            {q.assessmentTitle}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                              q.difficulty === 'hard'
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : q.difficulty === 'easy'
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {q.difficulty || 'medium'}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                          {q.questionText}
                        </h4>

                        {/* Options List */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {['A', 'B', 'C', 'D'].map((optKey) => {
                            const optText = q[`option${optKey}`];
                            const isCorrect = q.correctOption === optKey;
                            if (!optText) return null;

                            return (
                              <div
                                key={optKey}
                                className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 border ${
                                  isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold'
                                    : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-secondary)]'
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
                                  }`}
                                >
                                  {optKey}
                                </span>
                                <span className="truncate">{optText}</span>
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <div className="p-2.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            <span className="font-bold text-[var(--text-muted)] uppercase text-[9px] block">Explanation:</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                        <span>{q.topic ? `Topic: ${q.topic}` : 'General Concept'}</span>
                        <span className="font-bold font-mono text-[var(--text-primary)]">{q.marks || 1} Marks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====================================================
              SUB-TAB 3: LEARNER ASSESSMENT RESULTS ROSTER
              ==================================================== */}
          {subTab === 'results' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Toolbar */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={resultsSearch}
                    onChange={(e) => setResultsSearch(e.target.value)}
                    placeholder="Search results by trainee name or email..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] placeholder-[var(--text-muted)] transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Outcome:</span>
                    <select
                      value={resultsStatusFilter}
                      onChange={(e) => setResultsStatusFilter(e.target.value)}
                      className="bg-transparent font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer text-xs"
                    >
                      <option value="all">All Trainees</option>
                      <option value="passed">Passed Assessment</option>
                      <option value="failed">At Risk / Failed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              {filteredResults.length === 0 ? (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
                  <Users className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h4 className="font-bold text-[var(--text-primary)]">No assessment results recorded yet</h4>
                  <p className="text-[var(--text-muted)]">As enrolled learners submit quizzes and exams, their scores will appear here.</p>
                </div>
              ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3.5 px-4">Learner Name</th>
                          <th className="py-3.5 px-4 text-center">Module Quizzes Avg</th>
                          <th className="py-3.5 px-4 text-center">Final Exam Score</th>
                          <th className="py-3.5 px-4 text-center">Overall Outcome</th>
                          <th className="py-3.5 px-4 text-center">Certificate</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                        {filteredResults.map((item, idx) => {
                          const traineeName = item.name || item.trainee?.name || 'Learner';
                          const traineeEmail = item.email || item.trainee?.email || 'N/A';
                          const hasPassedFinal = Boolean(item.finalPassed);
                          const hasCert = Boolean(item.hasCertificate || item.certificate);

                          return (
                            <tr key={item.traineeId || idx} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-[var(--text-primary)] block">{traineeName}</span>
                                <span className="text-[11px] text-[var(--text-muted)] font-mono">{traineeEmail}</span>
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono">
                                {item.moduleQuizAvg !== null && item.moduleQuizAvg !== undefined ? (
                                  <span className="font-bold text-[var(--text-primary)]">{item.moduleQuizAvg}%</span>
                                ) : (
                                  <span className="text-[var(--text-muted)]">--</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center font-mono">
                                {item.finalScore !== null && item.finalScore !== undefined ? (
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded-md border ${
                                      hasPassedFinal
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}
                                  >
                                    {item.finalScore}%
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)]">Not Attempted</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                                    hasPassedFinal
                                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      : item.finalScore !== null && item.finalScore !== undefined
                                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                      : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]'
                                  }`}
                                >
                                  {hasPassedFinal ? 'Passed' : item.finalScore !== null && item.finalScore !== undefined ? 'Failed' : 'Pending'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                {hasCert ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    <Award className="w-3 h-3 text-indigo-600" />
                                    <span>Verified</span>
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-[10px]">--</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                {item.finalAttemptId ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReviewModalConfig({
                                        isOpen: true,
                                        attemptId: item.finalAttemptId,
                                        assessmentTitle: 'Final Exam Attempt',
                                      })
                                    }
                                    className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Audit Attempt</span>
                                  </button>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-[11px] italic">No exam attempt</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Quiz Builder Modal */}
      {quizModalConfig.isOpen && (
        <QuizBuilderModal
          isOpen={quizModalConfig.isOpen}
          onClose={() =>
            setQuizModalConfig({
              isOpen: false,
              type: 'module',
              moduleId: null,
              moduleTitle: '',
              initialAssessment: null,
            })
          }
          onSaved={async () => {
            await fetchAssessmentsData();
            if (onNotify) {
              onNotify({
                type: 'success',
                message: 'Assessment saved successfully.',
              });
            }
          }}
          type={quizModalConfig.type}
          moduleId={quizModalConfig.moduleId}
          moduleTitle={quizModalConfig.moduleTitle}
          courseId={courseId}
          courseTitle={courseTitle}
          modules={modules || []}
          initialAssessment={quizModalConfig.initialAssessment}
        />
      )}

      {/* Assessment Attempt Review Modal */}
      {reviewModalConfig.isOpen && (
        <AssessmentReviewModal
          isOpen={reviewModalConfig.isOpen}
          onClose={() =>
            setReviewModalConfig({
              isOpen: false,
              attemptId: null,
              assessmentTitle: '',
            })
          }
          attemptId={reviewModalConfig.attemptId}
          assessmentTitle={reviewModalConfig.assessmentTitle}
        />
      )}
    </div>
  );
};

export default CourseAssessmentsView;
