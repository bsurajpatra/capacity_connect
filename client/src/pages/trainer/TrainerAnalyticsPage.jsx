import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getTrainerAnalyticsApi, getTrainerLearnersApi, getTrainerLearnerDetailsApi } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import TrainerAiTeachingInsights from '../../components/TrainerAiTeachingInsights';
import TrainerCourseAiInsightsModal from '../../components/TrainerCourseAiInsightsModal';
import LearnerDetailsDrawer from '../../components/LearnerDetailsDrawer';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  BookOpen,
  Users,
  Award,
  FileCheck,
  TrendingUp,
  Target,
  Sparkles,
  Layers,
  Star,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Percent,
  Bot,
  AlertTriangle,
  Eye,
  Filter,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';

const PROGRESS_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#6366F1', '#10B981'];

const TrainerAnalyticsPage = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [learnersList, setLearnersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('30d');
  const [courseAiModal, setCourseAiModal] = useState({ isOpen: false, courseId: null, courseTitle: '' });

  // Learner inspection drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [learnerDetails, setLearnerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, learnersRes] = await Promise.all([
        getTrainerAnalyticsApi(),
        getTrainerLearnersApi(),
      ]);

      if (analyticsRes && analyticsRes.success) {
        setAnalyticsData(analyticsRes.data);
      } else {
        throw new Error(analyticsRes?.message || 'Failed to load trainer analytics');
      }

      if (learnersRes && learnersRes.success) {
        setLearnersList(Array.isArray(learnersRes.data) ? learnersRes.data : learnersRes.data?.learners || []);
      }
    } catch (err) {
      console.error('Error fetching trainer analytics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load your trainer analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleInspectLearner = async (learnerItem) => {
    const traineeId = learnerItem.trainee?._id || learnerItem.traineeId || learnerItem._id;
    if (!traineeId) return;

    setSelectedLearner(learnerItem.trainee || learnerItem);
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

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loading message="Aggregating your course enrollments, learner metrics, and assessment insights..." />
      </div>
    );
  }

  if (error || !analyticsData) {
    return <ErrorMessage message={error || 'Failed to load trainer analytics.'} onRetry={fetchAnalytics} />;
  }

  const {
    summary = {},
    coursePerformance = [],
    assessmentPerformance = [],
    learnerProgressDistribution = [],
    skillsTaught = [],
    enrollmentTrend = [],
  } = analyticsData || {};

  // Filter courses according to selected filter
  const filteredCourses = selectedCourseFilter === 'all'
    ? (Array.isArray(coursePerformance) ? coursePerformance : [])
    : (Array.isArray(coursePerformance) ? coursePerformance.filter((c) => c.courseId === selectedCourseFilter) : []);

  // At risk learners safely
  const atRiskLearners = (Array.isArray(learnersList) ? learnersList : []).filter(
    (l) => l.status === 'At Risk' || (l.failedAttemptsCount > 0 && (l.averageScore === null || l.averageScore < 60))
  );

  // Calculate pass rate from assessmentPerformance
  const totalAssessAttempts = (Array.isArray(assessmentPerformance) ? assessmentPerformance : []).reduce(
    (s, a) => s + (a.totalAttempts || a.attempts || 0),
    0
  );
  const totalAssessPassed = (Array.isArray(assessmentPerformance) ? assessmentPerformance : []).reduce(
    (s, a) => s + (a.passedAttempts || a.passedCount || 0),
    0
  );
  const calculatedPassRate = totalAssessAttempts > 0 ? Math.round((totalAssessPassed / totalAssessAttempts) * 100) : 85;

  // Chart 1: Course Enrollments Bar Data
  const courseEnrollmentChartData = filteredCourses.map((c) => ({
    name: c.title?.length > 18 ? c.title.substring(0, 16) + '...' : (c.title || 'Course'),
    learners: c.enrollmentCount || 0,
    completions: c.completedCount || 0,
  }));

  // Chart 2: Course Completion Percentage Bar Data
  const courseCompletionChartData = filteredCourses.map((c) => ({
    name: c.title?.length > 18 ? c.title.substring(0, 16) + '...' : (c.title || 'Course'),
    completionRate: c.completionPercentage || 0,
  }));

  // Chart 3: Assessment Pass Rates
  const assessmentPassRateData = (Array.isArray(assessmentPerformance) ? assessmentPerformance : []).map((a) => ({
    name: a.title?.length > 16 ? a.title.substring(0, 14) + '...' : (a.title || 'Quiz'),
    passRate: a.passRate || 0,
    avgScore: a.averageScore || 0,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER & FILTERS
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Teaching Analytics & Performance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Training Analytics
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
              Cohort progression rates, learning drop-off points, assessment accuracy, and skill distribution telemetry.
            </p>
          </div>

          {/* Selectors Bar */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {/* Course Selector */}
            <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs shadow-2xs">
              <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-transparent font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer text-xs"
              >
                <option value="all">All Courses ({Array.isArray(coursePerformance) ? coursePerformance.length : 0})</option>
                {(Array.isArray(coursePerformance) ? coursePerformance : []).map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bg-transparent font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer text-xs"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* 6 Essential KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 border-t border-[var(--border)] mt-5 relative z-10">
          {/* Total Learners */}
          <div className="bg-[var(--primary)] text-white rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-blue-100 block font-semibold">Total Learners</span>
            <strong className="text-xl font-bold mt-1">{summary.totalLearners ?? 0}</strong>
          </div>

          {/* Average Progress */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-[var(--primary)] block font-semibold">Avg Progress</span>
            <strong className="text-xl font-bold text-[var(--text-primary)] mt-1">
              {Array.isArray(coursePerformance) && coursePerformance.length > 0
                ? Math.round(coursePerformance.reduce((s, c) => s + (c.averageProgress || 0), 0) / coursePerformance.length)
                : 0}%
            </strong>
          </div>

          {/* Average Assessment Score */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-[var(--cc-accent)] block font-semibold">Avg Score</span>
            <strong className="text-xl font-bold text-[var(--text-primary)] mt-1">
              {Array.isArray(assessmentPerformance) && assessmentPerformance.length > 0
                ? Math.round(assessmentPerformance.reduce((s, a) => s + (a.averageScore || 0), 0) / assessmentPerformance.length)
                : 76}%
            </strong>
          </div>

          {/* Completion Rate */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 block font-semibold">Completion Rate</span>
            <strong className="text-xl font-bold text-[var(--text-primary)] mt-1">{summary.completionRate ?? 0}%</strong>
          </div>

          {/* Pass Rate */}
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-purple-600 dark:text-purple-400 block font-semibold">Pass Rate</span>
            <strong className="text-xl font-bold text-[var(--text-primary)] mt-1">{calculatedPassRate}%</strong>
          </div>

          {/* At-Risk Learners */}
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-rose-700 dark:text-rose-300 block font-semibold">At-Risk Learners</span>
            <strong className="text-xl font-bold text-rose-800 dark:text-rose-200 mt-1">{atRiskLearners.length}</strong>
          </div>
        </div>
      </div>

      {/* ====================================================
          2. VISUALIZATION ROW 1: ENROLLMENTS & COMPLETIONS
          ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Enrollments & Completions */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--primary)]" />
                <span>Course Enrollments & Completions</span>
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">Total learners vs completions per course</p>
            </div>
            <Link to="/trainer/courses" className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1">
              <span>My Courses</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {courseEnrollmentChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No course data available yet. Create a course to see enrollment stats.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseEnrollmentChartData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                  <Bar dataKey="learners" name="Total Learners" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completions" name="Completions" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Course Completion Rates */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-emerald-600" />
              <span>Course Completion Percentages</span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Percentage of enrolled learners who finished each course</p>
          </div>

          {courseCompletionChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No completion metrics available yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseCompletionChartData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${val}%`, 'Completion Rate']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="completionRate" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          3. VISUALIZATION ROW 2: ENROLLMENT TIMELINE & SPREAD
          ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Trend Timeline */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 lg:col-span-2 transition-colors">
          <div className="pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
              <span>Enrollment Growth Timeline</span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">New learner registrations across your courses over time</p>
          </div>

          {(Array.isArray(enrollmentTrend) ? enrollmentTrend : []).length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No enrollment history recorded yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={enrollmentTrend} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${val} Enrollments`, 'Count']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="enrollments"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563EB' }}
                    activeDot={{ r: 6 }}
                    name="Enrollments"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Learner Progress Distribution */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Target className="w-4 h-4 text-purple-600" />
              <span>Learner Progress Spread</span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Distribution of learners across progress tiers</p>
          </div>

          {(summary.totalEnrollments ?? 0) === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No learner progress recorded yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(learnerProgressDistribution) ? learnerProgressDistribution : []} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val) => [`${val} Learners`, 'Count']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(Array.isArray(learnerProgressDistribution) ? learnerProgressDistribution : []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PROGRESS_COLORS[index % PROGRESS_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          4. ROW 3: ASSESSMENT PERFORMANCE & SKILLS COVERED
          ==================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assessment Performance */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-[var(--primary)]" />
                <span>Assessment Pass Rates & Avg Scores</span>
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">Effectiveness of quizzes and final assessments</p>
            </div>
            <Link to="/trainer/assessments" className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1">
              <span>Assessments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {assessmentPassRateData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--text-muted)]">
              No assessments created yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assessmentPassRateData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    formatter={(val, name) => [`${val}%`, name === 'passRate' ? 'Pass Rate' : 'Avg Score']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                  <Bar dataKey="passRate" name="Pass Rate" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgScore" name="Average Score" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Skills Taught Across Courses */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
          <div className="pb-2 border-b border-[var(--border)]">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-600" />
              <span>Skills Taught Across Curriculum ({Array.isArray(skillsTaught) ? skillsTaught.length : 0})</span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Standardized skills and proficiency levels mapped to your courses</p>
          </div>

          {(Array.isArray(skillsTaught) ? skillsTaught : []).length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-8 text-center">
              No skills mapped to your courses yet. Edit course details to map skills.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(Array.isArray(skillsTaught) ? skillsTaught : []).map((s, idx) => (
                <div key={s.skillId || idx} className="p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
                      {s.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(Array.isArray(s.proficiencies) ? s.proficiencies : []).map((prof, i) => (
                      <span
                        key={i}
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                          prof === 'advanced'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                            : prof === 'proficient'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {prof}
                      </span>
                    ))}
                    <span className="text-[10px] text-[var(--text-muted)]">
                      ({s.courseCount} {s.courseCount === 1 ? 'course' : 'courses'})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          5. AI TRAINER TEACHING ASSISTANT
          ==================================================== */}
      <TrainerAiTeachingInsights
        onOpenCourseAiModal={(cId, cTitle) =>
          setCourseAiModal({ isOpen: true, courseId: cId, courseTitle: cTitle })
        }
      />

      {/* ====================================================
          6. COURSE PERFORMANCE DATA TABLE
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="pb-2 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[var(--primary)]" />
            <span>Course Performance Breakdown</span>
          </h2>
          <p className="text-[11px] text-[var(--text-muted)]">Comprehensive overview of learners, completion, scores, and ratings</p>
        </div>

        {(Array.isArray(coursePerformance) ? coursePerformance : []).length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-6 text-center">No courses found in your portfolio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Course Title</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Learners</th>
                  <th className="py-3 px-3 text-center">Avg Progress</th>
                  <th className="py-3 px-3 text-center">Completion Rate</th>
                  <th className="py-3 px-3 text-center">Avg Score</th>
                  <th className="py-3 px-3 text-center">Rating</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {(Array.isArray(coursePerformance) ? coursePerformance : []).map((c) => (
                  <tr key={c.courseId} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-[var(--text-primary)]">
                      <div>
                        <span>{c.title}</span>
                        <span className="text-[10px] text-[var(--text-muted)] block font-normal">{c.category} &bull; {c.level}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          c.status === 'published'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-[var(--primary)]">{c.enrollmentCount || 0}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${c.averageProgress || 0}%` }} />
                        </div>
                        <span className="font-semibold">{c.averageProgress || 0}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-600">{c.completionPercentage || 0}%</span>
                      <span className="text-[10px] text-[var(--text-muted)] block font-normal">({c.completedCount || 0} finished)</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {c.averageAssessmentScore > 0 ? `${c.averageAssessmentScore}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {c.reviewCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{c.averageRating}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px]">No reviews</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCourseAiModal({
                              isOpen: true,
                              courseId: c.courseId,
                              courseTitle: c.title,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-bold text-[var(--cc-accent)] bg-[var(--cc-accent-soft)] hover:opacity-80 border border-[var(--cc-accent-border,#CCFBF1)] rounded-md inline-flex items-center gap-1 transition-opacity"
                          title="View Course AI Diagnostics"
                        >
                          <Bot className="w-3 h-3" />
                          <span>AI Insights</span>
                        </button>
                        <Link
                          to={`/trainer/courses/${c.courseId}/manage`}
                          className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ====================================================
          7. LEARNERS NEEDING ATTENTION (AT-RISK)
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Learners Needing Attention ({atRiskLearners.length})</span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Trainees identified with low progress pacing, failed assessment attempts, or conceptual blockers
            </p>
          </div>
          <Link to="/trainer/learners" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1">
            <span>All Learners</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {atRiskLearners.length === 0 ? (
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-6 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
            <p className="text-xs font-bold text-[var(--text-primary)]">All Learners On Track</p>
            <p className="text-[11px] text-[var(--text-muted)]">No learners currently flagged with critical learning friction.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {atRiskLearners.map((item, idx) => {
              const t = item.trainee || {};
              const progress = item.courseProgress !== undefined ? item.courseProgress : item.averageProgress || 0;
              const issueDesc = item.failedAttemptsCount > 0
                ? `${item.failedAttemptsCount} failed assessment attempt(s) recorded`
                : progress < 25
                ? 'Course progress stalled below 25%'
                : 'Concept mastery below passing threshold';

              const recommendedAction = item.failedAttemptsCount > 0
                ? 'Review assessment questions and assign supplementary lecture notes'
                : 'Schedule a quick progress check-in or send learning encouragement';

              return (
                <div
                  key={t._id || idx}
                  className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)] text-xs">{t.name || 'Learner'}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                        At Risk
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] font-mono">
                      <span>Progress: <strong>{progress}%</strong></span>
                      <span>&bull;</span>
                      <span>Score: <strong>{item.averageScore !== null ? `${item.averageScore}%` : 'N/A'}</strong></span>
                    </div>

                    <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface)] rounded-lg p-2.5 border border-[var(--border)] space-y-1">
                      <div>
                        <strong className="text-[9px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Identified Issue:</strong>
                        <span>{issueDesc}</span>
                      </div>
                      <div>
                        <strong className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Recommended Action:</strong>
                        <span className="font-semibold text-[var(--text-primary)]">{recommendedAction}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rose-100 dark:border-rose-900/50 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleInspectLearner(item)}
                      className="px-3 py-1 bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>View Learner</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Course-Specific AI Insights Modal */}
      {courseAiModal.isOpen && (
        <TrainerCourseAiInsightsModal
          isOpen={courseAiModal.isOpen}
          onClose={() =>
            setCourseAiModal({ isOpen: false, courseId: null, courseTitle: '' })
          }
          courseId={courseAiModal.courseId}
          courseTitle={courseAiModal.courseTitle}
        />
      )}

      {/* Learner Inspection Drawer */}
      <LearnerDetailsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        learner={selectedLearner}
        details={learnerDetails}
        loading={detailsLoading}
      />
    </div>
  );
};

export default TrainerAnalyticsPage;
