import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
const defaultSlide = { title: '', text: '', image: '', voiceover: '' };
function CourseContentCreator() {
    const [slides, setSlides] = useState([{ ...defaultSlide }]);
    const [current, setCurrent] = useState(0);
    const handleChange = (field, value) => {
        const updated = [...slides];
        updated[current][field] = value;
        setSlides(updated);
    };
    const addSlide = () => setSlides([...slides, { ...defaultSlide }]);
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
    return (_jsxs("div", { children: [_jsx("h2", { children: "Course Content Creator" }), _jsxs("div", { children: [_jsxs("label", { children: ["Title: ", _jsx("input", { value: slides[current].title, onChange: e => handleChange('title', e.target.value) })] }), _jsxs("label", { children: ["Text: ", _jsx("textarea", { value: slides[current].text, onChange: e => handleChange('text', e.target.value) })] }), _jsxs("label", { children: ["Image: ", _jsx("input", { type: "file", onChange: handleImageUpload })] }), slides[current].image && _jsx("img", { src: slides[current].image, alt: "slide", style: { width: 200 } }), _jsx("button", { onClick: generateVoiceover, children: "Generate AI Voiceover" }), slides[current].voiceover && _jsx("audio", { controls: true, src: slides[current].voiceover })] }), _jsxs("div", { children: [_jsx("button", { onClick: prevSlide, disabled: current === 0, children: "Previous" }), _jsx("button", { onClick: nextSlide, disabled: current === slides.length - 1, children: "Next" }), _jsx("button", { onClick: addSlide, children: "Add Slide" })] }), _jsx("div", { children: _jsx("button", { onClick: () => { }, children: "Save Course" }) })] }));
}
export default CourseContentCreator;
