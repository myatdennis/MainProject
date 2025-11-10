const http = require('http');

const payload = {
  course: {
    id: 'foundations',
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Build the essential skills and knowledge to lead inclusively in today\'s diverse workplace.',
    thumbnail: '/placeholder-course.jpg',
    difficulty: 'Beginner',
    duration: '45 min',
    level: 'beginner',
    estimatedDurationHours: 4,
    status: 'published'
  },
  modules: [
      {
        id: 'mod-1',
        courseId: 'foundations',
        title: 'Understanding Inclusive Leadership',
        description: 'Explore the core concepts and importance of inclusive leadership',
        orderIndex: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            moduleId: 'mod-1',
            title: 'Racism Has a Cost for Everyone',
            type: 'video',
            orderIndex: 1,
            description: 'Learn from Heather C. McGhee about how racism has economic costs that affect everyone in society.',
            duration_s: 900,
            content_json: {
              videoUrl: 'https://www.ted.com/talks/heather_c_mcghee_racism_has_a_cost_for_everyone',
              videoType: 'ted',
              transcript: 'TED Talk by Heather C. McGhee exploring the economic and social costs of racism.'
            },
            completion_rule_json: {
              type: 'time_spent',
              requiredSeconds: 720
            }
          },
          {
            id: 'lesson-1-2',
            moduleId: 'mod-1',
            title: 'Knowledge Check: Inclusive Leadership Basics',
            type: 'quiz',
            orderIndex: 2,
            description: 'Test your understanding of key inclusive leadership concepts',
            duration_s: 600,
            content_json: {
              questions: [
                {
                  id: 'q1',
                  text: 'What is the primary goal of inclusive leadership?',
                  type: 'multiple_choice',
                  options: [
                    { id: 'a', text: 'Increase profits', correct: false },
                    { id: 'b', text: 'Create environments where all voices are heard and valued', correct: true },
                    { id: 'c', text: 'Reduce team size', correct: false },
                    { id: 'd', text: 'Standardize work processes', correct: false }
                  ]
                }
              ],
              passingScore: 70
            },
            completion_rule_json: {
              type: 'quiz_score',
              passingScore: 70
            }
          },
          {
            id: 'lesson-1-3',
            moduleId: 'mod-1',
            title: 'The Business Case for Inclusion',
            type: 'text',
            orderIndex: 3,
            description: 'Read about the proven benefits of inclusive workplace practices',
            duration_s: 900,
            content_json: {
              content: '# The Business Case for Inclusion\n\nInclusive leadership drives measurable business outcomes...'
            },
            completion_rule_json: {
              type: 'time_spent',
              requiredSeconds: 600
            }
          },
          {
            id: 'lesson-1-4',
            moduleId: 'mod-1',
            title: 'Inclusive Leadership Framework Guide',
            type: 'resource',
            orderIndex: 4,
            description: 'Download our comprehensive framework for implementing inclusive leadership',
            duration_s: 300,
            content_json: {
              resourceType: 'pdf',
              resourceUrl: '/resources/inclusive-leadership-framework.pdf',
              fileSize: '2.5 MB'
            },
            completion_rule_json: {
              type: 'manual'
            }
          }
        ]
      }
    ]
};

const postData = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/api/admin/courses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-User-Role': 'admin',
    'X-User-Id': 'admin-user',
    'X-Org-Id': 'demo-org'
  }
};

console.log('🎬 Updating Foundations course with TED Talk and published status...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Success! Course updated and published');
      console.log('📺 Video: Racism Has a Cost for Everyone by Heather C. McGhee');
      console.log('🌍 Status: Published (visible in client portal)');
      console.log('\nRefresh your browser to see the course!');
    } else {
      console.log(`❌ Failed: ${res.statusCode}`);
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\nMake sure the server is running on localhost:8888');
});

req.write(postData);
req.end();
