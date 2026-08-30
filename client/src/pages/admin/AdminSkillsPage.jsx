import React, { useState, useEffect, useCallback } from 'react';
import {
  getSkillsApi,
  createSkillApi,
  updateSkillApi,
  toggleSkillStatusApi,
  deleteSkillApi,
} from '../../services/api';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';
import {
  Target,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  Power,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

const AdminSkillsPage = () => {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Technical',
    customCategory: '',
    description: '',
    isActive: true,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getSkillsApi({ all: 'true' });
      if (response && response.success) {
        setSkills(response.data || []);
      } else {
        throw new Error(response?.message || 'Failed to fetch skills');
      }
    } catch (err) {
      console.error('Error fetching skills:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load skills.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const openAddModal = () => {
    setEditingSkill(null);
    setFormData({
      name: '',
      category: 'Technical',
      customCategory: '',
      description: '',
      isActive: true,
    });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      category: skill.category,
      customCategory: skill.customCategory || '',
      description: skill.description || '',
      isActive: skill.isActive,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSaveSkill = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a skill name.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      if (editingSkill) {
        const response = await updateSkillApi(editingSkill._id, formData);
        if (response && response.success) {
          setSkills((prev) =>
            prev.map((s) => (s._id === editingSkill._id ? response.data : s))
          );
          setFeedback(`Skill "${response.data.name}" updated successfully.`);
          setShowModal(false);
        }
      } else {
        const response = await createSkillApi(formData);
        if (response && response.success) {
          setSkills((prev) => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
          setFeedback(`Skill "${response.data.name}" added to library.`);
          setShowModal(false);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save skill.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (skill) => {
    setError(null);
    try {
      const response = await toggleSkillStatusApi(skill._id);
      if (response && response.success) {
        setSkills((prev) =>
          prev.map((s) => (s._id === skill._id ? response.data : s))
        );
        setFeedback(`Skill "${skill.name}" is now ${response.data.isActive ? 'Active' : 'Deactivated'}.`);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to toggle status.');
    }
  };

  const handleDeleteSkill = async (skill) => {
    const confirm = window.confirm(
      `Are you sure you want to permanently delete skill "${skill.name}"? If this skill is referenced in courses or competencies, deactivation is recommended instead.`
    );
    if (!confirm) return;

    try {
      await deleteSkillApi(skill._id);
      setFeedback(`Skill "${skill.name}" deleted.`);
      setSkills((prev) => prev.filter((s) => s._id !== skill._id));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete skill.');
    }
  };

  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.isActive) ||
      (statusFilter === 'inactive' && !s.isActive);

    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ====================================================
          1. HEADER HERO BANNER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)]">
            <Target className="w-3.5 h-3.5" />
            <span>Master Taxonomy & Skill Catalog</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Institutional Skill Library
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-2xl">
            Maintain the standardized taxonomy of technical, domain-specific, and behavioral skills mapped across platform courses and competency frameworks.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 text-xs font-semibold self-start sm:self-auto shrink-0 z-10"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Skill</span>
        </Button>
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
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ====================================================
          2. FILTER TOOLBAR
          ==================================================== */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[var(--surface)] p-3.5 border border-[var(--border)] rounded-xl shadow-xs transition-colors">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search skills by name or keyword..."
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
          />
        </div>

        {/* Category and Status Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1">
            {['All', 'Technical', 'Soft Skill', 'Other'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                }`}
              >
                {cat}
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
          3. SKILLS TABLE
          ==================================================== */}
      {loading ? (
        <div className="py-20 flex justify-center bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs">
          <Loading message="Loading skill library..." />
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-12 text-center text-xs text-[var(--text-muted)] shadow-xs space-y-2">
          <Target className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="font-bold text-sm text-[var(--text-primary)]">No skills found matching your filters.</p>
          <p className="text-[var(--text-muted)]">Try adjusting your search criteria or add a new skill.</p>
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Skill Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {filteredSkills.map((skill) => (
                  <tr key={skill._id} className="hover:bg-[var(--surface-muted)]/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                        <span>{skill.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                          skill.category === 'Soft Skill'
                            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : skill.category === 'Technical'
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border,#BFDBFE)]'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {skill.category === 'Other' && skill.customCategory
                          ? `Other (${skill.customCategory})`
                          : skill.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] max-w-md">
                      {skill.description || <span className="italic opacity-60">No description</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                          skill.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]'
                        }`}
                      >
                        {skill.isActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-[var(--text-muted)]" />
                            <span>Inactive</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(skill)}
                        className="px-2.5 py-1 bg-[var(--primary-soft)] border border-[var(--primary-border,#BFDBFE)] hover:bg-[var(--primary-soft)]/80 text-[var(--primary)] rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                        title="Edit Skill"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(skill)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 ${
                          skill.isActive
                            ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                            : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                        }`}
                        title={skill.isActive ? 'Deactivate Skill' : 'Activate Skill'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{skill.isActive ? 'Deactivate' : 'Reactivate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSkill(skill)}
                        className="p-1 text-[var(--text-muted)] hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Delete Skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          4. MODAL: ADD / EDIT SKILL WITH DEDICATED PUSH BUTTON
          ==================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-[var(--border)] transition-colors">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-muted)]">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[var(--primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {editingSkill ? 'Edit Skill' : 'Add New Skill'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSkill} className="p-6 space-y-4">
              {error && <ErrorMessage message={error} />}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Skill Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. React, Docker, Meteorological Modeling"
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-medium transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-medium transition-colors"
                >
                  <option value="Technical">Technical</option>
                  <option value="Soft Skill">Soft Skill</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formData.category === 'Other' && (
                <div className="animate-fadeIn space-y-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    Specify Category / Domain <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={formData.customCategory || ''}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    placeholder="e.g. Domain Specific, Regulatory, Tools"
                    className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-medium transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Description <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief synopsis of what this skill encompasses..."
                  className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors"
                />
              </div>

              {/* Dedicated Status Push Button */}
              <div className="pt-2 border-t border-[var(--border)]">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                  Library Availability Status
                </label>
                <div className="flex items-center justify-between p-3 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        formData.isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]'
                      }`}
                    >
                      {formData.isActive ? 'Active Status' : 'Deactivated'}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {formData.isActive ? 'Available for new courses' : 'Hidden from curriculum builder'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors inline-flex items-center gap-1.5 shadow-2xs ${
                      formData.isActive
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                        : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{formData.isActive ? 'Deactivate' : 'Reactivate'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" variant="primary" size="sm" loading={actionLoading}>
                  {editingSkill ? 'Save Changes' : 'Create Skill'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSkillsPage;
