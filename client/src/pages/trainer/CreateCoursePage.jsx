import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createCourseApi } from '../../services/api';
import Button from '../../components/Button';
import ErrorMessage from '../../components/ErrorMessage';
import SkillsSelect from '../../components/SkillsSelect';
import { BookPlus, ArrowLeft, GraduationCap, Sparkles, Lightbulb } from 'lucide-react';

const CreateCoursePage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    level: 'beginner',
    prerequisites: '',
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const { title, description, category, level, prerequisites } = formData;
    if (!title.trim() || !description.trim() || !category.trim()) {
      setError('Please fill in all required fields (Title, Description, Category).');
      return;
    }

    setLoading(true);

    try {
      const response = await createCourseApi({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        level,
        prerequisites: prerequisites.trim(),
        skills: selectedSkills,
      });

      if (response && response.success && response.data) {
        navigate(`/trainer/courses/${response.data._id}/manage`, {
          state: { message: 'Course created as draft. Add modules and learning resources before publishing.' },
        });
      } else {
        throw new Error(response?.message || 'Failed to create course');
      }
    } catch (err) {
      console.error('Course creation error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create course.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ====================================================
          1. BREADCRUMB & HEADER
          ==================================================== */}
      <div className="flex items-center gap-3">
        <Link
          to="/trainer/courses"
          className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--primary-border,#BFDBFE)] transition-colors shadow-2xs"
          title="Back to courses"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--surface-muted)] text-[var(--primary)] border border-[var(--border)] mb-1">
            <GraduationCap className="w-3 h-3" />
            <span>Course Creator</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Create New Course
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Define course metadata, difficulty, and skill mapping. You will structure modules and media on the next step.
          </p>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}

      {/* ====================================================
          2. COURSE FORM CONTAINER
          ==================================================== */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 sm:p-8 shadow-xs transition-colors">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="title">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={150}
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Modern Full-Stack Development with React & Node.js"
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
              disabled={loading}
            />
            <span className="text-[11px] text-[var(--text-muted)] block mt-1">
              Max 150 characters ({formData.title.length}/150)
            </span>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="description">
              Course Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              value={formData.description}
              onChange={handleChange}
              placeholder="Comprehensive summary of course objectives, syllabus scope, target learners, and practical outcomes..."
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors leading-relaxed"
              disabled={loading}
            />
          </div>

          {/* Prerequisites */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="prerequisites">
              Prerequisites <span className="text-[var(--text-muted)] font-normal">(Optional)</span>
            </label>
            <input
              id="prerequisites"
              name="prerequisites"
              type="text"
              value={formData.prerequisites}
              onChange={handleChange}
              placeholder="e.g. Basic JavaScript ES6, HTML5, and CSS fundamentals"
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
              disabled={loading}
            />
          </div>

          {/* Category & Level Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="category">
                Category <span className="text-red-500">*</span>
              </label>
              <input
                id="category"
                name="category"
                type="text"
                required
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g. Software Engineering, Cloud Architecture"
                className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
                disabled={loading}
              />
            </div>

            {/* Level */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5" htmlFor="level">
                Target Difficulty Level <span className="text-red-500">*</span>
              </label>
              <select
                id="level"
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-colors"
                disabled={loading}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Skills Covered */}
          <SkillsSelect
            selectedSkills={selectedSkills}
            onChange={setSelectedSkills}
            label="Skills Covered"
            helperText="Associate verified skills that trainees will attain upon passing the course final assessment."
            withProficiency={true}
            disabled={loading}
          />

          {/* Educational Best Practices Tip Box */}
          <div className="bg-[var(--primary-soft)] border border-[var(--primary-border,#BFDBFE)] rounded-xl p-4 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-[var(--primary)]">Course Creation Tip</p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Courses are initially created in <strong>Draft</strong> state. You can structure modules, upload video/document resources, and add knowledge quizzes in the curriculum manager before publishing to the catalog.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
            <Link
              to="/trainer/courses"
              className="px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </Link>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={loading}
              className="inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 shadow-xs"
            >
              <BookPlus className="w-4 h-4" />
              <span>{loading ? 'Creating...' : 'Save as Draft & Continue'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCoursePage;
