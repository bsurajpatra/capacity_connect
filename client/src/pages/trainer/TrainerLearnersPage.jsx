import React, { useState, useEffect, useCallback } from 'react';
import { getTrainerLearnersApi, getTrainerLearnerDetailsApi } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import {
  Users,
  Search,
  BookOpen,
  Award,
  FileCheck,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Calendar,
  Layers,
  GraduationCap,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const TrainerLearnersPage = () => {
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Learner Details Modal
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [learnerDetails, setLearnerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchLearners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrainerLearnersApi();
      if (response && response.success) {
        setLearners(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch learners');
      }
    } catch (err) {
      console.error('Error fetching trainer learners:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load your enrolled learners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  const handleOpenDetails = async (traineeId) => {
    setDetailsLoading(true);
    setSelectedLearner(null);
    setLearnerDetails(null);
    try {
      const response = await getTrainerLearnerDetailsApi(traineeId);
      if (response && response.success) {
        setSelectedLearner(response.data.learner);
        setLearnerDetails(response.data);
      }
    } catch (err) {
      console.error('Error loading learner details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredLearners = learners.filter((l) => {
    const t = l.trainee;
    if (!t) return false;
    const matches =
      t.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (t.department && t.department.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    return matches;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <Users className="w-3.5 h-3.5" />
            <span>Cohort Roster & Performance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Learner Management
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
            Track trainees across your authored curriculum, inspect module progress milestones, audit quiz attempts, and review earned certificates.
          </p>
        </div>
      </div>

      {/* ====================================================
          2. SEARCH & COUNT TOOLBAR
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search learners by name, email, department..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          Total Learners: <strong className="text-[var(--text-primary)]">{filteredLearners.length}</strong>
        </span>
      </div>

      {/* ====================================================
          3. LEARNERS TABLE / ROSTER
          ==================================================== */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading enrolled learners..." />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchLearners} />
      ) : filteredLearners.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-3">
          <Users className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="font-bold text-sm text-[var(--text-primary)]">No learners enrolled in your courses yet</p>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto">
            Publish courses to the platform catalog to attract and enroll trainees.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Learner</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4 text-center">Courses Enrolled</th>
                  <th className="py-3.5 px-4 text-center">Avg Progress</th>
                  <th className="py-3.5 px-4 text-center">Completed</th>
                  <th className="py-3.5 px-4 text-center">Certificates</th>
                  <th className="py-3.5 px-4">Last Activity</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {filteredLearners.map((l) => (
                  <tr key={l.trainee._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                          {l.trainee.name?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <span className="block font-bold text-[var(--text-primary)]">{l.trainee.name}</span>
                          <span className="text-[11px] text-[var(--text-muted)] block font-normal">{l.trainee.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{l.trainee.department || 'Software Engineering'}</td>
                    <td className="py-3 px-4 text-center font-bold text-[var(--primary)]">{l.coursesEnrolledCount}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--primary)] rounded-full transition-all"
                            style={{ width: `${l.averageProgress}%` }}
                          />
                        </div>
                        <span className="font-semibold text-[11px] text-[var(--text-primary)]">{l.averageProgress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">{l.coursesCompletedCount}</td>
                    <td className="py-3 px-4 text-center">
                      {l.certificatesEarnedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>{l.certificatesEarnedCount}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-[10px]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)]">
                      {new Date(l.lastActivity).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(l.trainee._id)}
                        className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ====================================================
          LEARNER DETAILS MODAL
          ==================================================== */}
      {(selectedLearner || detailsLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[var(--border)] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Learner Progress & Assessment Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLearner(null);
                  setLearnerDetails(null);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {detailsLoading ? (
                <div className="py-12 flex justify-center">
                  <Loading message="Loading learner details..." />
                </div>
              ) : selectedLearner && learnerDetails ? (
                <>
                  {/* Learner Profile Card */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{selectedLearner.name}</h4>
                      <p className="text-[var(--text-muted)] font-mono text-[11px]">{selectedLearner.email}</p>
                      <span className="text-[var(--text-secondary)] text-[10px] mt-1 block">
                        Department: <strong>{selectedLearner.department || 'General'}</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border,#BFDBFE)] font-bold text-[10px]">
                          {learnerDetails.summary?.trainerCoursesEnrolled} Courses Enrolled
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px]">
                          {learnerDetails.summary?.trainerCoursesCompleted} Completed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Course Breakdowns */}
                  <div className="space-y-4">
                    <h5 className="font-bold text-[var(--text-primary)] uppercase text-[11px] tracking-wider">
                      Progress in Your Courses ({learnerDetails.courses?.length || 0})
                    </h5>

                    {learnerDetails.courses?.map((c) => (
                      <div key={c.courseId} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block text-sm">{c.courseTitle}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {c.completedModulesCount} / {c.totalModulesCount} Modules Completed
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-emerald-600 text-sm">{c.progress}%</span>
                            <span className="text-[10px] text-[var(--text-muted)] block uppercase">{c.status}</span>
                          </div>
                        </div>

                        {/* Quiz & Assessment Performance */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">
                            Assessments & Quizzes ({c.attempts?.length || 0})
                          </span>

                          {c.attempts?.length === 0 ? (
                            <p className="text-[var(--text-muted)] italic text-[11px]">No assessments attempted for this course yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {c.attempts.map((att) => (
                                <div
                                  key={att.attemptId}
                                  className="p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-between text-[11px]"
                                >
                                  <div>
                                    <span className="font-semibold text-[var(--text-primary)]">{att.assessmentTitle}</span>
                                    <span className="text-[10px] text-[var(--text-muted)] block">
                                      {att.type === 'final' ? 'Final Exam' : 'Module Quiz'} &bull; Score: {att.score}/{att.totalMarks} ({att.percentage}%)
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                      att.passed
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                        : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                                    }`}
                                  >
                                    {att.passed ? 'Passed' : 'Failed'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Certificate */}
                        {c.certificate && (
                          <div className="p-3 bg-[var(--primary-soft)] border border-[var(--primary-border,#BFDBFE)] rounded-lg flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-[var(--primary)]" />
                              <div>
                                <span className="font-bold text-[var(--text-primary)] block">Certificate Earned ({c.certificate.percentage}%)</span>
                                <span className="font-mono text-[10px] text-[var(--primary)]">{c.certificate.certificateId}</span>
                              </div>
                            </div>
                            <span className="text-[var(--text-muted)] text-[10px]">
                              {new Date(c.certificate.issueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedLearner(null);
                  setLearnerDetails(null);
                }}
                className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerLearnersPage;
