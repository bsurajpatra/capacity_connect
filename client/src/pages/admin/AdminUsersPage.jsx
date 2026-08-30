import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsersApi, getUserByIdApi, toggleUserStatusApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  CheckCircle2,
  XCircle,
  Eye,
  Power,
  X,
  BookOpen,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

const AdminUsersPage = () => {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // User Details Modal & Safe Inline Deactivation State
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [roleData, setRoleData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllUsersApi({
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
      });
      if (response && response.success) {
        setUsers(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load platform users.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleOpenDetails = async (userId) => {
    setDetailsLoading(true);
    setSelectedUser(null);
    setRoleData(null);
    setConfirmingDeactivate(false);
    try {
      const response = await getUserByIdApi(userId);
      if (response && response.success) {
        setSelectedUser(response.data.user);
        setRoleData(response.data.roleData);
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExecuteStatusToggle = async (userObj) => {
    if (authUser?.id === userObj._id || authUser?._id === userObj._id) {
      alert('Security Warning: You cannot deactivate your own administrator account.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await toggleUserStatusApi(userObj._id, !userObj.isActive);
      if (response && response.success) {
        setUsers((prev) =>
          prev.map((u) => (u._id === userObj._id ? { ...u, isActive: !u.isActive } : u))
        );
        if (selectedUser && selectedUser._id === userObj._id) {
          setSelectedUser((prev) => ({ ...prev, isActive: !prev.isActive }));
        }
        setConfirmingDeactivate(false);
      }
    } catch (err) {
      console.error('Error toggling user status:', err);
      alert(err.response?.data?.message || 'Failed to update user status.');
    } finally {
      setActionLoading(false);
    }
  };

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
            <span>User Directory & Access Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Platform User Management
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
            Search, audit, inspect portfolios, and manage active account statuses for all registered platform trainees, trainers, and administrators.
          </p>
        </div>
      </div>

      {/* ====================================================
          2. FILTERS TOOLBAR
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, department..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>

        {/* Role & Status Filter Pills */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1">
            {['all', 'trainee', 'trainer', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg uppercase tracking-wider transition-colors ${
                  roleFilter === r
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--surface)] text-[var(--text-primary)] font-medium transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* ====================================================
          3. USERS TABLE
          ==================================================== */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading platform users..." />
        </div>
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
          <Users className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="font-bold text-sm text-[var(--text-primary)]">No users found matching your search criteria.</p>
          <p className="text-[var(--text-muted)]">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {users.map((u) => {
                  return (
                    <tr key={u._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0 border border-[var(--primary-border,#BFDBFE)]">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="block font-bold text-[var(--text-primary)]">{u.name}</span>
                            <span className="text-[11px] text-[var(--text-muted)] block font-normal">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                            u.role === 'admin'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : u.role === 'trainer'
                              ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {u.role === 'admin' ? (
                            <ShieldCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          ) : u.role === 'trainer' ? (
                            <UserCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          ) : (
                            <GraduationCap className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          )}
                          <span>{u.role}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">{u.department || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                            u.isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                          }`}
                        >
                          {u.isActive ? (
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
                      <td className="py-3 px-4 text-[var(--text-muted)]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(u._id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:bg-[var(--primary-soft)]/80 border border-[var(--primary-border,#BFDBFE)] rounded-lg transition-colors inline-flex items-center gap-1"
                          title="Inspect Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
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
          4. USER DETAILS MODAL WITH SAFE INLINE CONFIRMATION
          ==================================================== */}
      {(selectedUser || detailsLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[var(--border)] overflow-hidden transition-colors">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  User Account & Portfolio Inspection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setRoleData(null);
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
                  <Loading message="Loading user account details..." />
                </div>
              ) : selectedUser ? (
                <>
                  {/* Account Summary Card */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">{selectedUser.name}</h4>
                      <p className="text-[var(--text-muted)] font-mono text-[11px]">{selectedUser.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                          {selectedUser.role}
                        </span>
                        <span className="text-[var(--text-muted)] text-[11px]">
                          Dept: <strong className="text-[var(--text-secondary)]">{selectedUser.department || 'Not Assigned'}</strong>
                        </span>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${
                          selectedUser.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                        }`}
                      >
                        {selectedUser.isActive ? 'Active Status' : 'Deactivated'}
                      </span>
                    </div>
                  </div>

                  {/* Role Data: Trainee */}
                  {selectedUser.role === 'trainee' && roleData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-mono block">Enrolled</span>
                          <strong className="text-sm font-bold text-blue-900 dark:text-blue-100">{roleData.totalEnrollments}</strong>
                        </div>
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-mono block">Completed</span>
                          <strong className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{roleData.completedCourses}</strong>
                        </div>
                        <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-center">
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 uppercase font-mono block">Skills</span>
                          <strong className="text-sm font-bold text-purple-900 dark:text-purple-100">{roleData.verifiedSkillsCount}</strong>
                        </div>
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-mono block">Avg Score</span>
                          <strong className="text-sm font-bold text-amber-900 dark:text-amber-100">{roleData.averageScore}%</strong>
                        </div>
                      </div>

                      {/* Enrolled Courses */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-[var(--text-primary)] uppercase text-[11px] tracking-wider">
                          Course Enrollments ({roleData.enrollments?.length || 0})
                        </h5>
                        {roleData.enrollments?.length === 0 ? (
                          <p className="text-[var(--text-muted)] italic">No courses enrolled yet.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {roleData.enrollments.map((e) => (
                              <div
                                key={e.courseId}
                                className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">{e.title}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] block">{e.category} &bull; {e.level}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-emerald-600">{e.progress}%</span>
                                  <span className="text-[10px] text-[var(--text-muted)] block uppercase">{e.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Role Data: Trainer */}
                  {selectedUser.role === 'trainer' && roleData && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-center">
                          <span className="text-[10px] text-teal-700 dark:text-teal-300 uppercase font-mono block">Courses</span>
                          <strong className="text-sm font-bold text-teal-900 dark:text-teal-100">{roleData.totalCourses}</strong>
                        </div>
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-mono block">Published</span>
                          <strong className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{roleData.publishedCourses}</strong>
                        </div>
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                          <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-mono block">Learners</span>
                          <strong className="text-sm font-bold text-blue-900 dark:text-blue-100">{roleData.totalLearners}</strong>
                        </div>
                        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-mono block">Avg Rating</span>
                          <strong className="text-sm font-bold text-amber-900 dark:text-amber-100">{roleData.averageRating} &starf;</strong>
                        </div>
                      </div>

                      {/* Created Courses */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-[var(--text-primary)] uppercase text-[11px] tracking-wider">
                          Instructed Courses ({roleData.courses?.length || 0})
                        </h5>
                        {roleData.courses?.length === 0 ? (
                          <p className="text-[var(--text-muted)] italic">No courses created yet.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {roleData.courses.map((c) => (
                              <div
                                key={c.courseId}
                                className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-semibold text-[var(--text-primary)]">{c.title}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] block">{c.category} &bull; {c.level}</span>
                                </div>
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
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer with Safe Inline Confirmation */}
            <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-between transition-colors">
              <div>
                {selectedUser && authUser?.id !== selectedUser._id && authUser?._id !== selectedUser._id && (
                  confirmingDeactivate ? (
                    <div className="flex items-center gap-2 p-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                        {selectedUser.isActive ? 'Confirm deactivation?' : 'Confirm activation?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExecuteStatusToggle(selectedUser)}
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
                        selectedUser.isActive
                          ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                          : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{selectedUser.isActive ? 'Deactivate Account' : 'Activate Account'}</span>
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setRoleData(null);
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

export default AdminUsersPage;
