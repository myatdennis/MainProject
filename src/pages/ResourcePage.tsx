import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { Download, CheckCircle, FileText, Video, Users, Calendar, ArrowRight } from 'lucide-react';

import { LazyImage } from '../components/PerformanceComponents';

const ResourcePage = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [organization, setOrganization] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would integrate with your email service (Mailchimp, ConvertKit, etc.)
    setIsSubmitted(true);
  };

  const additionalResources = [
    {
      icon: <FileText className="h-8 w-8 text-blue-500" />,
      title: "DEI Assessment Checklist",
      description: "Evaluate your organization's current state of diversity, equity, and inclusion with our comprehensive 50-point checklist.",
      type: "PDF Download",
      action: "Download Free"
    },
    {
      icon: <Video className="h-8 w-8 text-green-500" />,
      title: "Courageous Conversations Masterclass",
      description: "45-minute recorded session on navigating difficult discussions with empathy and skill.",
      type: "Video Training",
      action: "Watch Now"
    },
    {
      icon: <Users className="h-8 w-8 text-orange-500" />,
      title: "Monthly DEI Leaders Circle",
      description: "Join our virtual community of practice for DEI leaders. Share challenges, celebrate wins, and learn together.",
      type: "Community",
      action: "Join Circle"
    }
  ];

  const benefits = [
    "Evidence-based practices you can implement immediately",
    "Real-world examples from successful organizations", 
    "Self-assessment tools to identify growth areas",
    "Communication scripts for difficult conversations",
    "Metrics and measurement frameworks",
    "Action planning templates and worksheets"
  ];

  const navigate = useNavigate();

  if (isSubmitted) {
    return (
      <PageWrapper>
        <div className="centered">
          <div className="card-md max-w-48rem mx-auto">
            <div className="centered mb-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{background: 'var(--success-bg)'}}>
                <CheckCircle className="h-10 w-10 text-success" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-neutral-text mb-3">Success! Check Your Email</h1>
            <p className="muted-text mb-4">We've sent you the "10 Inclusive Leadership Practices" guide along with some bonus resources. Check your inbox (and spam folder) for the email from Mya at The Huddle Co.</p>
            <div className="card-md mb-4">
              <h3 className="font-semibold text-neutral-text mb-2">What's Next?</h3>
              <p className="muted-text">Ready to put these practices into action? Book a free 30-minute consultation to discuss how we can support your organization's inclusive leadership journey.</p>
            </div>
            <button onClick={() => navigate('/contact')} className="btn-primary primary-gradient inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Schedule Free Consultation</span>
            </button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Hero Section */}
      <section className="py-16">
        <div>
          <div className="grid grid-cols-1 gap-12 items-center">
            <div>
              <h1 style={{fontSize: '2rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '1rem'}}>Free Resource: 10 Inclusive Leadership Practices</h1>
              <p style={{fontSize: '1.125rem', color: 'var(--muted-text)', marginBottom: '1.5rem'}}>Transform your leadership approach with proven strategies that create psychological safety, build trust, and empower every team member to contribute their best work.</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem'}}>
                {benefits.slice(0, 3).map((benefit, index) => (
                  <div key={index} style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                    <CheckCircle style={{height: '1.25rem', width: '1.25rem', color: 'var(--success)'}} />
                    <span style={{color: 'var(--neutral-text)'}}>{benefit}</span>
                  </div>
                ))}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent)'}}>
                <Download style={{height: '1rem', width: '1rem'}} />
                <span style={{fontWeight: 600}}>Instant download • No spam • Unsubscribe anytime</span>
              </div>
            </div>
            <div>
              <LazyImage
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Inclusive leadership guide preview"
                className="img-rounded"
                fallbackSrc="/placeholder-image.png"
                placeholder={<div className="img-rounded bg-gray-200 animate-pulse" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Download Form */}
      <section className="container">
        <div className="card-md">
          <div className="centered mb-6">
            <h2 className="text-xl font-bold text-neutral-text mb-2">Get Your Free Leadership Guide</h2>
            <p className="muted-text">Join 2,000+ leaders who have transformed their teams with these inclusive practices.</p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="text-sm font-semibold muted-text block mb-2">First Name *</label>
                <input className="input" id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Enter your first name" />
              </div>
              <div>
                <label htmlFor="email" className="text-sm font-semibold muted-text block mb-2">Email Address *</label>
                <input className="input" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
              </div>
            </div>
            <div>
              <label htmlFor="organization" className="text-sm font-semibold muted-text block mb-2">Organization (Optional)</label>
              <input className="input" id="organization" type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your company or organization" />
            </div>
            <button type="submit" className="btn-primary primary-gradient w-full inline-flex justify-center items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Download Free Guide</span>
            </button>
          </form>

          <p className="centered text-sm muted-text mt-4">By downloading this guide, you'll also receive our weekly newsletter with leadership tips and DEI insights. You can unsubscribe at any time.</p>
        </div>
      </section>

      {/* What's Inside */}
      <section style={{background: 'var(--background-muted)', padding: '4rem 0'}}>
        <div>
          <div style={{textAlign: 'center', marginBottom: '2rem'}}>
            <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.5rem'}}>What's Inside the Guide</h2>
            <p style={{fontSize: '1.125rem', color: 'var(--muted-text)', maxWidth: '48rem', margin: '0 auto'}}>This comprehensive 24-page guide gives you everything you need to start leading more inclusively today.</p>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem'}}>
            {benefits.map((benefit, index) => (
              <div key={index} style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <CheckCircle style={{height: '1.5rem', width: '1.5rem', color: 'var(--success)'}} />
                <span style={{color: 'var(--neutral-text)'}}>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Resources */}
      <section style={{padding: '4rem 0'}}>
        <div style={{maxWidth: '72rem', margin: '0 auto'}}>
          <div style={{textAlign: 'center', marginBottom: '2rem'}}>
            <h2 style={{fontSize: '1.5rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.5rem'}}>More Free Resources</h2>
            <p style={{fontSize: '1.125rem', color: 'var(--muted-text)', maxWidth: '48rem', margin: '0 auto'}}>Continue your learning journey with these additional tools and resources.</p>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem'}}>
            {additionalResources.map((resource, index) => (
              <div key={index} style={{background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '1rem', boxShadow: 'var(--elevation-2)'}}>
                <div style={{marginBottom: '1rem'}}>{resource.icon}</div>
                <h3 style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--neutral-text)', marginBottom: '0.75rem'}}>{resource.title}</h3>
                <p style={{color: 'var(--muted-text)', marginBottom: '1rem'}}>{resource.description}</p>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <span style={{fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 600}}>{resource.type}</span>
                  <button onClick={() => {
                    if (resource.type.includes('Download')) navigate('/resources');
                    else if (resource.type.includes('Video')) navigate('/lms/courses');
                    else navigate('/resources');
                  }} style={{background: 'var(--muted-button-bg)', color: 'var(--muted-button-text)', padding: '0.5rem 0.75rem', borderRadius: '999px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'}}>
                    <span>{resource.action}</span>
                    <ArrowRight style={{height: '1rem', width: '1rem'}} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{background: 'var(--primary-gradient)', padding: '4rem 0', borderRadius: '1rem'}}>
        <div style={{maxWidth: '72rem', margin: '0 auto', textAlign: 'center'}}>
          <h2 style={{fontSize: '1.75rem', fontWeight: 700, color: 'var(--button-text)', marginBottom: '0.75rem'}}>Ready to Go Deeper?</h2>
          <p style={{fontSize: '1.125rem', color: 'var(--button-muted)', marginBottom: '1rem', maxWidth: '40rem', marginLeft: 'auto', marginRight: 'auto'}}>These resources are just the beginning. Let's discuss how we can create a custom DEI strategy for your organization.</p>
          <button onClick={() => navigate('/contact')} style={{background: 'var(--button-bg)', color: 'var(--primary)', padding: '0.75rem 1.25rem', borderRadius: '999px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'inline-flex', gap: '0.5rem', alignItems: 'center'}}>
            <Calendar style={{height: '1.25rem', width: '1.25rem'}} />
            <span>Schedule Discovery Call</span>
          </button>
        </div>
      </section>
    </PageWrapper>
  );
};

export default ResourcePage;