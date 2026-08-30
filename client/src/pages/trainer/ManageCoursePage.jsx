import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getCourseByIdApi,
  publishCourseApi,
  createModuleApi,
  updateModuleApi,
  deleteModuleApi,
  createResourceApi,
  deleteResourceApi,
  getModuleQuizApi,
  toggleAssessmentStatusApi,
  deleteAssessmentApi,
} from '../../services/api';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import Toast from '../../components/Toast';
import InlineCourseTitleEdit from '../../components/InlineCourseTitleEdit';
import EditCourseDetailsModal from '../../components/EditCourseDetailsModal';
import CourseLearnersView from '../../components/CourseLearnersView';
import CourseAssessmentsView from '../../components/CourseAssessmentsView';
import TrainerCourseAiInsightsModal from '../../components/TrainerCourseAiInsightsModal';
import ResourceViewer from '../../components/ResourceViewer';
import QuizBuilderModal from '../../components/QuizBuilderModal';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Globe,
  Lock,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Link2,
  Upload,
  ExternalLink,
  Layers,
  CheckCircle2,
  Video,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  Download,
  Play,
  Users,
  HelpCircle,
  FileCheck,
  Percent,
  Check,
  Tag,
  BarChart3,
  Bot,
  Sparkles,
  Award,
  Clock,
  Settings,
  GraduationCap,
  Shuffle,
  Eye,
  Power,
} from 'lucide-react';

