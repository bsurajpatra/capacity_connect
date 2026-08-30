import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  GraduationCap,
  Sparkles,
  X,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { getTrainerLearnersApi, getTrainerLearnerDetailsApi } from '../services/api';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import LearnerDetailsDrawer from './LearnerDetailsDrawer';

const CourseLearnersView = ({ courseId, courseTitle = 'Course' }) => {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | Not Started | In Progress | At Risk | Completed
  const [progressFilter, setProgressFilter] = useState('all'); // all | 0-25 | 25-50 | 50-75 | 75-100
  const [assessmentFilter, setAssessmentFilter] = useState('all'); // all | passed | failed | none
  const [sortBy, setSortBy] = useState('progress_desc'); // progress_desc | progress_asc | name_asc | score_desc | activity_desc

  // Drawer / Inspection states
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [learnerDetails, setLearnerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchLearners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrainerLearnersApi(courseId ? { courseId } : {});
      if (response && response.success) {
        setLearners(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch learners for this course');
      }
    } catch (err) {
      console.error('Error fetching course learners:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load learners.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  const handleInspectLearner = async (learnerItem) => {
    const traineeId = learnerItem.trainee?._id;
    if (!traineeId) return;

    setSelectedLearner(learnerItem.trainee);
    setDrawerOpen(true);
    setDetailsLoading(true);
    setLearnerDetails(null);

    try {
      const response = await getTrainerLearnerDetailsApi(traineeId);
      if (response && response.success) {
        setLearnerDetails(response.data);
      }
    } catch (err) {
      console.error('Error fetching learner details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setProgressFilter('all');
    setAssessmentFilter('all');
    setSortBy('progress_desc');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    progressFilter !== 'all' ||
    assessmentFilter !== 'all' ||
    sortBy !== 'progress_desc';

  // Filtered and sorted dataset
  const processedLearners = useMemo(() => {
    let list = [...learners];

    // 1. Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((l) => {
        const name = l.trainee?.name?.toLowerCase() || '';
        const email = l.trainee?.email?.toLowerCase() || '';
        const dept = l.trainee?.department?.toLowerCase() || '';
        return name.includes(q) || email.includes(q) || dept.includes(q);
      });
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }

    // 3. Progress Filter
    if (progressFilter !== 'all') {
      list = list.filter((l) => {
        const p = l.courseProgress !== undefined ? l.courseProgress : l.averageProgress || 0;
        if (progressFilter === '0-25') return p <= 25;
        if (progressFilter === '25-50') return p > 25 && p <= 50;
        if (progressFilter === '50-75') return p > 50 && p <= 75;
        if (progressFilter === '75-100') return p > 75;
        return true;
      });
    }

    // 4. Assessment Performance Filter
    if (assessmentFilter !== 'all') {
      list = list.filter((l) => {
        const score = l.averageScore;
        const failed = l.failedAttemptsCount > 0;
        if (assessmentFilter === 'passed') return score !== null && score >= 60;
        if (assessmentFilter === 'failed') return failed || (score !== null && score < 60);
        if (assessmentFilter === 'none') return score === null;
        return true;
      });
    }

    // 5. Sorting
    list.sort((a, b) => {
      const progA = a.courseProgress !== undefined ? a.courseProgress : a.averageProgress || 0;
      const progB = b.courseProgress !== undefined ? b.courseProgress : b.averageProgress || 0;
      const nameA = a.trainee?.name || '';
      const nameB = b.trainee?.name || '';
      const scoreA = a.averageScore || -1;
      const scoreB = b.averageScore || -1;
      const dateA = new Date(a.lastActivity || a.enrolledAt || 0).getTime();
      const dateB = new Date(b.lastActivity || b.enrolledAt || 0).getTime();

      switch (sortBy) {
        case 'progress_desc':
          return progB - progA;
        case 'progress_asc':
          return progA - progB;
        case 'name_asc':
          return nameA.localeCompare(nameB);
        case 'score_desc':
          return scoreB - scoreA;
        case 'activity_desc':
          return dateB - dateA;
        default:
          return 0;
      }
    });

    return list;
  }, [learners, searchTerm, statusFilter, progressFilter, assessmentFilter, sortBy]);

  // Helper for Status Badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'At Risk':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'In Progress':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Not Started':
      default:
        return 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  // Helper for Skill Level styling
  const getSkillBadge = (level) => {
    switch (level) {
      case 'Advanced':
        return 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Proficient':
        return 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'Beginner':
      default:
        return 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]';
    }
  };

  // Render a clean textual/graphical progress bar
  const renderProgressBar = (progress) => {
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2 bg-[var(--surface-muted)] rounded-full overflow-hidden border border-[var(--border)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              p === 100 ? 'bg-emerald-500' : p < 25 ? 'bg-amber-500' : 'bg-[var(--primary)]'
            }`}
            style={{ width: `${p}%` }}
          />
        </div>
        <span className="font-mono font-bold text-xs text-[var(--text-primary)] w-9 text-right">{p}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search learners by name, email, department..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] placeholder-[var(--text-muted)] transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="At Risk">At Risk ⚠️</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Progress Filter */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Progress:</span>
              <select
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Progress</option>
                <option value="0-25">0% - 25%</option>
                <option value="25-50">25% - 50%</option>
                <option value="50-75">50% - 75%</option>
                <option value="75-100">75% - 100%</option>
              </select>
            </div>

            {/* Assessment Filter */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Score:</span>
              <select
                value={assessmentFilter}
                onChange={(e) => setAssessmentFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                <option value="all">All Scores</option>
                <option value="passed">Passing (≥60%)</option>
                <option value="failed">Failing / At Risk (&lt;60%)</option>
                <option value="none">No Attempts Yet</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                <option value="progress_desc">Highest Progress</option>
                <option value="progress_asc">Lowest Progress</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="score_desc">Highest Score</option>
                <option value="activity_desc">Recent Activity</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg text-xs font-semibold flex items-center gap-1 border border-[var(--border)] transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Stats Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
          <span>
            Showing <strong>{processedLearners.length}</strong> of <strong>{learners.length}</strong> enrolled learners
          </span>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 text-[10px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {learners.filter((l) => l.status === 'Completed').length} Completed
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800 text-[10px]">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              {learners.filter((l) => l.status === 'At Risk').length} At Risk
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Table & Mobile Cards */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading course learner roster..." />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchLearners} />
      ) : processedLearners.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-3">
          <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">No matching learners found</h3>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try modifying or resetting your search filters to view enrolled learners.'
              : 'There are currently no learners enrolled in this course.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          {/* Desktop Table View */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Learner Name & Email</th>
                  <th className="py-3 px-4">Enrollment Date</th>
                  <th className="py-3 px-4">Course Progress</th>
                  <th className="py-3 px-4 text-center">Assessment Score</th>
                  <th className="py-3 px-4 text-center">Skill Level</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {processedLearners.map((item) => {
                  const t = item.trainee || {};
                  const progress = item.courseProgress !== undefined ? item.courseProgress : item.averageProgress || 0;
                  const enrolledDate = item.enrolledAt ? new Date(item.enrolledAt).toLocaleDateString() : 'N/A';
                  const lastAct = item.lastActivity ? new Date(item.lastActivity).toLocaleDateString() : 'N/A';

                  return (
                    <tr
                      key={t._id}
                      onClick={() => handleInspectLearner(item)}
                      className="hover:bg-[var(--surface-muted)]/60 transition-colors cursor-pointer group"
                    >
                      {/* Name & Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0 border border-[var(--primary-border,#BFDBFE)]">
                            {t.name
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2) || 'TL'}
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block group-hover:text-[var(--primary)] transition-colors">
                              {t.name}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-mono block">
                              {t.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Enrollment Date */}
                      <td className="py-3.5 px-4 text-[var(--text-secondary)] font-medium whitespace-nowrap">
                        {enrolledDate}
                      </td>

                      {/* Course Progress */}
                      <td className="py-3.5 px-4">
                        {renderProgressBar(progress)}
                      </td>

                      {/* Assessment Score */}
                      <td className="py-3.5 px-4 text-center">
                        {item.averageScore !== null && item.averageScore !== undefined ? (
                          <span
                            className={`font-bold font-mono text-xs px-2 py-0.5 rounded-md border ${
                              item.averageScore >= 60
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {item.averageScore}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-[11px]">--</span>
                        )}
                      </td>

                      {/* Current Skill Level */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getSkillBadge(
                            item.currentSkillLevel
                          )}`}
                        >
                          {item.currentSkillLevel || 'Beginner'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status || 'In Progress'}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-[var(--text-muted)] whitespace-nowrap">
                        {lastAct}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleInspectLearner(item)}
                          className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-[var(--border)]">
            {processedLearners.map((item) => {
              const t = item.trainee || {};
              const progress = item.courseProgress !== undefined ? item.courseProgress : item.averageProgress || 0;

              return (
                <div
                  key={t._id}
                  onClick={() => handleInspectLearner(item)}
                  className="p-4 space-y-3 hover:bg-[var(--surface-muted)]/60 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] text-sm">{t.name}</h4>
                      <p className="text-[var(--text-muted)] font-mono text-xs">{t.email}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Progress</span>
                    {renderProgressBar(progress)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">
                      Score: <strong className="text-[var(--text-primary)]">{item.averageScore !== null ? `${item.averageScore}%` : '--'}</strong>
                    </span>
                    <button
                      type="button"
                      className="text-[var(--primary)] font-semibold inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Slide-over Drawer for Detailed Learner Inspection */}
      <LearnerDetailsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        learner={selectedLearner}
        details={learnerDetails}
        loading={detailsLoading}
        courseId={courseId}
      />
    </div>
  );
};

export default CourseLearnersView;
