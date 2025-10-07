import React, { useState } from 'react';
import { courseStore } from '../store/courseStore';
// Note: this component is a simple helper; using courseStore.createCourse to persist content

const defaultSlide = { title: '', text: '', image: '', voiceover: '' };

function CourseContentCreator() {
  const [slides, setSlides] = useState([ { ...defaultSlide } ]);
  const [current, setCurrent] = useState(0);

  const handleChange = (field, value) => {
    const updated = [ ...slides ];
    updated[current][field] = value;
    setSlides(updated);
  };

  const addSlide = () => setSlides([ ...slides, { ...defaultSlide } ]);
  const nextSlide = () => setCurrent((c) => Math.min(c + 1, slides.length - 1));
  const prevSlide = () => setCurrent((c) => Math.max(c - 1, 0));

  const handleImageUpload = (e) => {
    // TODO: Integrate stock photo API or use uploaded image
    handleChange('image', URL.createObjectURL(e.target.files[0]));
  };

  const generateVoiceover = async () => {
    // TODO: Integrate AI voiceover API
    handleChange('voiceover', 'ai-voiceover-generated.mp3');
  };

  return (
    <div>
      <h2>Course Content Creator</h2>
      <div>
        <label>Title: <input value={slides[current].title} onChange={e => handleChange('title', e.target.value)} /></label>
        <label>Text: <textarea value={slides[current].text} onChange={e => handleChange('text', e.target.value)} /></label>
        <label>Image: <input type="file" onChange={handleImageUpload} /></label>
        {slides[current].image && <img src={slides[current].image} alt="slide" style={{ width: 200 }} />}
        <button onClick={generateVoiceover}>Generate AI Voiceover</button>
        {slides[current].voiceover && <audio controls src={slides[current].voiceover} />}
      </div>
      <div>
        <button onClick={prevSlide} disabled={current === 0}>Previous</button>
        <button onClick={nextSlide} disabled={current === slides.length - 1}>Next</button>
        <button onClick={addSlide}>Add Slide</button>
      </div>
      <div>
        <button onClick={() => {
          try {
            const newCourse = courseStore.createCourse({
              title: slides[0].title || 'New Course',
              description: slides[0].text || '',
              modules: [{ id: 'module-1', title: 'Module 1', description: '', duration: '0 min', order: 1, lessons: slides.map((s, idx) => ({ id: `lesson-${idx+1}`, title: s.title || `Lesson ${idx+1}`, type: 'text', duration: '5 min', content: { notes: s.text, image: s.image, voiceover: s.voiceover }, completed: false, order: idx+1 })), resources: [] }]
            });
            alert('Course created: ' + newCourse.title);
          } catch (e) {
            console.warn('Save failed', e);
            alert('Failed to save course');
          }
        }}>Save Course</button>
      </div>
    </div>
  );
}

export default CourseContentCreator;