const ManageCoursePage = () => {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [moduleQuizzes, setModuleQuizzes] = useState({}); // { [moduleId]: quizDoc }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Active Top Navigation Tab: 'overview' | 'content' | 'learners' | 'assessments' | 'analytics'
  const [activeTab, setActiveTab] = useState('overview');

  // Modals State
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Module Editor State
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleFormData, setModuleFormData] = useState({ title: '', description: '', order: 1 });
  const [savingModule, setSavingModule] = useState(false);
  const [moduleError, setModuleError] = useState(null);

  // Resource Upload Modal State
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState(null);
  const [resourceFormData, setResourceFormData] = useState({
    title: '',
    description: '',
    type: 'pdf',
    externalUrl: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceError, setResourceError] = useState(null);

  // Resource Preview Modal
  const [previewResource, setPreviewResource] = useState(null);

  // Module Quiz Builder Modal State
  const [quizModalConfig, setQuizModalConfig] = useState({
    isOpen: false,
    moduleId: null,
    moduleTitle: '',
    initialAssessment: null,
  });

  const fetchCourseData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCourseByIdApi(courseId);
      if (response && response.success) {
        setCourse(response.data.course);
        const moduleList = response.data.modules || [];
        setModules(moduleList);

        // Fetch Module Quizzes for each module
        const quizzesMap = {};
        if (moduleList.length > 0) {
          await Promise.all(
            moduleList.map(async (mod) => {
              try {
                const qRes = await getModuleQuizApi(mod._id);
                if (qRes && qRes.success && qRes.data?.quiz) {
                  quizzesMap[mod._id] = qRes.data.quiz;
                }
              } catch (e) {
                // No quiz for this module yet
              }
            })
          );
        }
        setModuleQuizzes(quizzesMap);
      } else {
        throw new Error(response?.message || 'Failed to fetch course data');
      }
    } catch (err) {
      console.error('Error loading course:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // Handler: Toggle Publish Status
  const handleTogglePublish = async () => {
    if (!course) return;
    try {
      const response = await publishCourseApi(course._id);
      if (response && response.success) {
        setCourse(response.data);
        setToast({
          type: 'success',
          message: `Course ${response.data.status === 'published' ? 'published to catalog' : 'reverted to draft'}.`,
        });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update publication status.',
      });
    }
  };

  // Handler: Save Module
  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleFormData.title.trim()) {
      setModuleError('Module title is required.');
      return;
    }

    setSavingModule(true);
    setModuleError(null);
    try {
      if (editingModule) {
        const response = await updateModuleApi(editingModule._id, moduleFormData);
        if (response && response.success) {
          setModules((prev) =>
            prev.map((m) => (m._id === editingModule._id ? response.data : m))
          );
          setToast({ type: 'success', message: 'Module updated successfully.' });
        }
      } else {
        const response = await createModuleApi(courseId, {
          ...moduleFormData,
          course: courseId,
          order: modules.length + 1,
        });
        if (response && response.success) {
          setModules((prev) => [...prev, response.data]);
          setToast({ type: 'success', message: 'New module added to curriculum.' });
        }
      }
      setShowModuleModal(false);
      setEditingModule(null);
    } catch (err) {
      setModuleError(err.response?.data?.message || err.message || 'Failed to save module.');
    } finally {
      setSavingModule(false);
    }
  };

  // Handler: Delete Module
  const handleDeleteModule = async (moduleId, moduleTitle) => {
    const confirm = window.confirm(`Delete module "${moduleTitle}" and all its lessons/quizzes?`);
    if (!confirm) return;

    try {
      const response = await deleteModuleApi(moduleId);
      if (response && response.success) {
        setModules((prev) => prev.filter((m) => m._id !== moduleId));
        setModuleQuizzes((prev) => {
          const updated = { ...prev };
          delete updated[moduleId];
          return updated;
        });
        setToast({ type: 'success', message: 'Module deleted.' });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete module.',
      });
    }
  };

  // Handler: Upload Resource
  const handleSaveResource = async (e) => {
    e.preventDefault();
    if (!resourceFormData.title.trim()) {
      setResourceError('Resource title is required.');
      return;
    }

    setUploadingResource(true);
    setResourceError(null);

    try {
      const formData = new FormData();
      formData.append('title', resourceFormData.title.trim());
      formData.append('description', resourceFormData.description.trim());
      formData.append('type', resourceFormData.type);

      if (resourceFormData.type === 'link') {
        if (!resourceFormData.externalUrl.trim()) {
          setResourceError('Please provide a valid external URL.');
          setUploadingResource(false);
          return;
        }
        formData.append('externalUrl', resourceFormData.externalUrl.trim());
      } else {
        if (!selectedFile) {
          setResourceError('Please select a file to upload.');
          setUploadingResource(false);
          return;
        }
        formData.append('file', selectedFile);
      }

      const response = await createResourceApi(targetModuleId, formData);
      if (response && response.success) {
        await fetchCourseData();
        setShowResourceModal(false);
        setResourceFormData({ title: '', description: '', type: 'pdf', externalUrl: '' });
        setSelectedFile(null);
        setToast({ type: 'success', message: 'Resource uploaded successfully.' });
      }
    } catch (err) {
      setResourceError(err.response?.data?.message || err.message || 'Failed to upload resource.');
    } finally {
      setUploadingResource(false);
    }
  };

  // Handler: Delete Resource
  const handleDeleteResource = async (moduleId, resourceId) => {
    const confirm = window.confirm('Are you sure you want to delete this resource?');
    if (!confirm) return;

    try {
      const response = await deleteResourceApi(moduleId, resourceId);
      if (response && response.success) {
        await fetchCourseData();
        setToast({ type: 'success', message: 'Resource removed.' });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete resource.',
      });
    }
  };

  // Handler: Toggle Module Quiz Status (Draft / Published)
  const handleToggleQuizStatus = async (quizId) => {
    try {
      const res = await toggleAssessmentStatusApi(quizId);
      if (res && res.success) {
        await fetchCourseData();
        setToast({
          type: 'success',
          message: `Module quiz status updated to "${res.data?.status}".`,
        });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update quiz status.',
      });
    }
  };

  // Handler: Delete Module Quiz
  const handleDeleteQuiz = async (quizId, quizTitle) => {
    const confirm = window.confirm(
      `Are you sure you want to delete quiz "${quizTitle}"? Trainee attempt history for this quiz will be removed.`
    );
    if (!confirm) return;

    try {
      const res = await deleteAssessmentApi(quizId);
      if (res && res.success) {
        await fetchCourseData();
        setToast({ type: 'success', message: 'Module quiz deleted.' });
      }
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete quiz.',
      });
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loading message="Loading course workspace and curriculum data..." />
      </div>
    );
  }

  if (error || !course) {
    return <ErrorMessage message={error || 'Course not found'} onRetry={fetchCourseData} />;
  }

  const isPublished = course.status === 'published';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* ====================================================
          1. TOP HEADER WORKSPACE CARD
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-xs space-y-4 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        {/* Navigation Breadcrumb & Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2 relative z-10">
          <Link
            to="/trainer/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Courses</span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase border ${
                isPublished
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {isPublished ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>{course.status}</span>
            </span>

            <span className="text-[var(--border)]">|</span>

            <span className="text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-muted)] px-2.5 py-0.5 rounded-md border border-[var(--border)]">
              {course.category}
            </span>

            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase bg-[var(--surface-muted)] px-2.5 py-0.5 rounded-md border border-[var(--border)]">
              {course.level}
            </span>
          </div>
        </div>

        {/* Title Row with Inline Editing */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 relative z-10">
          <div className="flex-1 min-w-0">
            <InlineCourseTitleEdit
              courseId={course._id}
              initialTitle={course.title}
              onTitleUpdated={(newTitle) => {
                setCourse((prev) => ({ ...prev, title: newTitle }));
              }}
              onNotify={(n) => setToast(n)}
            />
            {course.shortDescription ? (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{course.shortDescription}</p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] mt-1 italic">No headline set. Click "Edit Details" to configure metadata.</p>
            )}
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowEditDetailsModal(true)}
              className="px-3.5 py-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-muted)] rounded-lg shadow-2xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Edit Details</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePublish}
              className={`px-4 py-2 text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-1.5 transition-colors ${
                isPublished
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white'
              }`}
            >
              {isPublished ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
              <span>{isPublished ? 'Unpublish' : 'Publish Course'}</span>
            </button>

            <Link
              to={`/courses/${course._id}`}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
              title="View Public Catalog Preview"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Course Navigation Tabs Strip */}
        <div className="flex items-center gap-1.5 pt-4 border-t border-[var(--border)] overflow-x-auto text-xs relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Course Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'content'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Curriculum & Content ({modules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('learners')}
            className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'learners'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Learners</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assessments')}
            className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'assessments'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Course Assessments</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Diagnostics & Analytics</span>
          </button>
        </div>
      </div>

      {/* ====================================================
          TAB 1: COURSE OVERVIEW
          ==================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description Card */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Course Description & Syllabus
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditDetailsModal(true)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {course.description || 'No detailed description provided yet.'}
              </p>
            </div>

            {/* Learning Outcomes Card */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Learning Outcomes ({course.learningOutcomes?.length || 0})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditDetailsModal(true)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Manage Outcomes
                </button>
              </div>

              {!course.learningOutcomes || course.learningOutcomes.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">
                  No learning outcomes defined. Add measurable outcomes to improve trainee clarity.
                </p>
              ) : (
                <div className="space-y-2">
                  {course.learningOutcomes.map((outcome, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg flex items-start gap-2.5 text-xs text-[var(--text-primary)]"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-medium leading-relaxed">{outcome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mapped Skills & Competencies */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[var(--primary)]" />
                  <span>Targeted Platform Skills ({course.skills?.length || 0})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditDetailsModal(true)}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Map Skills
                </button>
              </div>

              {!course.skills || course.skills.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic">
                  No skills mapped yet. Mapping skills activates automated skill verification badges upon certificate completion.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {course.skills.map((s, idx) => {
                    const skillObj = s.skill || s;
                    const name = typeof skillObj === 'object' ? skillObj.name : 'Technical Skill';
                    const category = typeof skillObj === 'object' ? skillObj.category : 'General';
                    const proficiency = s.proficiency || course.level || 'beginner';

                    return (
                      <div
                        key={idx}
                        className="px-3 py-1.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg text-xs flex items-center gap-2"
                      >
                        <span className="font-bold text-[var(--text-primary)]">{name}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">({category})</span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                            proficiency === 'advanced'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                              : proficiency === 'proficient'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {proficiency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Course Specifications
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Duration:</span>
                  <span className="font-bold text-[var(--text-primary)]">{course.estimatedDuration || 'Self-Paced'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Language:</span>
                  <span className="font-bold text-[var(--text-primary)]">{course.language || 'English'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Passing Score:</span>
                  <span className="font-bold text-[var(--text-primary)]">{course.passingScore || 60}%</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Certificate:</span>
                  <span className="font-bold text-emerald-600">
                    {course.certificateEligibility !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Enrollment Acceptance:</span>
                  <span className="font-bold text-[var(--text-primary)] uppercase text-[11px]">
                    {course.enrollmentStatus || 'Open'}
                  </span>
                </div>

                <div className="pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="w-full py-2 bg-[var(--cc-accent-soft)] hover:bg-[var(--cc-accent-soft)]/80 text-[var(--cc-accent)] rounded-lg text-xs font-bold border border-[var(--cc-accent-border,#CCFBF1)] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>View AI Diagnostics & Analytics</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 2: CURRICULUM & CONTENT
          ==================================================== */}
      {activeTab === 'content' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Add Module Action Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
                Curriculum Modules ({modules.length})
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Organize learning units, attach reading materials, video lectures, code files, and module-specific quizzes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingModule(null);
                setModuleFormData({ title: '', description: '', order: modules.length + 1 });
                setShowModuleModal(true);
              }}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Module</span>
            </button>
          </div>

          {/* Module List */}
          {modules.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-3">
              <Layers className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <h4 className="font-bold text-[var(--text-primary)] text-sm">No curriculum modules added yet</h4>
              <p className="text-[var(--text-muted)] max-w-sm mx-auto">
                Create your first learning module to begin attaching lectures, resources, and quizzes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingModule(null);
                  setModuleFormData({ title: '', description: '', order: 1 });
                  setShowModuleModal(true);
                }}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-lg shadow-xs"
              >
                Create Module 1
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map((mod, idx) => {
                const quiz = moduleQuizzes[mod._id];

                return (
                  <div
                    key={mod._id}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors"
                  >
                    {/* Module Header Bar */}
                    <div className="p-4 bg-[var(--surface-muted)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold text-xs font-mono shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-[var(--text-primary)] text-sm">{mod.title}</h4>
                          {mod.description && (
                            <p className="text-xs text-[var(--text-muted)] line-clamp-1">{mod.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Header Module Action Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Add Resource */}
                        <button
                          type="button"
                          onClick={() => {
                            setTargetModuleId(mod._id);
                            setResourceFormData({ title: '', description: '', type: 'pdf', externalUrl: '' });
                            setSelectedFile(null);
                            setShowResourceModal(true);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Upload className="w-3 h-3 text-[var(--primary)]" />
                          <span>Add Resource</span>
                        </button>

                        {/* Add / Edit Quiz */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuizModalConfig({
                              isOpen: true,
                              moduleId: mod._id,
                              moduleTitle: mod.title,
                              initialAssessment: quiz || null,
                            });
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] border border-[var(--primary-border,#BFDBFE)] rounded-lg hover:bg-[var(--primary-soft)]/80 transition-colors inline-flex items-center gap-1 shadow-2xs"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>{quiz ? 'Manage Quiz' : 'Add Quiz'}</span>
                        </button>

                        {/* Edit Module */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingModule(mod);
                            setModuleFormData({
                              title: mod.title,
                              description: mod.description || '',
                              order: mod.order || idx + 1,
                            });
                            setShowModuleModal(true);
                          }}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
                          title="Edit Module Info"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Module */}
                        <button
                          type="button"
                          onClick={() => handleDeleteModule(mod._id, mod.title)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Module Content Body: Resources + Module Quiz */}
                    <div className="p-4 space-y-4">
                      {/* Sub-Section 1: Attached Resources */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            Learning Resources ({mod.resources?.length || 0})
                          </span>
                        </div>

                        {!mod.resources || mod.resources.length === 0 ? (
                          <div className="p-3 bg-[var(--surface-muted)]/50 border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)] flex items-center justify-between">
                            <span>No materials attached to this module yet.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetModuleId(mod._id);
                                setResourceFormData({ title: '', description: '', type: 'pdf', externalUrl: '' });
                                setSelectedFile(null);
                                setShowResourceModal(true);
                              }}
                              className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                            >
                              + Upload Resource
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {mod.resources.map((res) => (
                              <div
                                key={res._id}
                                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--primary-border,#BFDBFE)] transition-colors flex items-start justify-between gap-2 text-xs"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <div className="p-1.5 bg-[var(--surface)] rounded border border-[var(--border)] text-[var(--primary)] shrink-0 mt-0.5">
                                    {res.type === 'video' ? (
                                      <Video className="w-3.5 h-3.5" />
                                    ) : res.type === 'link' ? (
                                      <Link2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <FileText className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-[var(--text-primary)] block truncate">{res.title}</span>
                                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">{res.type}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(res)}
                                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
                                    title="Preview"
                                  >
                                    <Play className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteResource(mod._id, res._id)}
                                    className="p-1 text-[var(--text-muted)] hover:text-rose-600 rounded"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sub-Section 2: Module Knowledge Check Quiz */}
                      <div className="pt-3 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span>Module Knowledge Check Quiz</span>
                          </span>
                        </div>

                        {quiz ? (
                          <div className="p-3.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-[var(--text-primary)] text-xs">{quiz.title}</h5>
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                                    quiz.status === 'published'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  }`}
                                >
                                  {quiz.status === 'published' ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                  <span>{quiz.status}</span>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                                <span>{quiz.questions?.length || 0} Questions</span>
                                <span>&bull;</span>
                                <span>Passing: <strong className="text-[var(--text-primary)]">{quiz.passingPercentage || 50}%</strong></span>
                                <span>&bull;</span>
                                <span>Time: <strong className="text-[var(--text-primary)]">{quiz.timeLimit || 30} mins</strong></span>
                                <span>&bull;</span>
                                <span>Attempts: <strong className="text-[var(--text-primary)]">{quiz.allowedAttempts || 3}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleQuizStatus(quiz._id)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1 ${
                                  quiz.status === 'published'
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                }`}
                              >
                                <span>{quiz.status === 'published' ? 'Unpublish' : 'Publish'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setQuizModalConfig({
                                    isOpen: true,
                                    moduleId: mod._id,
                                    moduleTitle: mod.title,
                                    initialAssessment: quiz,
                                  });
                                }}
                                className="px-2.5 py-1 text-xs font-bold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit Quiz</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteQuiz(quiz._id, quiz.title)}
                                className="p-1 text-[var(--text-muted)] hover:text-rose-600 rounded transition-colors"
                                title="Delete Quiz"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-[var(--surface-muted)]/40 border border-dashed border-[var(--border)] rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[var(--text-muted)]">
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">No module quiz configured.</p>
                              <p className="text-[11px] text-[var(--text-muted)]">
                                Reinforce comprehension with a module-specific knowledge check quiz.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQuizModalConfig({
                                  isOpen: true,
                                  moduleId: mod._id,
                                  moduleTitle: mod.title,
                                  initialAssessment: null,
                                });
                              }}
                              className="px-3 py-1.5 bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Create Module Quiz</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TAB 3: LEARNERS MANAGEMENT
          ==================================================== */}
      {activeTab === 'learners' && (
        <div className="animate-fadeIn">
          <CourseLearnersView courseId={courseId} courseTitle={course.title} />
        </div>
      )}

      {/* ====================================================
          TAB 4: ASSESSMENTS WORKSPACE
          ==================================================== */}
      {activeTab === 'assessments' && (
        <div className="animate-fadeIn">
          <CourseAssessmentsView
            courseId={courseId}
            courseTitle={course.title}
            modules={modules}
            onNotify={(n) => setToast(n)}
          />
        </div>
      )}

      {/* ====================================================
          TAB 5: AI DIAGNOSTICS & ANALYTICS
          ==================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--cc-accent-soft)] text-[var(--cc-accent)] border border-[var(--cc-accent-border,#CCFBF1)] mb-1">
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI Teaching Diagnostics Engine</span>
                </div>
                <h3 className="font-bold text-[var(--text-primary)] text-base">
                  Curriculum AI Diagnostics & Teaching Insights
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Deep automated pedagogical intelligence evaluating question accuracy, curriculum drop-off points, and learner competency friction.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="px-5 py-2.5 bg-[var(--cc-accent)] hover:opacity-90 text-white rounded-lg text-xs font-bold shadow-xs transition-opacity flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Launch AI Diagnostic Inspector</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">Curriculum Completion Funnel</h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Track learners progressing across modules and identify where students require additional review resources or supplemental instruction.
              </p>
              <div className="pt-2">
                <Link
                  to="/trainer/analytics"
                  className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>View Global Training Analytics</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">Assessment Accuracy & Distractor Health</h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Continuous machine evaluation of question difficulty, discrimination indices, and distractor option quality across trainee attempts.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('assessments')}
                  className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>Manage Course Assessments</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          MODALS
          ==================================================== */}

      {/* 1. Edit Course Details Modal */}
      {showEditDetailsModal && (
        <EditCourseDetailsModal
          isOpen={showEditDetailsModal}
          onClose={() => setShowEditDetailsModal(false)}
          course={course}
          onCourseUpdated={(updated) => {
            setCourse(updated);
            setToast({ type: 'success', message: 'Course details updated successfully.' });
          }}
          onNotify={(n) => setToast(n)}
        />
      )}

      {/* 2. Course AI Insights Modal */}
      {showAiModal && (
        <TrainerCourseAiInsightsModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          courseId={courseId}
          courseTitle={course.title}
        />
      )}

      {/* 3. Add/Edit Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-md w-full p-6 border border-[var(--border)] space-y-4 animate-scale-up">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {editingModule ? 'Edit Module' : 'Add New Module'}
            </h3>

            {moduleError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800">
                {moduleError}
              </p>
            )}

            <form onSubmit={handleSaveModule} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  placeholder="e.g., Module 1: Introduction to State & Hooks"
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  placeholder="Summary of topics covered in this module..."
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingModule}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {savingModule ? 'Saving...' : 'Save Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Upload Resource Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-md w-full p-6 border border-[var(--border)] space-y-4 animate-scale-up">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Add Learning Resource</h3>

            {resourceError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800">
                {resourceError}
              </p>
            )}

            <form onSubmit={handleSaveResource} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">Resource Title</label>
                <input
                  type="text"
                  required
                  value={resourceFormData.title}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                  placeholder="e.g., Lecture Slides & Cheatsheet"
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">Resource Type</label>
                <select
                  value={resourceFormData.type}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                >
                  <option value="pdf">PDF Document</option>
                  <option value="video">Video Lecture</option>
                  <option value="link">External Web Link</option>
                  <option value="code">Code / Project Files</option>
                </select>
              </div>

              {resourceFormData.type === 'link' ? (
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">External URL</label>
                  <input
                    type="url"
                    required
                    value={resourceFormData.externalUrl}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, externalUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:outline-none text-[var(--text-primary)]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">File Attachment</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[var(--text-primary)] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[var(--surface-muted)] file:text-[var(--text-primary)] hover:file:bg-[var(--border)]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowResourceModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingResource}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {uploadingResource ? 'Uploading...' : 'Upload Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Module Quiz Builder Modal */}
      {quizModalConfig.isOpen && (
        <QuizBuilderModal
          isOpen={quizModalConfig.isOpen}
          onClose={() =>
            setQuizModalConfig({
              isOpen: false,
              moduleId: null,
              moduleTitle: '',
              initialAssessment: null,
            })
          }
          onSaved={async () => {
            await fetchCourseData();
            setToast({
              type: 'success',
              message: 'Module quiz saved successfully.',
            });
          }}
          type="module"
          moduleId={quizModalConfig.moduleId}
          moduleTitle={quizModalConfig.moduleTitle}
          courseId={courseId}
          courseTitle={course.title}
          modules={modules}
          initialAssessment={quizModalConfig.initialAssessment}
        />
      )}

      {/* 6. Resource Viewer Modal */}
      {previewResource && (
        <ResourceViewer
          isOpen={Boolean(previewResource)}
          onClose={() => setPreviewResource(null)}
          resource={previewResource}
        />
      )}

      {/* 7. Trainer Course AI Insights Modal */}
      {showAiModal && (
        <TrainerCourseAiInsightsModal
          isOpen={showAiModal}
          onClose={() => setShowAiModal(false)}
          courseId={courseId}
          courseTitle={course?.title || ''}
        />
      )}
    </div>
  );
};

export default ManageCoursePage;
