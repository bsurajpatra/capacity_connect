import React, { useState, useEffect, useCallback } from 'react';
import {
  getCoursesApi,
  getCourseByIdApi,
  publishCourseApi,
  deleteCourseApi
} from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import ResourceViewer from '../../components/ResourceViewer';
import {
  BookOpen,
  Search,
  Filter,
  Users,
  Layers,
  Globe,
  Lock,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Video,
  Image as ImageIcon,
  Link2,
  FileCode,
  FileSpreadsheet,
  Download,
  GraduationCap
} from 'lucide-react';

const AdminCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Inspector Modal State
  const [inspectCourseId, setInspectCourseId] = useState(null);
  const [inspectCourseData, setInspectCourseData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [expandedModuleId, setExpandedModuleId] = useState(null);

  // Resource Viewer state
  const [previewResource, setPreviewResource] = useState(null);

  const fetchAdminCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCoursesApi({ mine: 'all' });
      if (response && response.success) {
        setCourses(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch platform courses');
      }
    } catch (err) {
      console.error('Error fetching admin courses:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminCourses();
  }, [fetchAdminCourses]);

  const handleOpenInspector = async (courseId) => {
    setInspectCourseId(courseId);
    setInspectLoading(true);
    setInspectCourseData(null);
    setExpandedModuleId(null);

    try {
      const response = await getCourseByIdApi(courseId);
      if (response && response.success && response.data) {
        setInspectCourseData(response.data);
        if (response.data.modules && response.data.modules.length > 0) {
          setExpandedModuleId(response.data.modules[0]._id);
        }
      }
    } catch (err) {
      console.error('Error loading course inspection:', err);
      setError('Could not load course details for inspection.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handlePublishToggle = async (course) => {
    setActionLoadingId(course._id);
    setFeedback(null);
    setError(null);

    const nextStatus = course.status === 'published' ? 'draft' : 'published';

    try {
      const response = await publishCourseApi(course._id, nextStatus);
      if (response && response.success) {
        setFeedback(`Course "${course.title}" status updated to ${nextStatus}.`);
        setCourses((prev) =>
          prev.map((c) => (c._id === course._id ? { ...c, status: nextStatus } : c))
        );
        if (inspectCourseData && inspectCourseData.course._id === course._id) {
          setInspectCourseData((prev) => ({
            ...prev,
            course: { ...prev.course, status: nextStatus },
          }));
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to toggle publish status. Ensure course has at least one module.'
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteCourse = async (course) => {
    const confirm = window.confirm(
      `[ADMIN ACTION] Are you sure you want to permanently delete "${course.title}"? This removes all associated modules, resources, and enrollments.`
    );
    if (!confirm) return;

    setActionLoadingId(course._id);
    try {
      await deleteCourseApi(course._id);
      setFeedback(`Course "${course.title}" deleted.`);
      setCourses((prev) => prev.filter((c) => c._id !== course._id));
      if (inspectCourseId === course._id) {
        setInspectCourseId(null);
        setInspectCourseData(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete course.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      c.category.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (c.trainer?.name && c.trainer.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    const matchesStatus = statusFilter === '' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getResourceIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'code':
        return <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Curriculum Moderation & Publishing Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Platform Course Administration
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
            Audit structured modules, inspect attached digital assets, moderate publication statuses, and oversee platform-wide learning offerings.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ====================================================
          2. FILTER TOOLBAR
          ==================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)] p-3.5 border border-[var(--border)] rounded-xl shadow-xs transition-colors">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search platform courses or instructors..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          {[
            { label: 'All Courses', value: '' },
            { label: 'Published', value: 'published' },
            { label: 'Drafts', value: 'draft' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================
          3. COURSES TABLE
          ==================================================== */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading platform course offerings..." />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
          <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="font-bold text-sm text-[var(--text-primary)]">No courses found matching your criteria.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Course Title</th>
                  <th className="py-3.5 px-4">Category & Level</th>
                  <th className="py-3.5 px-4">Instructor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Enrolled</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {filteredCourses.map((course) => {
                  const isActionLoading = actionLoadingId === course._id;
                  const isDraft = course.status === 'draft';

                  return (
                    <tr key={course._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)] max-w-xs">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="truncate">{course.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] mr-1.5">
                          {course.category}
                        </span>
                        <span className="text-[var(--text-muted)] capitalize">{course.level}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        {course.trainer?.name || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                            isDraft
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {isDraft ? (
                            <>
                              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Draft</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Published</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>{course.enrolledCount || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenInspector(course._id)}
                          className="px-2.5 py-1 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] hover:bg-[var(--primary-soft)]/80 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                          title="Inspect Curriculum & Content"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePublishToggle(course)}
                          disabled={isActionLoading}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1 ${
                            isDraft
                              ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                          }`}
                        >
                          <span>{isDraft ? 'Publish' : 'Unpublish'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course)}
                          disabled={isActionLoading}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          title="Delete Course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================
          4. COURSE STRUCTURE & CURRICULUM INSPECTOR MODAL
          ==================================================== */}
      {inspectCourseId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-[var(--border)] overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Course Structure & Curriculum Inspector
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectCourseId(null)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {inspectLoading ? (
                <div className="py-16 flex justify-center">
                  <Loading message="Inspecting course hierarchy..." />
                </div>
              ) : !inspectCourseData ? (
                <ErrorMessage message="Course details could not be loaded." />
              ) : (
                <>
                  {/* Course Metadata Card */}
                  <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {inspectCourseData.course.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                              inspectCourseData.course.status === 'draft'
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {inspectCourseData.course.status}
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                          {inspectCourseData.course.title}
                        </h2>
                      </div>

                      <div className="text-xs text-[var(--text-muted)]">
                        <span>Level: <strong className="capitalize text-[var(--text-primary)]">{inspectCourseData.course.level}</strong></span> &bull;{' '}
                        <span>Enrolled: <strong className="text-[var(--text-primary)]">{inspectCourseData.course.enrolledCount || 0}</strong></span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] pt-2">
                      {inspectCourseData.course.description}
                    </p>

                    {inspectCourseData.course.prerequisites && (
                      <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2.5">
                        <span className="font-semibold text-[var(--text-primary)] block text-[10px] uppercase">Prerequisites:</span>
                        {inspectCourseData.course.prerequisites}
                      </div>
                    )}

                    {/* Skills Covered */}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <span className="font-semibold text-[var(--text-primary)] block text-[10px] uppercase mb-1">
                        Skills Covered ({inspectCourseData.course.skills?.length || 0}):
                      </span>
                      {inspectCourseData.course.skills && inspectCourseData.course.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {inspectCourseData.course.skills.map((s) => {
                            const sName = s.name || s.skill?.name || s;
                            const sCat = s.category || s.skill?.category || 'Technical';
                            const sProf = s.proficiency || 'beginner';

                            return (
                              <span
                                key={s._id || s.skill?._id || sName}
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                  sCat === 'Soft Skill'
                                    ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                    : 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border,#BFDBFE)]'
                                }`}
                              >
                                <span>{sName}</span>
                                <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)]">
                                  {sProf}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] italic text-[11px]">No skills mapped</span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--text-muted)] pt-1 flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span>
                        Trainer: <strong className="text-[var(--text-primary)]">{inspectCourseData.course.trainer?.name}</strong> ({inspectCourseData.course.trainer?.email})
                      </span>
                    </div>
                  </div>

                  {/* Modules & Resources Hierarchy */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Modules & Attached Learning Content ({inspectCourseData.modules?.length || 0})
                      </h4>
                    </div>

                    {!inspectCourseData.modules || inspectCourseData.modules.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] italic py-4">No modules found in this course.</p>
                    ) : (
                      <div className="space-y-3">
                        {inspectCourseData.modules.map((mod, idx) => {
                          const isExpanded = expandedModuleId === mod._id;

                          return (
                            <div
                              key={mod._id}
                              className="border border-[var(--border)] rounded-xl overflow-hidden"
                            >
                              {/* Module Bar */}
                              <div
                                onClick={() => setExpandedModuleId(isExpanded ? null : mod._id)}
                                className="px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-muted)] cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <div>
                                  <span className="text-[10px] font-mono font-bold text-[var(--primary)] block uppercase">
                                    Module {idx + 1} (Order: {mod.order})
                                  </span>
                                  <h5 className="text-sm font-bold text-[var(--text-primary)]">{mod.title}</h5>
                                  {mod.description && (
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{mod.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-md">
                                    {mod.resources?.length || 0} Resources
                                  </span>
                                  <button
                                    type="button"
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Resources */}
                              {isExpanded && (
                                <div className="p-4 bg-[var(--surface-muted)] border-t border-[var(--border)] space-y-2">
                                  {!mod.resources || mod.resources.length === 0 ? (
                                    <p className="text-xs text-[var(--text-muted)] italic">No resources attached to this module.</p>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {mod.resources.map((res) => {
                                        return (
                                          <div
                                            key={res._id}
                                            className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-between text-xs"
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <div className="p-1.5 rounded-md bg-[var(--surface-muted)] border border-[var(--border)]">
                                                {getResourceIcon(res.type)}
                                              </div>
                                              <div>
                                                <span className="font-semibold text-[var(--text-primary)] block">
                                                  {res.title}
                                                </span>
                                                <span className="text-[10px] text-[var(--text-muted)] capitalize">
                                                  Type: {res.type}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => setPreviewResource(res)}
                                                className="px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 rounded-md border border-[var(--primary-border,#BFDBFE)] transition-colors"
                                              >
                                                Preview Resource
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resource Viewer Modal */}
      {previewResource && (
        <ResourceViewer
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </div>
  );
};

export default AdminCoursesPage;
