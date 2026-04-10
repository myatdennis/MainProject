import { Heart, Users, Compass, Shield, TrendingUp, CheckCircle } from 'lucide-react';

const AboutPage = () => {
  const values = [
    {
      icon: <Heart className="h-8 w-8 text-red-500" />,
      title: "Belonging",
      description: "Creating spaces where every individual feels valued and accepted for who they are."
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Connection",
      description: "Building bridges between people through authentic relationships and understanding."
    },
    {
      icon: <Compass className="h-8 w-8 text-orange-500" />,
      title: "Courage",
      description: "Empowering leaders to have difficult conversations and make bold decisions."
    },
    {
      icon: <Shield className="h-8 w-8 text-green-500" />,
      title: "Accountability",
      description: "Holding ourselves and others responsible for creating positive change."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-purple-500" />,
      title: "Growth",
      description: "Fostering continuous learning and development for individuals and organizations."
    }
  ];

  const achievements = [
    'DEI Officer & ADA Coordinator, Minnesota Attorney General’s Office',
    'Nearly 10 years of experience in DEI, law, and organizational leadership',
    'Founder of The Huddle Co., a leadership and culture development platform',
    'Experienced facilitator of workshops, trainings, and courageous conversations',
    'Background in athletics and team development, shaping a “team-first” leadership philosophy'
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Meet Mya Dennis
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Founder & Lead Facilitator, The Huddle Co.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Mya Dennis is a Diversity, Equity, Inclusion, and Accessibility (DEIA) leader, legal professional, and community builder dedicated to helping organizations create environments where people feel seen, valued, and connected.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                With nearly a decade of experience working at the intersection of law, equity, and organizational culture, Mya currently serves as a DEI Officer and ADA Coordinator for the Minnesota Attorney General’s Office. In her role, she leads strategic initiatives, develops inclusive policies, and facilitates conversations that strengthen workplace culture and belonging.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                Mya founded The Huddle Co. to bring a more human-centered approach to leadership development—one rooted in empathy, trust, and real connection. Inspired by her background in sports and team dynamics, her work focuses on helping individuals and organizations better understand one another, communicate more effectively, and operate as cohesive, high-performing teams.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {achievements.map((achievement, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                    <CheckCircle className="mt-1 h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">{achievement}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/3184416/pexels-photo-3184416.jpeg?auto=compress&cs=tinysrgb&w=800"
                alt="Mya Dennis, Founder of The Huddle Co."
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-lg">
                <div className="text-2xl font-bold text-orange-500">500+</div>
                <div className="text-gray-600">Leaders Coached</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our Mission
            </h2>
            <p className="text-2xl text-gray-700 font-light max-w-4xl mx-auto leading-relaxed">
              "We create environments where people feel seen, heard, and valued."
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Seen</h3>
              <p className="text-gray-600">Every individual's unique perspective and contribution is recognized and celebrated.</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Heard</h3>
              <p className="text-gray-600">Voices at every level are amplified and valued in meaningful dialogue and decision-making.</p>
            </div>
            <div className="text-center p-6">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Valued</h3>
              <p className="text-gray-600">Everyone feels appreciated for their authentic self and empowered to contribute fully.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our Core Values
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              These five principles guide everything we do and inform our approach to creating inclusive, empathetic organizations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="mb-4">{value.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">
            Why This Work Matters
          </h2>
          <div className="prose prose-lg mx-auto text-gray-700">
            <p className="text-lg leading-relaxed mb-6">
              Mya founded The Huddle Co. to bring a more human-centered approach to leadership development—one rooted in empathy, trust, and real connection.
            </p>
            <p className="text-lg leading-relaxed mb-6">
              Inspired by her background in sports and team dynamics, Mya's work focuses on helping individuals and organizations better understand one another, communicate more effectively, and operate as cohesive, high-performing teams.
            </p>
            <p className="text-lg leading-relaxed mb-6">
              Her facilitation style blends practical strategy with real-world experience, creating spaces where people can engage in meaningful dialogue, reflect on their perspectives, and grow together.
            </p>
            <p className="text-lg leading-relaxed">
              Every workshop, conversation, and coaching engagement is designed to help teams build trust, strengthen culture, and make inclusion an everyday practice—not just an initiative.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-500 to-green-500 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Start Your Transformation?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Let's explore how we can help your organization create a culture of belonging, connection, and growth.
          </p>
          <button className="bg-white text-blue-500 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-50 transition-colors duration-200">
            Schedule Your Discovery Call
          </button>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;