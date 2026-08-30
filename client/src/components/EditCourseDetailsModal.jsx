import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  BookOpen,
  Target,
  Settings,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
  Save,
  Globe,
  Lock,
  Tag,
  Clock,
  Award,
  HelpCircle,
  Check,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';
import SkillsSelect from './SkillsSelect';
import { updateCourseApi } from '../services/api';

const CATEGORIES = [
  'Web Development',
  'Data Science',
  'Cloud Computing',
  'Cybersecurity',
  'Artificial Intelligence',
  'DevOps & Infrastructure',
  'Software Engineering',
  'Project Management',
  'Digital Governance',
];

const EditCourseDetailsModal = ({
  isOpen,
  onClose,
  course,
  onCourseUpdated,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState('basic'); // basic | outcomes | skills | settings
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    shortDescription: '',
    description: '',
    category: '',
    level: 'beginner',
    prerequisites: '',
    estimatedDuration: '',
    language: 'English',
    learningOutcomes: [],
    skills: [],
    status: 'draft',
    enrollmentStatus: 'open',
    passingScore: 60,
    certificateEligibility: true,
  });

  const [newOutcomeInput, setNewOutcomeInput] = useState('');

  // Synchronize initial course data
  useEffect(() => {
    if (course && isOpen) {
      setFormData({
        title: course.title || '',
        shortDescription: course.shortDescription || '',
        description: course.description || '',
        category: course.category || CATEGORIES[0],
        level: course.level || 'beginner',
        prerequisites: course.prerequisites || '',
        estimatedDuration: course.estimatedDuration || '',
        language: course.language || 'English',
        learningOutcomes: Array.isArray(course.learningOutcomes) ? [...course.learningOutcomes] : [],
        skills: Array.isArray(course.skills)
          ? course.skills.map((s) => ({
              skill: s._id || s.skill?._id || s,
              proficiency: s.proficiency || course.level || 'beginner',
            }))
          : [],
        status: course.status || 'draft',
        enrollmentStatus: course.enrollmentStatus || 'open',
        passingScore: course.passingScore !== undefined ? course.passingScore : 60,
        certificateEligibility: course.certificateEligibility !== undefined ? course.certificateEligibility : true,
      });
      setError(null);
      setActiveTab('basic');
      setShowDiscardConfirm(false);
      setNewOutcomeInput('');
    }
  }, [course, isOpen]);

  // Track if form is dirty (has modifications)
  const isDirty = useMemo(() => {
    if (!course) return false;
    const initialSkillsStr = JSON.stringify(
      (course.skills || []).map((s) => ({
        skill: (s._id || s.skill?._id || s).toString(),
        proficiency: s.proficiency || course.level || 'beginner',
      }))
    );
    const currentSkillsStr = JSON.stringify(
      (formData.skills || []).map((s) => ({
        skill: (s.skill?._id || s.skill || s).toString(),
        proficiency: s.proficiency || 'beginner',
      }))
    );

    const initialOutcomesStr = JSON.stringify(course.learningOutcomes || []);
    const currentOutcomesStr = JSON.stringify(formData.learningOutcomes || []);

    return (
      formData.title !== (course.title || '') ||
      formData.shortDescription !== (course.shortDescription || '') ||
      formData.description !== (course.description || '') ||
      formData.category !== (course.category || '') ||
      formData.level !== (course.level || 'beginner') ||
      formData.prerequisites !== (course.prerequisites || '') ||
      formData.estimatedDuration !== (course.estimatedDuration || '') ||
      formData.language !== (course.language || 'English') ||
      formData.status !== (course.status || 'draft') ||
      formData.enrollmentStatus !== (course.enrollmentStatus || 'open') ||
      formData.passingScore !== (course.passingScore !== undefined ? course.passingScore : 60) ||
      formData.certificateEligibility !== (course.certificateEligibility !== undefined ? course.certificateEligibility : true) ||
      initialSkillsStr !== currentSkillsStr ||
      initialOutcomesStr !== currentOutcomesStr
    );
  }, [formData, course]);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleAddOutcome = (e) => {
    if (e) e.preventDefault();
    const trimmed = newOutcomeInput.trim();
    if (!trimmed) return;
    if (formData.learningOutcomes.includes(trimmed)) {
      setError('This learning outcome has already been added.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      learningOutcomes: [...prev.learningOutcomes, trimmed],
    }));
    setNewOutcomeInput('');
    setError(null);
  };

  const handleRemoveOutcome = (index) => {
    setFormData((prev) => ({
      ...prev,
      learningOutcomes: prev.learningOutcomes.filter((_, i) => i !== index),
    }));
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title.trim()) {
      setError('Course title is required.');
      setActiveTab('basic');
      return;
    }

    if (!formData.description.trim()) {
      setError('Detailed course description is required.');
      setActiveTab('basic');
      return;
    }

    if (!formData.category.trim()) {
      setError('Please select a course category.');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: formData.title.trim(),
        shortDescription: formData.shortDescription.trim(),
        description: formData.description.trim(),
        category: formData.category.trim(),
        level: formData.level,
        prerequisites: formData.prerequisites.trim(),
        estimatedDuration: formData.estimatedDuration.trim(),
        language: formData.language.trim() || 'English',
        learningOutcomes: formData.learningOutcomes,
        skills: formData.skills,
        status: formData.status,
        enrollmentStatus: formData.enrollmentStatus,
        passingScore: Number(formData.passingScore) || 60,
        certificateEligibility: Boolean(formData.certificateEligibility),
      };

      const response = await updateCourseApi(course._id, payload);
      if (response && response.success) {
        if (onCourseUpdated) {
          onCourseUpdated(response.data);
        }
        if (onNotify) {
          onNotify({
            type: 'success',
            message: 'Course details updated successfully.',
          });
        }
        onClose();
      } else {
        throw new Error(response?.message || 'Failed to update course details');
      }
    } catch (err) {
      console.error('Error updating course details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn"
        onClick={handleCloseAttempt}
      />

      {/* Modal Dialog */}
      <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
        <div className="relative bg-[var(--surface)] rounded-xl shadow-2xl max-w-4xl w-full border border-[var(--border)] overflow-hidden flex flex-col max-h-[90vh] animate-scale-up transition-colors">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-[var(--surface-muted)] border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary-border,#BFDBFE)]">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Edit Course Details
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Manage curriculum parameters, standardized skill mapping, and delivery configuration.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseAttempt}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs Header */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2.5 font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'basic'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] shadow-2xs'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>1. Basic Information</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outcomes')}
              className={`px-4 py-2.5 font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'outcomes'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] shadow-2xs'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>2. Learning Outcomes ({formData.learningOutcomes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('skills')}
              className={`px-4 py-2.5 font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'skills'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] shadow-2xs'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>3. Skills Mapping ({formData.skills.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--surface)] shadow-2xs'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>4. Course Settings</span>
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[var(--text-secondary)]">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-200 flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* ====================================================
                TAB 1: BASIC INFORMATION
                ==================================================== */}
            {activeTab === 'basic' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Course Name */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Course Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="e.g., Full Stack Development with React & Node.js"
                    className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-semibold text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                  />
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Short Headline / Summary
                  </label>
                  <input
                    type="text"
                    value={formData.shortDescription}
                    onChange={(e) => handleFieldChange('shortDescription', e.target.value)}
                    placeholder="Brief 1-2 sentence overview for catalog cards and recommendations..."
                    maxLength={300}
                    className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    {formData.shortDescription.length}/300 characters
                  </p>
                </div>

                {/* Detailed Description */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Detailed Course Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Comprehensive overview of modules, target audience, methodology, and practical exercises..."
                    className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] leading-relaxed transition-colors"
                  />
                </div>

                {/* 2-Column Attributes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] font-medium cursor-pointer transition-colors"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty Level */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Difficulty Level <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => handleFieldChange('level', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] font-medium cursor-pointer transition-colors"
                    >
                      <option value="beginner">Beginner (Foundational)</option>
                      <option value="intermediate">Intermediate (Practitioner)</option>
                      <option value="advanced">Advanced (Specialist)</option>
                    </select>
                  </div>

                  {/* Estimated Duration */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Estimated Duration
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={formData.estimatedDuration}
                        onChange={(e) => handleFieldChange('estimatedDuration', e.target.value)}
                        placeholder="e.g., 40 Hours (Self-paced)"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Instructional Language
                    </label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={formData.language}
                        onChange={(e) => handleFieldChange('language', e.target.value)}
                        placeholder="e.g., English / Hindi"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Prerequisites */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Prerequisites & Recommended Background
                  </label>
                  <input
                    type="text"
                    value={formData.prerequisites}
                    onChange={(e) => handleFieldChange('prerequisites', e.target.value)}
                    placeholder="e.g., Basic JavaScript and HTML/CSS understanding"
                    className="w-full px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* ====================================================
                TAB 2: LEARNING OUTCOMES
                ==================================================== */}
            {activeTab === 'outcomes' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="font-bold text-[var(--text-primary)] text-xs mb-1">
                    Measurable Student Outcomes
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Define concrete competencies and capabilities learners will master upon completing this course.
                  </p>
                </div>

                {/* Add Outcome Input Bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOutcomeInput}
                    onChange={(e) => setNewOutcomeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOutcome();
                      }
                    }}
                    placeholder="e.g., Build and deploy production REST APIs using Express and MongoDB"
                    className="flex-1 px-3.5 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddOutcome}
                    disabled={!newOutcomeInput.trim()}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Outcome</span>
                  </button>
                </div>

                {/* Outcomes List */}
                {formData.learningOutcomes.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-[var(--border)] rounded-xl space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                    <p className="text-xs font-semibold text-[var(--text-primary)]">No learning outcomes added yet.</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Type an outcome above and click "Add Outcome".</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.learningOutcomes.map((outcome, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[var(--surface-muted)] border border-[var(--border)] rounded-lg flex items-center justify-between gap-3 shadow-2xs hover:border-[var(--primary-border,#BFDBFE)] transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-xs text-[var(--text-primary)] font-medium leading-relaxed break-words">
                            {outcome}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveOutcome(idx)}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-600 rounded transition-colors shrink-0"
                          title="Remove outcome"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ====================================================
                TAB 3: SKILLS MAPPING
                ==================================================== */}
            {activeTab === 'skills' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="bg-[var(--primary-soft)] border border-[var(--primary-border,#BFDBFE)] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-[var(--primary)] font-bold text-xs mb-1">
                    <Tag className="w-4 h-4 text-[var(--primary)]" />
                    <span>Standardized Skills & Competencies Alignment</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Map this course to recognized platform skills. Each mapped skill will be evaluated across quizzes and contribute to learner skill verifications and AI recommendations.
                  </p>
                </div>

                {/* Skills Selector with Proficiency dropdowns */}
                <SkillsSelect
                  selectedSkills={formData.skills}
                  onChange={(skills) => handleFieldChange('skills', skills)}
                  withProficiency={true}
                  label="Target Skills & Target Proficiency Level"
                  helperText="Choose skills from the library and set the target proficiency: Beginner, Proficient, or Advanced."
                />
              </div>
            )}

            {/* ====================================================
                TAB 4: COURSE SETTINGS & DELIVERY
                ==================================================== */}
            {activeTab === 'settings' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Visibility / Publish Status */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Catalog Visibility Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] font-semibold cursor-pointer transition-colors"
                    >
                      <option value="draft">Draft (Private to Instructor)</option>
                      <option value="published">Published (Visible in Trainee Catalog)</option>
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Courses must contain at least one module before trainees can complete curriculum tracks.
                    </p>
                  </div>

                  {/* Enrollment Status */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Trainee Enrollment Acceptance
                    </label>
                    <select
                      value={formData.enrollmentStatus}
                      onChange={(e) => handleFieldChange('enrollmentStatus', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] font-semibold cursor-pointer transition-colors"
                    >
                      <option value="open">Open (Accepting new enrollments)</option>
                      <option value="closed">Closed (Roster capped / Closed)</option>
                    </select>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      When closed, current trainees retain access but new enrollments are paused.
                    </p>
                  </div>

                  {/* Passing Score Threshold */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Certification Passing Threshold (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.passingScore}
                      onChange={(e) => handleFieldChange('passingScore', e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--text-primary)] bg-[var(--surface)] font-mono font-bold transition-colors"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Minimum overall score percentage required on the final assessment to award a digital certificate.
                    </p>
                  </div>

                  {/* Certificate Eligibility Toggle */}
                  <div className="p-4 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl space-y-2 flex flex-col justify-between">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-primary)]">
                        Digital Credential Generation
                      </label>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Issue verified digital certificates to learners who pass the final assessment.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={formData.certificateEligibility}
                        onChange={(e) => handleFieldChange('certificateEligibility', e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
                      />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        Enable Automated Certificate Issuance
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Sticky Modal Action Footer */}
          <div className="px-6 py-4 bg-[var(--surface-muted)] border-t border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved changes
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseAttempt}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Changes Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl max-w-sm w-full p-5 border border-[var(--border)] space-y-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Discard unsaved changes?</h4>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  You have made changes to the course details. If you leave now, your changes will not be saved.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditCourseDetailsModal;
