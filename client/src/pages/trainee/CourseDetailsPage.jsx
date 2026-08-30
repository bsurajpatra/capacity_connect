import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getCourseByIdApi,
  enrollCourseApi,
  getCourseReviewsApi,
  createCourseReviewApi,
  updateCourseReviewApi,
  deleteCourseReviewApi,
  getCourseDiscussionsApi,
  createCourseDiscussionMessageApi,
  toggleModuleCompleteApi,
  getModuleQuizApi,
  getFinalAssessmentApi,
  getCourseAiRationaleApi,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ResourceViewer from '../../components/ResourceViewer';
import QuizTakeModal from '../../components/QuizTakeModal';
import CertificateModal from '../../components/CertificateModal';
import AssessmentReviewModal from '../../components/AssessmentReviewModal';
import CourseAiDoubtChatbot from '../../components/CourseAiDoubtChatbot';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  Users,
  GraduationCap,
  CheckCircle2,
  FileText,
  Link2,
  ExternalLink,
  Download,
  Award,
  Video,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  Play,
  Star,
  Eye,
  MessageSquare,
  Send,
  Trash2,
  Edit2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  CheckSquare,
  Square,
  HelpCircle,
  FileCheck,
  RotateCcw,
  Tag
} from 'lucide-react';

const CourseDetailsPage = () => {
  const { id: courseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'reviews' | 'discussion'

  // Course & Enrollment State
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState(null);
  const [completedModules, setCompletedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Reviews State
  const [reviewsData, setReviewsData] = useState({
    reviews: [],
    totalReviews: 0,
    averageRating: 0,
    myReview: null,
  });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Discussions State
  const [discussions, setDiscussions] = useState([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [discussionError, setDiscussionError] = useState(null);

  // Resource previewer modal state
  const [previewResource, setPreviewResource] = useState(null);

  // Assessment & Certification State
  const [moduleQuizzes, setModuleQuizzes] = useState({}); // { [moduleId]: { quiz, latestAttempt } }
  const [finalAssessmentData, setFinalAssessmentData] = useState(null); // { assessment, latestAttempt, certificate }
  const [activeQuizModal, setActiveQuizModal] = useState({ isOpen: false, assessment: null });
  const [activeCertificateModal, setActiveCertificateModal] = useState({
    isOpen: false,
    certificate: null,
  });
  const [reviewAttemptId, setReviewAttemptId] = useState(null);

  // AI Recommendation Rationale State (Phase 7.3)
  const [courseRationale, setCourseRationale] = useState(null);
  const [loadingRationale, setLoadingRationale] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  const fetchCourseRationale = async () => {
    if (courseRationale) {
      setShowRationale(!showRationale);
      return;
    }
    setShowRationale(true);
    setLoadingRationale(true);
    try {
      const res = await getCourseAiRationaleApi(courseId);
      if (res?.success && res.data) {
        setCourseRationale(res.data);
      }
    } catch (err) {
      console.warn('Could not load course rationale:', err.message);
    } finally {
      setLoadingRationale(false);
    }
  };

  const isOwnerTrainer =
    user?.role === 'trainer' &&
    course?.trainer &&
    (course.trainer._id === user?._id || course.trainer === user?._id || course.trainer.id === user?._id);
  const isAdmin = user?.role === 'admin';
  const hasCommunityAccess = isEnrolled || isOwnerTrainer || isAdmin;

  // 1. Fetch Course Core Details
  const fetchCourseDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCourseByIdApi(courseId);
      if (response && response.success && response.data) {
        setCourse(response.data.course);
        const mods = response.data.modules || [];
        setModules(mods);
        setIsEnrolled(response.data.isEnrolled);
        setEnrollment(response.data.enrollment);
        if (response.data.enrollment?.completedModules) {
          setCompletedModules(
            response.data.enrollment.completedModules.map((m) =>
              typeof m === 'object' ? m._id : m
            )
          );
        }

        // Fetch Final Assessment (if enrolled or published)
        try {
          const finalRes = await getFinalAssessmentApi(courseId);
          if (finalRes && finalRes.success) {
            setFinalAssessmentData(finalRes.data || null);
          }
        } catch (e) {
          console.error('Final assessment load error:', e);
        }

        // Fetch Module Quizzes
        const quizMap = {};
        await Promise.all(
          mods.map(async (m) => {
            try {
              const qRes = await getModuleQuizApi(m._id);
              if (qRes && qRes.success && qRes.data) {
                quizMap[m._id] = qRes.data;
              }
            } catch (e) {}
          })
        );
        setModuleQuizzes(quizMap);
      } else {
        throw new Error(response?.message || 'Course details not found');
      }
    } catch (err) {
      console.error('Error fetching course details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  // 2. Fetch Reviews
  const fetchReviews = useCallback(async () => {
    setReviewLoading(true);
    try {
      const response = await getCourseReviewsApi(courseId);
      if (response && response.success) {
        setReviewsData(response.data);
        if (response.data.myReview) {
          setReviewRating(response.data.myReview.rating);
          setReviewComment(response.data.myReview.comment || '');
        }
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setReviewLoading(false);
    }
  }, [courseId]);

  // 3. Fetch Discussions
  const fetchDiscussions = useCallback(async () => {
    if (!hasCommunityAccess) return;
    setDiscussionLoading(true);
    try {
      const response = await getCourseDiscussionsApi(courseId);
      if (response && response.success) {
        setDiscussions(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching discussions:', err);
    } finally {
      setDiscussionLoading(false);
    }
  }, [courseId, hasCommunityAccess]);

  useEffect(() => {
    fetchCourseDetails();
    fetchReviews();
  }, [fetchCourseDetails, fetchReviews]);

  useEffect(() => {
    if (activeTab === 'discussion' && hasCommunityAccess) {
      fetchDiscussions();
    }
  }, [activeTab, hasCommunityAccess, fetchDiscussions]);

  // ====================================================
  // ENROLLMENT HANDLER
  // ====================================================
  const handleEnroll = async () => {
    setEnrollLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await enrollCourseApi(courseId);
      if (response && response.success) {
        setIsEnrolled(true);
        setEnrollment(response.data);
        setSuccessMessage('Congratulations! You are now enrolled in this course.');
        setCourse((prev) => ({ ...prev, enrolledCount: (prev.enrolledCount || 0) + 1 }));
        await fetchCourseDetails();
        await fetchReviews();
      } else {
        throw new Error(response?.message || 'Enrollment failed');
      }
    } catch (err) {
      console.error('Enroll error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to enroll in course.');
    } finally {
      setEnrollLoading(false);
    }
  };

  // ====================================================
  // REVIEWS HANDLERS
  // ====================================================
  const handleSaveReview = async (e) => {
    e.preventDefault();
    if (!user || user.role !== 'trainee' || !isEnrolled) return;

    setSubmittingReview(true);
    setReviewError(null);

    try {
      if (reviewsData.myReview) {
        // Update existing review
        await updateCourseReviewApi(reviewsData.myReview._id, {
          rating: reviewRating,
          comment: reviewComment.trim(),
        });
        setIsEditingReview(false);
      } else {
        // Create new review
        await createCourseReviewApi(courseId, {
          rating: reviewRating,
          comment: reviewComment.trim(),
        });
      }
      await fetchReviews();
    } catch (err) {
      setReviewError(err.response?.data?.message || err.message || 'Failed to save review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!reviewsData.myReview) return;
    const confirm = window.confirm('Are you sure you want to delete your review?');
    if (!confirm) return;

    setSubmittingReview(true);
    try {
      await deleteCourseReviewApi(reviewsData.myReview._id);
      setIsEditingReview(false);
      setReviewComment('');
      setReviewRating(5);
      await fetchReviews();
    } catch (err) {
      setReviewError(err.response?.data?.message || err.message || 'Failed to delete review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // ====================================================
  // DISCUSSIONS HANDLER
  // ====================================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    setDiscussionError(null);

    try {
      const response = await createCourseDiscussionMessageApi(courseId, {
        message: newMessage.trim(),
      });
      if (response && response.success) {
        setDiscussions((prev) => [...prev, response.data]);
        setNewMessage('');
      }
    } catch (err) {
      setDiscussionError(err.response?.data?.message || err.message || 'Failed to post message.');
    } finally {
      setSendingMessage(false);
    }
  };

  // ====================================================
  // MODULE COMPLETION TOGGLE HANDLER
  // ====================================================
  const handleToggleModuleCompletion = async (moduleId) => {
    if (!isEnrolled || user?.role !== 'trainee') return;

    try {
      const response = await toggleModuleCompleteApi(courseId, moduleId);
      if (response && response.success) {
        setCompletedModules(response.data.completedModules || []);
        setEnrollment((prev) => ({
          ...prev,
          progress: response.data.progress,
          status: response.data.status,
          completedModules: response.data.completedModules,
        }));
      }
    } catch (err) {
      console.error('Error toggling module completion:', err);
    }
  };

  const renderResourceIcon = (type) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-indigo-600 flex-shrink-0" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-600 flex-shrink-0" />;
      case 'text':
        return <FileCode className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'link':
        return <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0" />;
      default:
        return <FileSpreadsheet className="w-4 h-4 text-slate-600 flex-shrink-0" />;
    }
  };

  const renderStarRating = (rating) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loading message="Loading course syllabus..." />
      </div>
    );
  }

  if (!course) {
    return <ErrorMessage message="Course could not be loaded." onRetry={fetchCourseDetails} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <div className="flex items-center gap-2">
        <Link
          to="/trainee/courses"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs px-4 py-3 rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <Link
            to="/trainee/my-courses"
            className="font-bold underline text-emerald-900 ml-3 hover:text-emerald-950"
          >
            Go to My Courses
          </Link>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* Course Hero Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {course.category}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)]">
                {course.level}
              </span>
              {isEnrolled && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Enrolled</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              {course.title}
            </h1>

            {/* Rating Summary */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              {reviewsData.totalReviews > 0 ? (
                <>
                  <div className="flex items-center gap-1 text-amber-500 font-bold">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{reviewsData.averageRating}</span>
                  </div>
                  <span className="text-[var(--text-muted)]">&bull;</span>
                  <span className="text-[var(--text-secondary)] font-medium">
                    {reviewsData.totalReviews} {reviewsData.totalReviews === 1 ? 'review' : 'reviews'}
                  </span>
                </>
              ) : (
                <span className="text-[var(--text-muted)] italic">No reviews yet</span>
              )}
            </div>
          </div>

          {/* Action CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isEnrolled ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Progress: <strong className="text-[var(--primary)]">{enrollment?.progress || 0}%</strong>
                </span>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={handleEnroll}
                loading={enrollLoading}
                className="px-6 py-2.5 shadow-sm text-xs font-bold"
              >
                <span>Enroll in Course</span>
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line border-t border-[var(--border)] pt-4">
          {course.description}
        </p>

        {/* Prerequisites (if provided) */}
        {course.prerequisites && (
          <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg p-4 text-xs space-y-1">
            <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[10px] block">
              Prerequisites
            </span>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {course.prerequisites}
            </p>
          </div>
        )}

        {/* Skills Covered */}
        {course.skills && course.skills.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Skills Covered
            </span>
            <div className="flex flex-wrap gap-2">
              {course.skills.map((skill) => {
                const sName = skill.name || skill.skill?.name || skill;
                const sCat = skill.category || skill.skill?.category || 'Technical';
                const sProf = skill.proficiency || 'beginner';

                return (
                  <span
                    key={skill._id || skill.skill?._id || sName}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs ${
                      sCat === 'Soft Skill'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <Tag className="w-3 h-3 text-[var(--primary)] flex-shrink-0" />
                    <span>{sName}</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)]">
                      {sProf}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructor & Metadata strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Instructor</span>
              <strong className="text-[var(--text-primary)]">{course.trainer?.name || 'Instructor'}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Curriculum</span>
              <strong className="text-[var(--text-primary)]">{modules.length} Modules</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">Community</span>
              <strong className="text-[var(--text-primary)]">{course.enrolledCount || 0} Learners</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 pt-2 rounded-t-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('curriculum')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'curriculum'
              ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)] rounded-t'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Curriculum ({modules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'reviews'
              ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)] rounded-t'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Reviews ({reviewsData.totalReviews})</span>
        </button>

        {hasCommunityAccess && (
          <button
            type="button"
            onClick={() => setActiveTab('discussion')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'discussion'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)] rounded-t'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discussion</span>
          </button>
        )}
      </div>

      {/* ====================================================
          TAB 1: CURRICULUM & MODULES
          ==================================================== */}
      {activeTab === 'curriculum' && (
        <div className="space-y-4">
          {modules.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center text-xs text-[var(--text-muted)] shadow-xs">
              No modules have been published for this course yet.
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((mod, idx) => {
                const isModuleCompleted = completedModules.includes(mod._id);

                return (
                  <div
                    key={mod._id}
                    className={`bg-[var(--surface)] border rounded-xl p-5 shadow-xs space-y-3 transition-all ${
                      isModuleCompleted ? 'border-emerald-300 dark:border-emerald-800 bg-[var(--surface)]' : 'border-[var(--border)]'
                    }`}
                  >
                    {/* Module Heading */}
                    <div className="flex items-start justify-between gap-3 pb-2 border-b border-[var(--border)]">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
                            Module {idx + 1}
                          </span>
                          {isEnrolled && isModuleCompleted && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Completed</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[var(--text-primary)]">{mod.title}</h3>
                        {mod.description && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{mod.description}</p>
                        )}
                      </div>

                      {/* Module Completion Toggle Button */}
                      {isEnrolled && user?.role === 'trainee' && (
                        <button
                          type="button"
                          onClick={() => handleToggleModuleCompletion(mod._id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-all flex-shrink-0 ${
                            isModuleCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                          title={isModuleCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                        >
                          {isModuleCompleted ? (
                            <CheckSquare className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{isModuleCompleted ? 'Completed' : 'Mark Complete'}</span>
                        </button>
                      )}
                    </div>

                  {/* Module Resources — Shown ONLY after enrollment */}
                  {isEnrolled && (
                    mod.resources && mod.resources.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {mod.resources.map((resItem) => {
                          const isLink = resItem.type === 'link';
                          const backendOrigin = import.meta.env.VITE_API_URL
                            ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
                            : 'http://localhost:5002';
                          const fileUrl = resItem.filePath
                            ? `${backendOrigin}/uploads/resources/${resItem.filePath.replace(/\\/g, '/').split('/').pop()}`
                            : '';

                          return (
                            <div
                              key={resItem._id}
                              className="bg-slate-50 border border-slate-200 rounded p-3 flex items-center justify-between gap-3 text-xs hover:border-slate-300 transition-colors"
                            >
                              <div
                                onClick={() => setPreviewResource(resItem)}
                                className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                              >
                                {renderResourceIcon(resItem.type)}
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 group-hover:text-emerald-700 truncate transition-colors">
                                    {resItem.title}
                                  </p>
                                  <p className="text-[10px] text-slate-400 uppercase font-mono">
                                    {resItem.type}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isLink ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(resItem)}
                                    className="px-2.5 py-1 bg-white border border-slate-200 text-blue-600 hover:text-blue-800 rounded font-medium inline-flex items-center gap-1 hover:bg-slate-50 text-[11px]"
                                  >
                                    <span>Open Link</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : resItem.type === 'video' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(resItem)}
                                    className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded font-medium inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <span>Watch</span>
                                    <Play className="w-3 h-3" />
                                  </button>
                                ) : resItem.type === 'image' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(resItem)}
                                    className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded font-medium inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <span>View</span>
                                    <ImageIcon className="w-3 h-3" />
                                  </button>
                                ) : resItem.type === 'pdf' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(resItem)}
                                    className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded font-medium inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <span>Open PDF</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                ) : resItem.type === 'text' ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewResource(resItem)}
                                    className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded font-medium inline-flex items-center gap-1 text-[11px]"
                                  >
                                    <span>Read</span>
                                    <FileCode className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <a
                                    href={fileUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 bg-white border border-slate-200 text-emerald-700 hover:text-emerald-900 rounded font-medium inline-flex items-center gap-1 hover:bg-slate-50 text-[11px]"
                                  >
                                    <span>Download</span>
                                    <Download className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No resources attached to this module yet.</p>
                    )
                  )}

                {/* Module Quiz Card for Enrolled Trainees */}
                {isEnrolled && moduleQuizzes[mod._id]?.quiz && (
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {moduleQuizzes[mod._id].quiz.title}
                          </span>
                          {moduleQuizzes[mod._id].latestAttempt && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Score: {moduleQuizzes[mod._id].latestAttempt.score}/
                              {moduleQuizzes[mod._id].latestAttempt.totalMarks} (
                              {moduleQuizzes[mod._id].latestAttempt.percentage}%)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {moduleQuizzes[mod._id].quiz.questions?.length || 0} Questions •{' '}
                          {moduleQuizzes[mod._id].quiz.questions?.reduce(
                            (sum, q) => sum + (q.marks || 1),
                            0
                          ) || 0}{' '}
                          Marks • Pass: {moduleQuizzes[mod._id].quiz.passingPercentage || 50}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {moduleQuizzes[mod._id].latestAttempt?._id && (
                        <button
                          type="button"
                          onClick={() => setReviewAttemptId(moduleQuizzes[mod._id].latestAttempt._id)}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>Review</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewResource(null);
                          setActiveQuizModal({
                            isOpen: true,
                            assessment: moduleQuizzes[mod._id].quiz,
                          });
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        {moduleQuizzes[mod._id].latestAttempt ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retake Quiz</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Start Quiz</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                  </div>
                );
              })}
            </div>
          )}

        {/* Final Course Assessment Section for Enrolled Trainees */}
        {isEnrolled && finalAssessmentData?.assessment && (
          <div className="bg-white border-2 border-indigo-100 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700">
                      Final Course Assessment
                    </span>
                    {finalAssessmentData.isLocked ? (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Locked</span>
                      </span>
                    ) : finalAssessmentData.certificate ? (
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                        <Award className="w-3 h-3 text-emerald-600" />
                        <span>Certified</span>
                      </span>
                    ) : finalAssessmentData.latestAttempt ? (
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                          finalAssessmentData.latestAttempt.passed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {finalAssessmentData.latestAttempt.percentage}% •{' '}
                        {finalAssessmentData.latestAttempt.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {finalAssessmentData.assessment?.title || 'Final Course Assessment'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Passing requirement: {finalAssessmentData.assessment?.passingPercentage || 60}% •{' '}
                    {finalAssessmentData.assessment?.questions?.length || 0} Questions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {finalAssessmentData.isLocked ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled
                    className="px-5 text-xs font-bold opacity-60 cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked</span>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {finalAssessmentData.latestAttempt?._id && (
                      <button
                        type="button"
                        onClick={() => setReviewAttemptId(finalAssessmentData.latestAttempt._id)}
                        className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                        <span>Review Attempt</span>
                      </button>
                    )}

                    {finalAssessmentData.certificate ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveCertificateModal({
                            isOpen: true,
                            certificate: finalAssessmentData.certificate,
                          })
                        }
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Award className="w-4 h-4" />
                        <span>View Certificate</span>
                      </button>
                    ) : (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => {
                          setPreviewResource(null);
                          setActiveQuizModal({
                            isOpen: true,
                            assessment: finalAssessmentData.assessment,
                          });
                        }}
                        className="px-5 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        {finalAssessmentData.latestAttempt ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retake Final Assessment</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Start Final Assessment</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Gating Locked Prompt */}
            {finalAssessmentData.isLocked && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Complete all required course modules before attempting the final assessment.
                </span>
              </div>
            )}

            {/* Certificate Banner */}
            {finalAssessmentData.certificate && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    You have earned the Certificate of Completion! Identifier:{' '}
                    <strong className="font-mono font-bold">
                      {finalAssessmentData.certificate.certificateId}
                    </strong>
                  </span>
                </div>
                <a
                  href={`http://localhost:5002/${finalAssessmentData.certificate.filePath}`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-emerald-800 hover:underline inline-flex items-center gap-1 flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>
              </div>
            )}
          </div>
        )}

          {/* Enrollment Callout Banner for Non-Enrolled Trainees */}
          {!isEnrolled && modules.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center space-y-3 mt-6">
              <p className="text-xs sm:text-sm font-medium text-emerald-900 max-w-lg mx-auto leading-relaxed">
                Enroll in this course to unlock all video lectures, study guides, reading materials, and curriculum resources.
              </p>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={enrollLoading}
                disabled={enrollLoading}
                onClick={handleEnroll}
                className="inline-flex items-center gap-1.5 px-6 text-xs font-semibold"
              >
                <span>Enroll Now</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TAB 2: REVIEWS & RATINGS
          ==================================================== */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Learner Reviews & Feedback</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ratings and authentic feedback submitted by enrolled learners.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto bg-slate-50 px-4 py-2.5 rounded border border-slate-200">
              <div className="text-center">
                <span className="text-2xl font-bold text-slate-900 block leading-none">
                  {reviewsData.averageRating > 0 ? reviewsData.averageRating : '—'}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5 block">out of 5</span>
              </div>
              <div className="border-l border-slate-200 pl-3 space-y-0.5">
                {renderStarRating(Math.round(reviewsData.averageRating))}
                <span className="text-[11px] text-slate-500 block">
                  {reviewsData.totalReviews} {reviewsData.totalReviews === 1 ? 'review' : 'reviews'}
                </span>
              </div>
            </div>
          </div>

          {/* Write / Edit Review Card (For Enrolled Trainees) */}
          {isEnrolled && user?.role === 'trainee' && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900">
                  {reviewsData.myReview && !isEditingReview
                    ? 'Your Review'
                    : reviewsData.myReview
                    ? 'Edit Your Review'
                    : 'Write a Review'}
                </h4>
                {reviewsData.myReview && !isEditingReview && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingReview(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Review</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteReview}
                      disabled={submittingReview}
                      className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {reviewError && <ErrorMessage message={reviewError} />}

              {reviewsData.myReview && !isEditingReview ? (
                /* Display My Existing Review */
                <div className="bg-slate-50 rounded p-4 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    {renderStarRating(reviewsData.myReview.rating)}
                    <span className="text-[10px] text-slate-400">
                      {new Date(reviewsData.myReview.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed italic">
                    &quot;{reviewsData.myReview.comment || 'No written comment provided.'}&quot;
                  </p>
                </div>
              ) : (
                /* Form for Write / Edit Review */
                <form onSubmit={handleSaveReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your Rating <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 text-amber-400 hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-semibold text-slate-700 ml-2">
                        {reviewRating} of 5 Stars
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Review <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your feedback about course curriculum, pacing, and learning materials..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {isEditingReview && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingReview(false);
                          setReviewRating(reviewsData.myReview.rating);
                          setReviewComment(reviewsData.myReview.comment || '');
                        }}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded"
                      >
                        Cancel
                      </button>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      loading={submittingReview}
                      disabled={submittingReview}
                    >
                      {reviewsData.myReview ? 'Update Review' : 'Publish Review'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* List of All Reviews */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Community Reviews ({reviewsData.totalReviews})
            </h4>

            {reviewLoading ? (
              <div className="py-8 flex justify-center">
                <Loading message="Loading reviews..." />
              </div>
            ) : reviewsData.reviews.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-400 shadow-sm">
                No reviews yet. Be the first to review this course!
              </div>
            ) : (
              <div className="space-y-3">
                {reviewsData.reviews.map((rev) => (
                  <div
                    key={rev._id}
                    className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                          {rev.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-slate-900">{rev.user?.name || 'Anonymous'}</p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rev.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      {renderStarRating(rev.rating)}
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-slate-700 leading-relaxed pl-9">
                        &quot;{rev.comment}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 3: DISCUSSION & GROUP CHAT
          ==================================================== */}
      {activeTab === 'discussion' && hasCommunityAccess && (
        <div className="space-y-4">
          {/* Group Chat Container */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col h-[550px] overflow-hidden">
              {/* Discussion Header */}
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Course Community Discussion
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {discussions.length} Messages
                </span>
              </div>

              {/* Messages Stream */}
              <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/40">
                {discussionLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loading message="Loading discussion..." />
                  </div>
                ) : discussions.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-600">No discussion messages yet.</p>
                    <p>Start the conversation with your instructor and classmates!</p>
                  </div>
                ) : (
                  discussions.map((msg) => {
                    const isMe = msg.sender?._id === user?._id;
                    const isTrainerMsg = msg.sender?.role === 'trainer';
                    const isAdminMsg = msg.sender?.role === 'admin';

                    const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={msg._id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-bold text-slate-800">
                            {msg.sender?.name || 'User'}
                          </span>
                          {isTrainerMsg && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                              Trainer
                            </span>
                          )}
                          {isAdminMsg && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              Admin
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">{formattedTime}</span>
                        </div>

                        <div
                          className={`max-w-md rounded-lg px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-slate-900 text-white rounded-tr-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input Box */}
              <div className="p-3 bg-white border-t border-slate-200">
                {discussionError && (
                  <p className="text-[11px] text-red-600 mb-2">{discussionError}</p>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    maxLength={1000}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message to the class..."
                    className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={sendingMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="px-4 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
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

      {/* Quiz / Assessment Taking Modal */}
      {activeQuizModal.isOpen && (
        <QuizTakeModal
          isOpen={activeQuizModal.isOpen}
          onClose={() => setActiveQuizModal({ isOpen: false, assessment: null })}
          assessment={activeQuizModal.assessment}
          courseTitle={course?.title || ''}
          onCompleted={(result) => {
            setActiveQuizModal({ isOpen: false, assessment: null });
            setPreviewResource(null);
            fetchCourseDetails();
            if (result?.attempt) {
              setSuccessMessage(
                result.certificate
                  ? `🎉 Congratulations! Final Course Assessment passed (${result.attempt.percentage}%). Certificate generated!`
                  : `✓ Quiz submitted successfully (${result.attempt.percentage}%)! Module progress recorded.`
              );
            }
          }}
        />
      )}

      {/* Certificate Viewer Modal */}
      {activeCertificateModal.isOpen && (
        <CertificateModal
          isOpen={activeCertificateModal.isOpen}
          onClose={() =>
            setActiveCertificateModal({ isOpen: false, certificate: null })
          }
          certificate={activeCertificateModal.certificate}
        />
      )}

      {/* Assessment Question-by-Question Review Modal */}
      {reviewAttemptId && (
        <AssessmentReviewModal
          isOpen={Boolean(reviewAttemptId)}
          attemptId={reviewAttemptId}
          onClose={() => setReviewAttemptId(null)}
        />
      )}

      {/* In-Course Contextual AI Doubts Chatbot (Visible after enrollment) */}
      {course && (isEnrolled || user?.role === 'trainer' || user?.role === 'admin') && (
        <CourseAiDoubtChatbot course={course} modules={modules} />
      )}
    </div>
  );
};

export default CourseDetailsPage;
