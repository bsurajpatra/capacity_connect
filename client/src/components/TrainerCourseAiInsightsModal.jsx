import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  X,
  RefreshCw,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  Users,
  CheckCircle2,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { getCourseAiTeachingInsightsApi, refreshCourseAiTeachingInsightsApi } from '../services/api';
import Loading from './Loading';

const TrainerCourseAiInsightsModal = ({ isOpen, onClose, courseId, courseTitle }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCourseAi = useCallback(async (isRefresh = false) => {
    if (!courseId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = isRefresh
        ? await refreshCourseAiTeachingInsightsApi(courseId)
        : await getCourseAiTeachingInsightsApi(courseId);

      if (res?.success && res.data) {
        setData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to load course AI insights.');
      }
    } catch (err) {
      console.warn('Course AI insights error:', err.message);
      setError(err.response?.data?.message || err.message || 'Could not load course AI insights.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isOpen && courseId) {
      fetchCourseAi(false);
    }
  }, [isOpen, courseId, fetchCourseAi]);

  if (!isOpen) return null;

  const learnerCount = data?.performance?.enrollmentCount ?? data?.courseData?.enrollmentCount ?? 0;
  const avgProgress = data?.performance?.averageProgress ?? data?.courseData?.averageProgress ?? 0;
  const completionRate = data?.performance?.completionRate ?? data?.courseData?.completionPercentage ?? 0;
  const avgScore = data?.performance?.averageScore ?? data?.courseData?.averageAssessmentScore ?? 0;

  const teachingSuggestions = Array.isArray(data?.teachingSuggestions) ? data.teachingSuggestions : [];
  const difficultyAreas = Array.isArray(data?.difficultyAreas) ? data.difficultyAreas : [];
  const dropOffInsights = Array.isArray(data?.dropOffInsights) ? data.dropOffInsights : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col transition-colors">
        {/* Modal Header */}
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border)] p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border,#CCFBF1)] flex items-center justify-center text-[var(--cc-accent)]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-accent)] bg-[var(--cc-accent-soft)] px-2 py-0.5 rounded-md border border-[var(--cc-accent-border,#CCFBF1)]">
                  Course AI Diagnostic
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight truncate max-w-md mt-0.5">
                {courseTitle || data?.courseTitle || data?.courseData?.title || 'Course AI Insights'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fetchCourseAi(true)}
              disabled={refreshing || loading}
              title="Refresh AI Analysis"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[var(--surface)]">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loading message="Analyzing course curriculum, learner attempts, and question accuracy..." />
            </div>
          ) : error ? (
            <div className="p-8 text-center space-y-3 bg-[var(--surface-muted)] border border-rose-200 dark:border-rose-800 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">{error}</p>
              <button
                type="button"
                onClick={() => fetchCourseAi(true)}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold"
              >
                Retry Analysis
              </button>
            </div>
          ) : data ? (
            <>
              {/* Executive Metrics Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs text-center">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Learners</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">{learnerCount}</span>
                </div>
                <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs text-center">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Avg Progress</span>
                  <span className="text-base font-bold text-[var(--primary)]">{avgProgress}%</span>
                </div>
                <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs text-center">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Completion</span>
                  <span className="text-base font-bold text-emerald-600">{completionRate}%</span>
                </div>
                <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs text-center">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block">Avg Score</span>
                  <span className="text-base font-bold text-[var(--text-primary)]">{avgScore}%</span>
                </div>
              </div>

              {/* Teaching Suggestions */}
              {teachingSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Recommended Teaching Actions</span>
                  </h4>
                  <div className="space-y-2">
                    {teachingSuggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{sug.title}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {sug.priority || 'medium'} priority
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{sug.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question Difficulties */}
              {difficultyAreas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>Question Difficulty Bottlenecks</span>
                  </h4>
                  <div className="space-y-2">
                    {difficultyAreas.map((q, idx) => (
                      <div
                        key={idx}
                        className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">"{q.topic}"</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {q.accuracyPercentage}% Accuracy
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] bg-[var(--surface)] p-2 rounded-lg border border-[var(--border)]">
                          {q.insight}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Module Drop-Offs */}
              {dropOffInsights.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Module Drop-Off Curve</span>
                  </h4>
                  <div className="space-y-2">
                    {dropOffInsights.map((d, idx) => (
                      <div
                        key={idx}
                        className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{d.moduleTitle}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {d.completionPercentage}% Completion
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{d.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[var(--surface-muted)] border-t border-[var(--border)] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[var(--text-muted)]">
            AI interpretations assist teaching decisions; platform records remain unchanged.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainerCourseAiInsightsModal;
