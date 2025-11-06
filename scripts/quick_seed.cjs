#!/usr/bin/env node

/**
 * Quick seed - adds Foundations course directly to database
 * Bypasses rate limiting by using minimal requests
 */

const http = require('http');

const courseData = JSON.stringify({
  course: {
    id: 'foundations',
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Build the fundamental skills needed to lead with empathy and create psychological safety for your team.',
    status: 'published',
    version: 1,
    meta: {
      thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800'
    }
  },
  modules: [{
    id: 'module-1',
    title: 'Introduction to Inclusive Leadership',
    description: 'Core concepts and principles',
    order_index: 0,
    lessons: [
      {
        id: 'lesson-1-1',
        title: 'What is Inclusive Leadership?',
        description: 'Learn the core principles',
        type: 'video',
        order_index: 0,
        duration_s: 480,
        content_json: {
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        }
      },
      {
        id: 'lesson-1-2',
        title: 'The Business Case',
        type: 'text',
        order_index: 1,
        duration_s: 300,
        content_json: { content: '<p>Why inclusion matters...</p>' }
      },
      {
        id: 'lesson-1-3',
        title: 'Psychological Safety',
        type: 'text',
        order_index: 2,
        duration_s: 420,
        content_json: { content: '<p>Building trust...</p>' }
      },
      {
        id: 'lesson-1-4',
        title: 'Leadership Reflection',
        type: 'reflection',
        order_index: 3,
        duration_s: 600,
        content_json: { prompt: 'Reflect on your leadership style' }
      }
    ]
  }]
});

const options = {
  hostname: 'localhost',
  port: 8787,
  path: '/api/admin/courses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(courseData),
    'X-User-Id': 'admin',
    'X-User-Role': 'admin'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => data += chunk);
  
  res.on('end', () => {
    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('✅ Course created successfully!');
      try {
        const result = JSON.parse(data);
        console.log(`   Title: ${result.data?.title}`);
        console.log(`   Lessons: ${result.data?.modules?.[0]?.lessons?.length || 0}`);
      } catch (e) {
        console.log('   Response:', data);
      }
    } else {
      console.error(`❌ Failed: ${res.statusCode}`);
      console.error(data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
});

// Wait a moment to avoid rate limiting
setTimeout(() => {
  req.write(courseData);
  req.end();
}, 2000);

console.log('🌱 Seeding course (waiting for rate limit)...\n');
