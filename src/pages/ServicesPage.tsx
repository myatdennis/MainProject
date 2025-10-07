// React import not required with the new JSX transform
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Target, Clock, CheckCircle, ArrowRight, Calendar } from 'lucide-react';

const ServicesPage = () => {
  const services = [
    {
      icon: <Users className="h-12 w-12 text-blue-500" />,
      title: "Inclusive Leadership Mini-Workshop",
      duration: "Half-day intensive",
      price: "Starting at $2,500",
      description: "Transform your leadership approach with practical tools for creating psychological safety and empowering diverse teams.",
      features: [
        "Interactive leadership assessment",
        "Bias recognition and mitigation strategies",
        "Communication techniques for inclusive dialogue",
        "Action planning for immediate implementation",
        "Follow-up coaching session included"
      ],
      ideal: ["New leaders", "Management teams", "HR professionals", "Department heads"]
    },
    {
      icon: <MessageSquare className="h-12 w-12 text-green-500" />,
      title: "Courageous Conversations Facilitation",
      duration: "Full-day workshop",
      price: "Starting at $4,000",
      description: "Navigate difficult discussions with confidence while creating safe spaces for meaningful dialogue and conflict resolution.",
      features: [
        "Framework for difficult conversations",
        "Active listening and empathy techniques",
        "De-escalation strategies",
        "Creating psychological safety",
        "Real-time practice with feedback"
      ],
      ideal: ["Leadership teams", "HR departments", "Team managers", "Conflict resolution specialists"]
    },
    {
      icon: <Target className="h-12 w-12 text-orange-500" />,
      title: "Strategic DEI Planning",
      duration: "3-month engagement",
      price: "Starting at $15,000",
      description: "Develop comprehensive diversity, equity, and inclusion strategies that drive measurable organizational change.",
      features: [
        "Organizational assessment and audit",
        "Custom DEI strategy development",
        "Implementation roadmap",
        "Leadership training program",
        "Progress tracking and measurement",
        "Quarterly strategy sessions"
      ],
      ideal: ["C-suite executives", "Board members", "DEI committees", "Organizational leaders"]
    }
  ];

  const process = [
    {
      step: "1",
      title: "Discovery Call",
      description: "We'll discuss your challenges, goals, and organizational context to determine the best approach."
    },
    {
      step: "2",
      title: "Custom Proposal",
      description: "Receive a tailored proposal with specific outcomes, timeline, and investment details."
    },
    {
      step: "3",
      title: "Engagement",
      description: "Begin your transformation journey with expert facilitation and ongoing support."
    },
    {
      step: "4",
      title: "Sustained Change",
      description: "Implement lasting systems and practices that continue to drive inclusive culture."
    }
  ];

  const navigate = useNavigate();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Transform Your Organization
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Choose from our proven services designed to create inclusive, empathetic leaders and thriving organizational cultures.
          </p>
          <button onClick={() => navigate('/contact')} className="bg-gradient-to-r from-orange-400 to-red-500 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-orange-500 hover:to-red-600 transition-all duration-200 transform hover:scale-105 flex items-center mx-auto space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Start Here - Book Discovery Call</span>
          </button>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
                <div className="p-8">
                  <div className="mb-6">{service.icon}</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{service.title}</h3>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration}</span>
                    </div>
                    <div className="text-xl font-bold text-orange-500">{service.price}</div>
                  </div>
                  <p className="text-gray-600 mb-6">{service.description}</p>
                  
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">What's Included:</h4>
                    <ul className="space-y-2">
                      {service.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Ideal For:</h4>
                    <div className="flex flex-wrap gap-2">
                      {service.ideal.map((ideal, idealIndex) => (
                        <span key={idealIndex} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                          {ideal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-6">
                  <button onClick={() => navigate('/contact')} className="w-full bg-gradient-to-r from-orange-400 to-red-500 text-white py-3 rounded-full font-semibold hover:from-orange-500 hover:to-red-600 transition-all duration-200 flex items-center justify-center space-x-2">
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              How We Work Together
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our collaborative process ensures you get exactly what your organization needs to thrive.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {process.map((item, index) => (
              <div key={index} className="text-center">
                <div className="bg-gradient-to-r from-orange-400 to-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Solutions */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Need Something Custom?
            </h2>
            <p className="text-xl mb-8 max-w-3xl mx-auto opacity-90">
              Every organization is unique. We create tailored solutions for keynote speaking, 
              executive coaching, train-the-trainer programs, and long-term culture transformation initiatives.
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200">
                Discuss Custom Solutions
              </button>
              <button className="border-2 border-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-500 transition-colors duration-200">
                Download Service Overview
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-3">How do you measure success?</h3>
              <p className="text-gray-600">We use a combination of quantitative metrics (engagement surveys, retention rates, promotion diversity) and qualitative feedback (focus groups, behavioral observations, leadership assessments) to track progress and impact.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Can you work with remote teams?</h3>
              <p className="text-gray-600">Absolutely. All our services are available virtually, in-person, or in hybrid formats. We use interactive technology and facilitation techniques that create meaningful connection regardless of format.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-3">What size organizations do you work with?</h3>
              <p className="text-gray-600">We work with organizations of all sizes, from 20-person nonprofits to Fortune 500 companies. Our approach scales to meet your specific needs and budget.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-3">How quickly can we get started?</h3>
              <p className="text-gray-600">After your discovery call, we can typically provide a custom proposal within 48 hours and begin work within 2-3 weeks, depending on the scope of engagement.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;