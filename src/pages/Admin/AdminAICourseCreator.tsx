import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { courseStore } from '../../store/courseStore';
import type { Course } from '../../store/courseStore';
import { Save, CheckCircle, Loader } from 'lucide-react';
import { generateDEIACourse, fetchMediaSuggestions } from '../../services/aiCourseService';
import mockAIGenerateDEIACourse from '../../utils/aiMocks';

const AdminAICourseCreator = () => {
  const navigate = useNavigate();
  const [audience, setAudience] = useState('Managers');
  const [length, setLength] = useState('short');
  const [tone, setTone] = useState('Practical');
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCourse, setGeneratedCourse] = useState<Course | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Prefer the aiCourseService which will use OpenAI/Pexels if keys are present, otherwise fall back to mock
      const course = await generateDEIACourse({ title, audience, length, tone });
      setGeneratedCourse(course);

      // Preload some media suggestions for the first module/topic
      const firstTopic = course.modules?.[0]?.title || `${audience} DEIA`;
      const media = await fetchMediaSuggestions(firstTopic);
      // Attach first media suggestion to thumbnail if present and course has no thumbnail
      if (media && media.length > 0 && !course.thumbnail) {
        (course as Course).thumbnail = media[0].url;
        setGeneratedCourse({ ...course });
      }
    } catch (err) {
      console.error('AI generation failed', err);
      alert('AI generation failed — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    if (!generatedCourse) return alert('No generated course to save.');
    try {
      const created = courseStore.createCourse(generatedCourse);
      courseStore.saveCourse(created);
      setGeneratedCourse(created);
      alert('Course saved as draft. You can edit it in Course Builder.');
      navigate(`/admin/course-builder/${created.id}`);
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save draft.');
    }
  };

  const handlePublish = () => {
    if (!generatedCourse) return alert('No generated course to publish.');
    try {
      const created = courseStore.createCourse(generatedCourse);
      const published = { ...created, status: 'published', publishedDate: new Date().toISOString() } as Course;
      courseStore.saveCourse(published);
      setGeneratedCourse(published);
      alert('Course published.');
      navigate(`/admin/course-builder/${published.id}`);
    } catch (err) {
      console.error('Publish failed', err);
      alert('Failed to publish course.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Course Creator — DEIA Specialization</h1>

      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Audience</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Length</label>
            <select value={length} onChange={(e) => setLength(e.target.value)} className="w-full px-3 py-2 border rounded">
              <option value="short">Short (30-45 min)</option>
              <option value="medium">Medium (60-90 min)</option>
              <option value="long">Long (2-4 hours)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Tone</label>
            <input value={tone} onChange={(e) => setTone(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-gray-700 mb-2">Optional Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom course title" className="w-full px-3 py-2 border rounded" />
        </div>

        <div className="mt-4 flex items-center space-x-3">
          <button onClick={handleGenerate} disabled={generating} className="bg-orange-500 text-white px-4 py-2 rounded flex items-center space-x-2">
            {generating ? <Loader className="h-4 w-4 animate-spin" /> : null}
            <span>{generating ? 'Generating…' : 'Generate Course'}</span>
          </button>
          <button onClick={() => { setGeneratedCourse(null); setTitle(''); }} className="px-4 py-2 border rounded">Reset</button>
        </div>
      </div>

      {generatedCourse && (
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Generated Course Preview</h2>
          <p className="text-gray-600 mb-4">Title: {generatedCourse.title}</p>
          <p className="text-gray-600 mb-4">Description: {generatedCourse.description}</p>

          <div className="space-y-3 mb-4">
            {generatedCourse.modules.map((m) => (
              <div key={m.id} className="p-3 border rounded">
                <h3 className="font-medium">{m.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{m.description}</p>
                <ul className="text-sm list-disc list-inside">
                  {m.lessons.map((l) => (
                    <li key={l.id}>{l.title} — {l.type} — {l.duration}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <button onClick={handleSaveDraft} className="bg-blue-500 text-white px-4 py-2 rounded flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
            <button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Publish Course</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAICourseCreator;
