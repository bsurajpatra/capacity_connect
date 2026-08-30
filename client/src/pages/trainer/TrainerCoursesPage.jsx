import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getCoursesApi, deleteCourseApi, publishCourseApi } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import LearnersModal from '../../components/LearnersModal';
import {
  BookPlus,
  BookOpen,
  Layers,
  Users,
  Search,
  Settings,
  Trash2,
  Globe,
  Lock,
  Filter,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';

const TrainerCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [viewLearnersCourseId, setViewLearnersCourseId] = useState(null);

  const fetchTrainerCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCoursesApi({ mine: 'true' });
      if (response && response.success) {
        setCourses(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch courses');
      }
    } catch (err) {
      console.error('Error fetching trainer courses:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainerCourses();
  }, [fetchTrainerCourses]);

  const handlePublishToggle = async (course) => {
    setActionLoadingId(course._id);
    setFeedback(null);
    setError(null);

    const nextStatus = course.status === 'published' ? 'draft' : 'published';

    try {
      const response = await publishCourseApi(course._id, nextStatus);
      if (response && response.success) {
        setFeedback(response.message || `Course is now ${nextStatus}.`);
        setCourses((prev) =>
          prev.map((c) => (c._id === course._id ? { ...c, status: nextStatus } : c))
        );
      } else {
        throw new Error(response?.message || 'Status update failed');
      }
    } catch (err) {
      console.error('Publish error:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Could not update course status. Note: Courses must contain at least one module before publishing.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteCourse = async (course) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${course.title}"? This will permanently delete all its modules, resources, and enrollments.`
    );
    if (!confirmDelete) return;

    setActionLoadingId(course._id);
    setFeedback(null);
    setError(null);

    try {
      const response = await deleteCourseApi(course._id);
      if (response && response.success) {
        setFeedback('Course and associated content deleted.');
        setCourses((prev) => prev.filter((c) => c._id !== course._id));
      } else {
        throw new Error(response?.message || 'Failed to delete course');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to delete course.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter in-memory for instant feedback
  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      !searchTerm.trim() ||
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || course.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Curriculum Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              My Courses ({courses.length})
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Manage your authored curriculum paths, structure modules, upload learning media, and control publishing status.
            </p>
          </div>

          <Link
            to="/trainer/courses/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs self-start sm:self-auto shrink-0"
          >
            <BookPlus className="w-4 h-4" />
            <span>Create Course</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={fetchTrainerCourses} />}

      {/* ====================================================
          2. SEARCH & FILTER TOOLBAR
          ==================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] p-3.5 border border-[var(--border)] rounded-xl shadow-xs transition-colors">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your courses by title or category..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--text-primary)] transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* ====================================================
          3. COURSES GRID OR EMPTY STATE
          ==================================================== */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loading message="Loading your courses..." />
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">No courses authored yet</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
              Get started by creating your first course, structuring modules, and uploading learning resources.
            </p>
          </div>
          <Link
            to="/trainer/courses/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <BookPlus className="w-4 h-4" />
            <span>Create Your First Course</span>
          </Link>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-10 text-center text-[var(--text-muted)] text-xs shadow-xs">
          No courses match your filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCourses.map((course) => {
            const isDraft = course.status === 'draft';
            const isBusy = actionLoadingId === course._id;

            return (
              <div
                key={course._id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-[var(--primary-border,#BFDBFE)] transition-all hover:shadow-md space-y-4 group"
              >
                <div className="space-y-2">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] uppercase tracking-wider">
                      <Tag className="w-3 h-3 text-[var(--text-muted)]" />
                      <span>{course.category}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          isDraft
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {isDraft ? 'Draft' : 'Published'}
                      </span>
                      <span className="text-[10px] font-medium capitalize px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)] border border-[var(--border)]">
                        {course.level}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                    {course.description || 'No course overview description available.'}
                  </p>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border)]">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span><strong>{course.moduleCount || 0}</strong> Modules</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span><strong>{course.enrolledCount || 0}</strong> Enrolled</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/trainer/courses/${course._id}/manage`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Manage Content</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setViewLearnersCourseId(course._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)]/80 text-[var(--text-secondary)] border border-[var(--border)] rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Learners</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handlePublishToggle(course)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1 ${
                        isDraft
                          ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100'
                          : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface-muted)] hover:bg-[var(--border)]'
                      }`}
                      title={isDraft ? 'Publish Course to Catalog' : 'Move back to Draft'}
                    >
                      {isDraft ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{isDraft ? 'Publish' : 'Unpublish'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDeleteCourse(course)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Delete Course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enrolled Learners Modal */}
      {viewLearnersCourseId && (
        <LearnersModal
          courseId={viewLearnersCourseId}
          onClose={() => setViewLearnersCourseId(null)}
        />
      )}
    </div>
  );
};

export default TrainerCoursesPage;
