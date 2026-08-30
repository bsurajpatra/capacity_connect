import React, { useState, useEffect, useCallback } from 'react';
import { getTrainersApi, getTrainerByIdApi, toggleUserStatusApi } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import {
  UserCheck,
  Search,
  BookOpen,
  Users,
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  Power,
  X,
  AlertTriangle,
} from 'lucide-react';

const AdminTrainersPage = () => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Trainer Details Modal & Safe Inline Deactivation State
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [trainerDetails, setTrainerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrainersApi();
      if (response && response.success) {
        setTrainers(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch trainers');
      }
    } catch (err) {
      console.error('Error fetching trainers:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load platform trainers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const handleOpenDetails = async (trainerId) => {
    setDetailsLoading(true);
    setSelectedTrainer(null);
    setTrainerDetails(null);
    setConfirmingDeactivate(false);
    try {
      const response = await getTrainerByIdApi(trainerId);
      if (response && response.success) {
        setSelectedTrainer(response.data.trainer);
        setTrainerDetails(response.data);
      }
    } catch (err) {
      console.error('Error loading trainer details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExecuteStatusToggle = async (trainerObj) => {
    setActionLoading(true);
    try {
      const response = await toggleUserStatusApi(trainerObj._id, !trainerObj.isActive);
      if (response && response.success) {
        setTrainers((prev) =>
          prev.map((t) => (t._id === trainerObj._id ? { ...t, isActive: !t.isActive } : t))
        );
        if (selectedTrainer && selectedTrainer._id === trainerObj._id) {
          setSelectedTrainer((prev) => ({ ...prev, isActive: !prev.isActive }));
        }
        setConfirmingDeactivate(false);
      }
    } catch (err) {
      console.error('Error toggling trainer status:', err);
      alert(err.response?.data?.message || 'Failed to update trainer status.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTrainers = trainers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (t.department && t.department.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-teal-700 dark:text-teal-400 border border-[var(--border)]">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Faculty & Curriculum Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Trainer & Faculty Management
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
            Supervise platform instructors, inspect curriculum development portfolios, and monitor learner capacity across courses.
          </p>
        </div>
      </div>

      {/* ====================================================
          2. SEARCH & FILTERS
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search trainers by name, email, dept..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          Total Trainers: <strong className="text-[var(--text-primary)]">{filteredTrainers.length}</strong>
        </span>
      </div>

      {/* ====================================================
          3. TRAINERS TABLE
          ==================================================== */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading platform trainers..." />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchTrainers} />
      ) : filteredTrainers.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
          <UserCheck className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="font-bold text-sm text-[var(--text-primary)]">No trainers found matching your search.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Trainer</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Courses Created</th>
                  <th className="py-3.5 px-4">Total Learners</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {filteredTrainers.map((t) => (
                  <tr key={t._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                          {t.name?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <span className="block font-bold text-[var(--text-primary)]">{t.name}</span>
                          <span className="text-[11px] text-[var(--text-muted)] block font-normal">{t.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)]">{t.department || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>{t.coursesCount || 0}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{t.learnersCount || 0}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          t.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                        }`}
                      >
                        {t.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                            <span>Deactivated</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(t._id)}
                        className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                        title="Inspect Faculty Portfolio"
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
          4. TRAINER DETAILS MODAL WITH SAFE INLINE CONFIRMATION
          ==================================================== */}
      {(selectedTrainer || detailsLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[var(--border)] overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Trainer Portfolio & Course Audit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrainer(null);
                  setTrainerDetails(null);
                  setConfirmingDeactivate(false);
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
                  <Loading message="Loading trainer portfolio..." />
                </div>
              ) : selectedTrainer && trainerDetails ? (
                <>
                  {/* Profile Card */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{selectedTrainer.name}</h4>
                      <p className="text-[var(--text-muted)] font-mono text-[11px]">{selectedTrainer.email}</p>
                      <span className="text-[var(--text-muted)] text-[10px] mt-1 block">
                        Department: <strong className="text-[var(--text-secondary)]">{selectedTrainer.department || 'General Faculty'}</strong>
                      </span>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${
                          selectedTrainer.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                        }`}
                      >
                        {selectedTrainer.isActive ? 'Active Status' : 'Deactivated'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-center">
                      <span className="text-[10px] text-teal-700 dark:text-teal-300 uppercase font-mono block">Total Courses</span>
                      <strong className="text-sm font-bold text-teal-900 dark:text-teal-100">{trainerDetails.totalCourses || 0}</strong>
                    </div>
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-mono block">Published</span>
                      <strong className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{trainerDetails.publishedCourses || 0}</strong>
                    </div>
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-mono block">Learners</span>
                      <strong className="text-sm font-bold text-blue-900 dark:text-blue-100">{trainerDetails.totalLearners || 0}</strong>
                    </div>
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-mono block">Avg Rating</span>
                      <strong className="text-sm font-bold text-amber-900 dark:text-amber-100">{trainerDetails.averageRating || 0} &starf;</strong>
                    </div>
                  </div>

                  {/* Created Courses */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-[var(--text-primary)] uppercase text-[11px] tracking-wider">
                      Assigned Curriculum Courses ({trainerDetails.courses?.length || 0})
                    </h5>
                    {!trainerDetails.courses || trainerDetails.courses.length === 0 ? (
                      <p className="text-[var(--text-muted)] italic">No courses created yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {trainerDetails.courses.map((c) => (
                          <div
                            key={c.courseId}
                            className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-[var(--text-primary)]">{c.title}</span>
                              <span className="text-[10px] text-[var(--text-muted)] block">
                                {c.category} &bull; {c.level} &bull; {c.enrolledCount || 0} Learners
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {c.averageRating > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{c.averageRating}</span>
                                </span>
                              )}
                              <span
                                className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md ${
                                  c.status === 'published'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)]'
                                }`}
                              >
                                {c.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer with Safe Inline Confirmation */}
            <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-between transition-colors">
              <div>
                {selectedTrainer && (
                  confirmingDeactivate ? (
                    <div className="flex items-center gap-2 p-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                        {selectedTrainer.isActive ? 'Confirm deactivation?' : 'Confirm activation?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExecuteStatusToggle(selectedTrainer)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 text-xs font-bold bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors shadow-2xs"
                      >
                        {actionLoading ? 'Updating...' : 'Yes, Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeactivate(false)}
                        className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeactivate(true)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors inline-flex items-center gap-1.5 ${
                        selectedTrainer.isActive
                          ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                          : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{selectedTrainer.isActive ? 'Deactivate Account' : 'Activate Account'}</span>
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTrainer(null);
                  setTrainerDetails(null);
                  setConfirmingDeactivate(false);
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

export default AdminTrainersPage;
