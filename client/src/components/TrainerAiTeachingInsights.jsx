import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Sparkles,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Users,
  Target,
  RefreshCw,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  BarChart2,
  GraduationCap,
} from 'lucide-react';
import { getTrainerAiTeachingInsightsApi, refreshTrainerAiTeachingInsightsApi } from '../services/api';
import Loading from './Loading';

const TrainerAiTeachingInsights = ({ onOpenCourseAiModal }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'questions' | 'dropoff' | 'skills' | 'learners'

  const fetchInsights = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = isManualRefresh
        ? await refreshTrainerAiTeachingInsightsApi()
        : await getTrainerAiTeachingInsightsApi();

      if (res?.success && res.data) {
        setInsights(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load AI teaching insights');
      }
    } catch (err) {
      console.warn('Trainer AI teaching insights error:', err.message);
      setError(err.response?.data?.message || err.message || 'Could not load AI teaching insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights(false);
  }, [fetchInsights]);

  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 shadow-xs flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-[var(--cc-accent-soft)] text-[var(--cc-accent)] flex items-center justify-center animate-pulse">
          <Bot className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">Synthesizing AI Teaching Insights across your courses & assessments...</p>
        <p className="text-[11px] text-[var(--text-muted)]">Analyzing question accuracy, module drop-offs, and skill attainment patterns</p>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-6 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">AI Teaching Insights Temporarily Unavailable</h4>
            <p className="text-[11px] text-[var(--text-muted)]">{error || 'Please check back shortly or try refreshing.'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchInsights(true)}
          className="px-3.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-primary)] text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const {
    summary = '',
    difficultyAreas = [],
    dropOffInsights = [],
    skillInsights = [],
    teachingSuggestions = [],
    learnerSupport = [],
    metricsSummary = {},
    cached = false,
    timestamp = null,
  } = insights;

  const severityBadgeStyles = {
    high: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    medium: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    low: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  };

  const skillDifficultyStyles = {
    high: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800',
    moderate: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    demonstrated: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs space-y-6 relative overflow-hidden transition-colors">
      {/* Decorative top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-teal-500 to-indigo-500" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent)] flex items-center justify-center border border-[var(--cc-accent-border,#CCFBF1)]">
              <Bot className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <span>AI Teaching Insights & Pedagogical Assistant</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] pl-9">
            Continuous diagnostic intelligence derived from learner quiz accuracy, module drop-offs, and skill attainment.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 pl-9 sm:pl-0">
          {cached && (
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-md font-mono border border-[var(--border)]">
              Cached
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchInsights(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Analyzing...' : 'Refresh Insights'}</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Curriculum Health Summary</span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
            {summary}
          </p>
        </div>

        {/* Metric Pills */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-center shadow-2xs">
            <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase">Difficulty Points</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{difficultyAreas.length}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-center shadow-2xs">
            <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase">Drop-Offs</span>
            <span className="text-sm font-bold text-amber-600">{dropOffInsights.length}</span>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-center shadow-2xs">
            <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase">Action Advice</span>
            <span className="text-sm font-bold text-[var(--primary)]">{teachingSuggestions.length}</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Teaching Suggestions ({teachingSuggestions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'questions'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Difficulty Areas ({difficultyAreas.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dropoff')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'dropoff'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Learner Drop-Off ({dropOffInsights.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'skills'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Skill Difficulty ({skillInsights.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('learners')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'learners'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Learners Needing Support ({learnerSupport.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-4">
        {/* PANEL 1: TEACHING SUGGESTIONS */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {teachingSuggestions.length === 0 ? (
              <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Healthy Pedagogical Flow</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
                  No immediate critical teaching interventions required across published course modules.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teachingSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-[var(--primary-border,#BFDBFE)] transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                          <span>{sug.type?.replace(/_/g, ' ') || 'Actionable Advice'}</span>
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          sug.priority === 'high' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' : 'bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]'
                        }`}>
                          {sug.priority || 'medium'} Priority
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug flex items-start gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{sug.title}</span>
                      </h4>

                      {/* 4-Part Structure */}
                      <div className="space-y-2 text-xs bg-[var(--surface-muted)] rounded-lg p-3 border border-[var(--border)]">
                        <div>
                          <strong className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">What Happened:</strong>
                          <p className="text-[var(--text-secondary)] mt-0.5">{sug.courseTitle ? `Friction detected in "${sug.courseTitle}".` : 'Cohort-wide learning pattern analyzed.'}</p>
                        </div>
                        <div>
                          <strong className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Why It Matters:</strong>
                          <p className="text-[var(--text-secondary)] mt-0.5">{sug.action || 'Concept mastery contributes to verified competency ratings.'}</p>
                        </div>
                        <div>
                          <strong className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Recommended Action:</strong>
                          <p className="text-[var(--text-primary)] font-semibold mt-0.5">{sug.action}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <Link
                        to="/trainer/learners"
                        className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-muted)] hover:bg-[var(--border)] rounded-lg border border-[var(--border)] transition-colors inline-flex items-center gap-1"
                      >
                        <Users className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>View Learners</span>
                      </Link>

                      <Link
                        to="/trainer/courses"
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span>Review Assessment</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL 2: DIFFICULTY AREAS (QUESTIONS) */}
        {activeTab === 'questions' && (
          <div className="space-y-3">
            {difficultyAreas.length === 0 ? (
              <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">High Assessment Accuracy Across Courses</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
                  Learners are answering assessment questions with healthy accuracy rates above difficulty thresholds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {difficultyAreas.map((q, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)] font-semibold truncate max-w-[200px]">
                          {q.courseTitle} &bull; {q.assessmentTitle}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          severityBadgeStyles[q.severity] || severityBadgeStyles.medium
                        }`}>
                          {q.accuracyPercentage}% Accuracy
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">
                        "{q.topic}"
                      </h4>

                      <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg p-3 space-y-2">
                        <div>
                          <strong className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">What Happened:</strong>
                          <p className="text-[var(--text-secondary)]">{q.attempts} total attempts with {q.incorrectCount} incorrect submissions ({q.accuracyPercentage}% success rate).</p>
                        </div>
                        <div>
                          <strong className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Why It Matters:</strong>
                          <p className="text-[var(--text-secondary)]">{q.insight}</p>
                        </div>
                        <div>
                          <strong className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Recommended Action:</strong>
                          <p className="text-[var(--text-primary)] font-semibold">Review this concept in course lecture notes or add a supplementary practice exercise.</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                      <Link
                        to="/trainer/learners"
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium inline-flex items-center gap-1"
                      >
                        <Users className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>Inspect Learners</span>
                      </Link>

                      <Link
                        to="/trainer/courses"
                        className="text-[var(--primary)] hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        <span>Review Assessment</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL 3: LEARNER DROP-OFF */}
        {activeTab === 'dropoff' && (
          <div className="space-y-3">
            {dropOffInsights.length === 0 ? (
              <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">No Significant Drop-Off Friction Detected</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
                  Learners are systematically moving through curriculum modules with balanced retention.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dropOffInsights.map((d, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{d.courseTitle}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {d.completionPercentage}% Completion
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Module: {d.moduleTitle}</span>
                      </h4>

                      <p className="text-xs text-[var(--text-secondary)] bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg p-2.5">
                        {d.reason}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>{d.completedCount} of {d.enrolledCount} enrolled completed</span>
                      <span className="text-[var(--text-primary)] font-medium">Pacing checkpoint</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL 4: SKILL DIFFICULTY */}
        {activeTab === 'skills' && (
          <div className="space-y-3">
            {skillInsights.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-6 text-center">No mapped course skills to analyze.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {skillInsights.map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">{s.category}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                          skillDifficultyStyles[s.difficulty] || skillDifficultyStyles.moderate
                        }`}>
                          {s.difficulty}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[var(--text-primary)]">{s.skill}</h4>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{s.reason}</p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>Pass Rate: <strong className="text-[var(--text-primary)]">{s.passRate}%</strong></span>
                      <span>{s.coursesMapped} {s.coursesMapped === 1 ? 'course' : 'courses'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL 5: LEARNERS NEEDING SUPPORT */}
        {activeTab === 'learners' && (
          <div className="space-y-3">
            {learnerSupport.length === 0 ? (
              <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">All Learners Performing Above Support Thresholds</h4>
                <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
                  No trainees currently show repeated assessment failure patterns.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {learnerSupport.map((l, idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{l.traineeName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {l.failedAttemptsCount} {l.failedAttemptsCount === 1 ? 'Failed Attempt' : 'Failed Attempts'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] font-medium">{l.courseTitle}</p>
                      <p className="text-xs text-[var(--text-secondary)] bg-[var(--surface-muted)] p-2 rounded-lg border border-[var(--border)]">
                        {l.reason}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>Latest Score: <strong className="text-[var(--text-primary)]">{l.latestScore}%</strong></span>
                      <span>Progress: <strong className="text-[var(--text-primary)]">{l.progress}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerAiTeachingInsights;
