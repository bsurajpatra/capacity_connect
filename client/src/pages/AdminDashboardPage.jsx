import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCoursesApi, getAdminAnalyticsApi } from '../services/api';
import {
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  Award,
  Sparkles,
  Layers,
  Tag,
  CheckCircle2,
} from 'lucide-react';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const [coursesRes, analyticsRes] = await Promise.allSettled([
          getCoursesApi({ mine: 'all' }),
          getAdminAnalyticsApi(),
        ]);

        if (coursesRes.status === 'fulfilled' && coursesRes.value?.success) {
          setCourses(coursesRes.value.data || []);
        }
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
          setAnalytics(analyticsRes.value.data || null);
        }
      } catch (err) {
        console.warn('Could not load courses on admin dashboard:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadAdminData();
  }, []);

  const totalUsers = analytics?.summary?.totalUsers ?? (analytics?.userDistribution ? (analytics.userDistribution.trainees + analytics.userDistribution.trainers + analytics.userDistribution.admins) : 1);
  const totalTrainees = analytics?.userDistribution?.trainees ?? 0;
  const totalTrainers = analytics?.userDistribution?.trainers ?? 0;
  const totalCertificates = analytics?.summary?.totalCertificates ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. DASHBOARD HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Executive Governance Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Welcome back, {user?.name || 'Administrator'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Department: <strong className="text-[var(--text-secondary)]">{user?.department || 'Executive Governance'}</strong>
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 self-start sm:self-auto shrink-0 flex-wrap">
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] rounded-lg text-xs font-semibold transition-colors shadow-2xs"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Platform Analytics</span>
            </Link>

            <Link
              to="/admin/courses"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              <BookOpen className="w-4 h-4" />
              <span>Manage Courses</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ====================================================
          2. KPI OVERVIEW CARDS (4-COLUMN GRID)
          ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Platform Users
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {totalUsers}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Registered platform accounts
            </p>
          </div>
        </div>

        {/* Trainees */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-teal-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Active Trainees
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {totalTrainees}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Enrolled cohort learners
            </p>
          </div>
        </div>

        {/* Trainers */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-indigo-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Faculty Trainers
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {totalTrainers}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Instructional curriculum leads
            </p>
          </div>
        </div>

        {/* Courses */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Total Courses
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-[var(--text-primary)] leading-none">
              {courses.length}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Platform catalog learning paths
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================
          3. COURSES GOVERNANCE QUICK ACCESS
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-xs space-y-5 transition-colors">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Platform Curriculum Governance ({courses.length})
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Review published course tracks, inspect trainer ownership, and audit platform delivery.
            </p>
          </div>
          <Link
            to="/admin/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
          >
            <span>View All Courses</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center text-xs text-[var(--text-muted)]">
            Loading platform course data...
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-10 text-center text-xs text-[var(--text-muted)]">
            No courses have been created on the platform yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)] text-xs">
            {courses.slice(0, 5).map((c) => {
              const isDraft = c.status === 'draft';
              return (
                <div key={c._id} className="py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-muted)]/50 px-2 rounded-lg transition-colors">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold text-[var(--text-primary)] truncate">{c.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Trainer: <strong className="text-[var(--text-secondary)]">{c.trainer?.name || 'Assigned Instructor'}</strong> &bull; {c.category} &bull; {c.level}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        isDraft
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {c.status}
                    </span>
                    <span className="text-[var(--text-muted)] font-medium">{c.enrolledCount || 0} Enrolled</span>
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

export default AdminDashboardPage;
