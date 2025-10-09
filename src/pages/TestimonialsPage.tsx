import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Quote, CheckCircle, Heart, Users, TrendingUp } from 'lucide-react';

const TestimonialsPage = () => {
  const navigate = useNavigate();
  const testimonials = [
    {
      name: "Dr. Sarah Chen",
      title: "Vice President of Student Affairs",
      organization: "Pacific Coast University",
      image: "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "Mya's inclusive leadership workshop transformed how our administrative team approaches student support. We saw a 40% increase in student engagement within three months.",
      rating: 5,
      results: ["40% increase in student engagement", "Reduced administrative conflicts by 60%", "Improved cross-department collaboration"]
    },
    {
      name: "Marcus Rodriguez",
      title: "Athletic Director", 
      organization: "Mountain View High School",
      image: "https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "The courageous conversations training gave our coaching staff the tools to address sensitive issues with confidence. Our team culture has never been stronger.",
      rating: 5,
      results: ["Eliminated hazing incidents", "Increased athlete retention by 25%", "Improved parent-coach relationships"]
    },
    {
      name: "Jennifer Walsh",
      title: "Executive Director",
      organization: "Community Impact Network",
      image: "https://images.pexels.com/photos/3184394/pexels-photo-3184394.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "Our strategic DEI planning engagement with The Huddle Co. resulted in concrete changes that our entire organization can feel. The process was thorough and transformative.",
      rating: 5,
      results: ["Developed 3-year DEI strategic plan", "Increased diverse hiring by 35%", "Launched employee resource groups"]
    },
    {
      name: "Captain David Thompson",
      title: "Training Commander",
      organization: "Regional Fire Department",
      image: "https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "Mya helped us navigate some very challenging conversations about culture change. Her approach is both compassionate and direct - exactly what we needed.",
      rating: 5,
      results: ["Reduced workplace complaints by 70%", "Improved recruitment diversity", "Enhanced team communication"]
    },
    {
      name: "Lisa Park",
      title: "Chief Human Resources Officer",
      organization: "TechForward Solutions",
      image: "https://images.pexels.com/photos/3184317/pexels-photo-3184317.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "The Huddle Co.'s leadership development program gave our managers practical tools they use daily. Employee satisfaction scores reached an all-time high.",
      rating: 5,
      results: ["Employee satisfaction up 45%", "Manager confidence increased significantly", "Reduced turnover by 30%"]
    },
    {
      name: "Rev. Michael Johnson",
      title: "Senior Pastor",
      organization: "Unity Community Church",
      image: "https://images.pexels.com/photos/3184420/pexels-photo-3184420.jpeg?auto=compress&cs=tinysrgb&w=400",
      quote: "Working with Mya helped us create a more welcoming environment for all families. Her guidance through sensitive conversations was invaluable.",
      rating: 5,
      results: ["Increased congregational diversity", "Launched inclusive ministry programs", "Improved community partnerships"]
    }
  ];

  const caseStudies = [
    {
      organization: "Regional Medical Center",
      challenge: "High turnover among diverse nursing staff and communication barriers between departments.",
      solution: "6-month inclusive leadership program with monthly workshops and coaching for department heads.",
      results: [
        "Reduced nursing turnover from 32% to 18%",
        "Improved patient satisfaction scores by 23%", 
        "Decreased interdepartmental conflicts by 55%",
        "Launched mentorship program for new hires"
      ],
      testimonial: "The transformation in our workplace culture has been remarkable. Staff feel heard and valued in ways they never have before."
    },
    {
      organization: "State Government Agency",
      challenge: "Outdated policies and resistance to DEI initiatives at the management level.",
      solution: "Strategic DEI planning with executive coaching and policy review across 18 months.",
      results: [
        "Revised 47 policies for inclusive language",
        "Increased leadership diversity by 40%",
        "Implemented bias training for 1,200+ employees",
        "Created accountability metrics and tracking systems"
      ],
      testimonial: "Mya helped us move from compliance-focused thinking to genuine culture change. The results speak for themselves."
    }
  ];

  const stats = [
    { number: "98%", label: "Client Satisfaction Rate" },
    { number: "150+", label: "Organizations Served" },
    { number: "500+", label: "Leaders Trained" },
    { number: "85%", label: "Report Lasting Change" }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Real Stories, Real Results
          </h1>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            See how organizations across industries have transformed their cultures and achieved measurable improvements through our DEI programs.
          </p>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What Our Clients Say
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Leaders across universities, sports organizations, nonprofits, government agencies, and corporations share their transformation stories.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200">
                <div className="flex items-center mb-6">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900">{testimonial.name}</h3>
                    <p className="text-sm text-gray-600">{testimonial.title}</p>
                    <p className="text-sm text-orange-500 font-medium">{testimonial.organization}</p>
                  </div>
                </div>
                
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <div className="relative mb-6">
                  <Quote className="h-8 w-8 text-orange-200 absolute -top-2 -left-1" />
                  <p className="text-gray-700 pl-6 italic">{testimonial.quote}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900 text-sm">Key Results:</h4>
                  {testimonial.results.map((result, resultIndex) => (
                    <div key={resultIndex} className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{result}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              In-Depth Case Studies
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Detailed looks at how our strategic partnerships created lasting organizational change.
            </p>
          </div>
          
          <div className="space-y-12">
            {caseStudies.map((study, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-8 lg:p-12">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">{study.organization}</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div>
                      <div className="flex items-center mb-3">
                        <Heart className="h-6 w-6 text-red-500 mr-2" />
                        <h4 className="font-semibold text-gray-900">Challenge</h4>
                      </div>
                      <p className="text-gray-600">{study.challenge}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-3">
                        <Users className="h-6 w-6 text-blue-500 mr-2" />
                        <h4 className="font-semibold text-gray-900">Our Solution</h4>
                      </div>
                      <p className="text-gray-600">{study.solution}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center mb-3">
                        <TrendingUp className="h-6 w-6 text-green-500 mr-2" />
                        <h4 className="font-semibold text-gray-900">Results</h4>
                      </div>
                      <ul className="space-y-2">
                        {study.results.map((result, resultIndex) => (
                          <li key={resultIndex} className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-gray-600">{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                    <Quote className="h-6 w-6 text-orange-400 mb-2" />
                    <p className="text-gray-700 italic">{study.testimonial}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Testimonials Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              See the Impact in Action
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Watch how leaders describe their transformation experience with The Huddle Co.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-white rounded-full p-4 mb-4 mx-auto w-16 h-16 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-700">University Leadership Team</p>
                  <p className="text-sm text-gray-500">3:24 minutes</p>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Transforming Campus Culture</h3>
                <p className="text-gray-600">How one university's leadership team created a more inclusive environment for all students and staff.</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-white rounded-full p-4 mb-4 mx-auto w-16 h-16 flex items-center justify-center">
                    <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-700">Sports Organization</p>
                  <p className="text-sm text-gray-500">2:47 minutes</p>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-2">Building Team Unity</h3>
                <p className="text-gray-600">A athletic director shares how courageous conversations training strengthened team bonds and performance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-500 to-green-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Create Your Success Story?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join the leaders who have transformed their organizations with The Huddle Co. Let's discuss how we can help you achieve similar results.
          </p>
          <button 
            onClick={() => navigate('/contact')}
            className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200"
          >
            Start Your Transformation
          </button>
        </div>
      </section>
    </div>
  );
};

export default TestimonialsPage;