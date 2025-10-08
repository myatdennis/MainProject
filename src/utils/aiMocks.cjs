const { v4: uuidv4 } = require('uuid');

function generateId(prefix) {
  return `${prefix}-${uuidv4().slice(0,8)}`;
}

function mockAIGenerateDEIACourse(seed) {
  const id = generateId('course');
  const title = seed.title || `DEIA: ${seed.audience || 'Workplace'} Essentials`;

  const sampleVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
  ];

  const topics = [
    'Foundations of DEIA',
    'Bias Awareness and Mitigation',
    'Inclusive Communication',
    'Building Psychological Safety',
    'Equitable Decision Making'
  ];

  const modules = topics.map((topic, idx) => {
    const lessons = [
      {
        id: generateId('lesson'),
        title: `${topic} — Overview`,
        type: 'video',
        duration: '8 min',
        content: { videoUrl: sampleVideos[idx % sampleVideos.length], videoSourceType: 'external', transcript: `Transcript for ${topic}.`, notes: `Key points for ${topic}.`, elements: [] },
        completed: false,
        order: 1
      },
      {
        id: generateId('lesson'),
        title: `${topic} — Scenario Exercise`,
        type: 'interactive',
        duration: '10 min',
        content: { elements: [{ id: generateId('interactive'), type: 'scenario', title: `${topic} Scenario`, order: 1, data: [{ id: generateId('scenario'), title: 'The Situation', text: `You encounter a scenario related to ${topic}. Choose how to respond.`, choices: [{ id: generateId('choice'), text: 'Take corrective public action', feedback: 'May have mixed outcomes', isCorrect: false }, { id: generateId('choice'), text: 'Hold a private conversation', feedback: 'Good for context and trust', isCorrect: true }] }] }] },
        completed: false,
        order: 2
      },
      {
        id: generateId('lesson'),
        title: `${topic} — Quick Check`,
        type: 'quiz',
        duration: '5 min',
        content: { questions: [{ id: generateId('question'), text: `Which action best supports ${topic}?`, options: ['Option A', 'Option B', 'Option C'], correctAnswerIndex: 1, explanation: 'Option B is best because...' }], passingScore: 60 },
        completed: false,
        order: 3
      }
    ];

    return { id: generateId('module'), title: topic, description: `Auto-generated module about ${topic}`, duration: '23 min', order: idx + 1, lessons, resources: [] };
  });

  const course = {
    id,
    title,
    description: `AI-generated DEIA training for ${seed.audience || 'organizations'}. Generated in ${seed.length || 'short'} format.`,
    status: 'draft',
    thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg',
    duration: `${modules.length * 23} min`,
    difficulty: 'Beginner',
    enrollments: 0,
    completions: 0,
    completionRate: 0,
    avgRating: 0,
    totalRatings: 0,
    createdBy: 'AI Course Creator',
    createdDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    estimatedTime: `${modules.length * 23} minutes`,
    prerequisites: [],
    learningObjectives: [`Understand ${seed.audience || 'workplace'} DEIA fundamentals`, 'Be able to apply inclusive practices'],
    certification: { available: false, name: '', requirements: [], validFor: '1 year', renewalRequired: false },
    tags: ['DEIA', 'AI-generated', 'Training'],
    modules,
    keyTakeaways: ['DEIA context', 'Practical steps', 'Reflection prompts'],
    type: 'Video + Interactive',
    lessons: modules.reduce((sum, m) => sum + m.lessons.length, 0),
    rating: 0,
    progress: 0
  };

  return course;
}

module.exports = mockAIGenerateDEIACourse;
