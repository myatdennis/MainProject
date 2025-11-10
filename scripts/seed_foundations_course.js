#!/usr/bin/env node

/**
 * Seed the "Foundations of Inclusive Leadership" course to the database
 * Run with: node scripts/seed_foundations_course.js
 */

const API_BASE = 'http://localhost:8888';

// Simplified course data that matches the database schema
const foundationsCourse = {
  course: {
    id: 'foundations',
    slug: 'foundations-of-inclusive-leadership',
    title: 'Foundations of Inclusive Leadership',
    description: 'Build the fundamental skills needed to lead with empathy and create psychological safety for your team.',
    status: 'published',
    version: 1,
    meta: {
      thumbnail: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=800',
      difficulty: 'Beginner',
      tags: ['Leadership', 'Empathy', 'Psychological Safety']
    }
  },
  modules: [
    {
      id: 'module-1',
      title: 'Introduction to Inclusive Leadership',
      description: 'Explore the foundations and principles of inclusive leadership',
      order_index: 0,
      lessons: [
        {
          id: 'lesson-1-1',
          title: 'What is Inclusive Leadership?',
          description: 'Learn the core principles and importance of inclusive leadership',
          type: 'video',
          order_index: 0,
          duration_s: 480, // 8 minutes
          content_json: {
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            transcript: 'Welcome to our comprehensive course on inclusive leadership...',
            notes: 'Key concepts: empathy, psychological safety, authentic leadership'
          },
          completion_rule_json: null
        },
        {
          id: 'lesson-1-2',
          title: 'The Business Case for Inclusion',
          description: 'Understand why inclusion matters for business success',
          type: 'quiz',
          order_index: 1,
          duration_s: 420, // 7 minutes
          content_json: {
            title: 'Meeting Dynamics Challenge',
            description: 'Practice identifying and addressing inclusion challenges in team meetings'
          },
          completion_rule_json: null
        },
        {
          id: 'lesson-1-3',
          title: 'Building Psychological Safety',
          description: 'Learn techniques to create psychological safety in your team',
          type: 'text',
          order_index: 2,
          duration_s: 600, // 10 minutes
          content_json: {
            content: '<h2>What is Psychological Safety?</h2><p>Psychological safety is the belief that you won\'t be punished or humiliated for speaking up with ideas, questions, concerns, or mistakes.</p>'
          },
          completion_rule_json: null
        },
        {
          id: 'lesson-1-4',
          title: 'Leadership Reflection',
          description: 'Reflect on your leadership style and create an action plan',
          type: 'resource',
          order_index: 3,
          duration_s: 1200, // 20 minutes
          content_json: {
            title: 'Leadership Reflection Worksheet',
            description: 'Complete this worksheet to reflect on your leadership journey'
          },
          completion_rule_json: null
        }
      ]
    }
  ]
};

async function seedCourse() {
  console.log('🌱 Seeding "Foundations of Inclusive Leadership" course...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/admin/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'admin',
        'X-User-Role': 'admin'
      },
      body: JSON.stringify(foundationsCourse)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create course: ${response.status} ${response.statusText}\n${error}`);
    }

    const result = await response.json();
    console.log('✅ Course created successfully!');
    console.log(`   ID: ${result.data?.id}`);
    console.log(`   Title: ${result.data?.title}`);
    console.log(`   Modules: ${result.data?.modules?.length || 0}`);
    console.log(`   Lessons: ${result.data?.modules?.[0]?.lessons?.length || 0}`);
    console.log('\n🎉 Database seeded! You can now view the course in the LMS.');
    
  } catch (error) {
    console.error('❌ Error seeding course:', error.message);
    process.exit(1);
  }
}

// Run the seed function
seedCourse();
