import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCoursesApi, getTrainerAnalyticsApi } from '../services/api';
import {
  BookOpen,
  Users,
  Award,
  BarChart3,
  BookPlus,
  ArrowRight,
  Sparkles,
  Layers,
  GraduationCap,
  TrendingUp,
  Tag,
  CheckCircle2,
} from 'lucide-react';

const TrainerDashboardPage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrainerData = async () => {
      try {
        const [coursesRes, analyticsRes] = await Promise.allSettled([
          getCoursesApi({ mine: 'true' }),
          getTrainerAnalyticsApi(),
        ]);

        if (coursesRes.status === 'fulfilled' && coursesRes.value?.success) {
          setCourses(coursesRes.value.data || []);
        }
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
          setAnalytics(analyticsRes.value.data || null);
        }
      } catch (err) {
        console.warn('Could not load trainer dashboard data:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadTrainerData();
  }, []);

  const totalEnrolledLearners =
    analytics?.summary?.totalEnrolledLearners ??
    courses.reduce((acc, curr) => acc + (curr.enrolledCount || 0), 0);

  const certificatesIssued = analytics?.summary?.certificatesIssuedCount ?? 0;
  const avgCompletionRate = analytics?.summary?.overallCompletionRate ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. DASHBOARD HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Trainer Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Welcome back, {user?.name || 'Instructor'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Department: <strong className="text-[var(--text-secondary)]">{user?.department || 'Instructional Faculty'}</strong>
              {user?.designation && (
                <> &bull; <span>{user.designation}</span></>
              )}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0 flex-wrap">
            <Link
              to="/trainer/analytics"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] rounded-lg text-xs font-semibold transition-colors shadow-2xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Teaching Insights</span>
            </Link>

            <Link
              to="/trainer/courses/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <BookPlus className="w-4 h-4" />
              <span>Create Course</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ====================================================
          2. KPI OVERVIEW CARDS (4-COLUMN GRID)
          ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Courses Authored */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Courses Authored
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {courses.length}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {courses.length > 0
                ? `${courses.filter((c) => c.status === 'published').length} published &bull; ${courses.filter((c) => c.status === 'draft').length} draft`
                : 'No courses authored yet'}
            </p>
          </div>
        </div>

        {/* Active Learners */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-teal-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Enrolled Learners
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {totalEnrolledLearners}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {totalEnrolledLearners > 0 ? 'Trainees across courses' : 'Awaiting learner enrollments'}
            </p>
          </div>
        </div>

        {/* Certificates Issued */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Certificates Issued
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {certificatesIssued}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {certificatesIssued > 0 ? 'Verified course credentials' : 'Issued upon final exam pass'}
            </p>
          </div>
        </div>

        {/* Cohort Completion Rate */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Avg Completion Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {avgCompletionRate}%
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {avgCompletionRate > 0 ? 'Learner milestone attainment' : 'Live progress tracking'}
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================
          3. RECENT COURSES QUICK ACCESS
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-xs space-y-5 transition-colors">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              My Authored Courses ({courses.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Review published curriculum, manage lesson modules, and inspect learner cohort analytics.
            </p>
          </div>
          <Link
            to="/trainer/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-xs text-[var(--text-muted)]">
            Loading your courses...
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">No courses created yet</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                Get started by structuring your first curriculum, adding learning modules, and publishing to the catalog.
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.slice(0, 4).map((c) => {
              const isDraft = c.status === 'draft';
              return (
                <div
                  key={c._id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-[var(--primary-border,#BFDBFE)] transition-all hover:shadow-md space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] uppercase tracking-wider">
                        <Tag className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{c.category || 'General'}</span>
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
                          {c.level || 'Beginner'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                      {c.title}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {c.description || 'No course overview description provided yet.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-[var(--text-muted)] text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <strong>{c.enrolledCount || 0}</strong> Learners
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <strong>{c.moduleCount || 0}</strong> Modules
                      </span>
                    </div>

                    <Link
                      to={`/trainer/courses/${c._id}/manage`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] rounded-md text-xs font-semibold transition-colors"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerDashboardPage;
