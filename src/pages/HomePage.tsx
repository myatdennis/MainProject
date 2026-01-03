// React import not required with the new JSX transform
import React from 'react';
import { useRoutePrefetch } from '../hooks/useRoutePrefetch';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight,
  Users,
  Heart,
  MessageSquare,
  Target,
  Download,
  Calendar,
  Sparkles
} from 'lucide-react';
import { LazyImage } from '../components/PerformanceComponents';
import BookingWidget from '../components/BookingWidget/BookingWidget';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const HomePage = () => {
  const navigate = useNavigate();
  // Prefetch critical user paths for fast navigation
  useRoutePrefetch([
    '/client-portal',
    '/admin/dashboard',
    '/admin/courses',
    '/admin/analytics',
    '/client/dashboard',
    '/client/courses',
  ]);
  const [showBookingWidget, setShowBookingWidget] = React.useState(false);

  const features = [
    {
      icon: <Users className="icon-32 text-skyblue" />,
      title: 'Inclusive leadership',
      description:
        'Short, practical courses that help managers build trust, give clearer feedback, and lead teams where everyone contributes.'
    },
    {
      icon: <MessageSquare className="icon-32 text-sunrise" />,
      title: 'Courageous conversations',
      description:
        'Tools and coaching to hold difficult conversations with care so issues get resolved and relationships strengthen.'
    },
    {
      icon: <Target className="icon-32 text-forest" />,
      title: 'DEI that lasts',
      description:
        'Practical planning and simple process changes that turn good intentions into measurable results.'
    }
  ];

  const stats = [
    { number: '500+', label: 'Leaders trained' },
    { number: '150+', label: 'Organizations partnered' },
    { number: '98%', label: 'Satisfaction' },
    { number: '3x', label: 'Average engagement lift' }
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-softwhite py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,140,26,0.3),transparent_55%),radial-gradient(circle_at_top_right,rgba(43,132,198,0.25),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(59,170,102,0.25),transparent_45%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_440px]">
            <div>
              <Badge tone="info" className="bg-white/80 text-skyblue">
                The Huddle Co.
              </Badge>
              <h1 className="mt-4 font-heading text-4xl font-black leading-tight text-charcoal md:text-[3.2rem]">
                Where teams become{' '}
                <span className="bg-gradient-to-r from-sunrise via-skyblue to-forest bg-clip-text text-transparent">
                  trusting, inclusive, and human.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-slate/80">
                We pair practical learning with live support, helping leaders build psychological safety,
                deliver courageous feedback, and embed inclusion into daily rituals.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Button size="lg" leadingIcon={<Calendar className="h-4 w-4" />} onClick={() => setShowBookingWidget(true)}>
                  Book a discovery call
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  leadingIcon={<Download className="h-4 w-4" />}
                  className="bg-white"
                >
                  <Link to="/resources">Download the leadership guide</Link>
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate/70">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm">
                  <Sparkles className="h-4 w-4 text-sunrise" />
                  Trusted by 150+ organizations
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-card-sm">
                  <Users className="h-4 w-4 text-skyblue" />
                  500+ leaders certified
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[420px]">
              <LazyImage
                src="https://images.pexels.com/photos/3184675/pexels-photo-3184675.jpeg?auto=compress&cs=tinysrgb&w=1200"
                webpSrc="https://images.pexels.com/photos/3184675/pexels-photo-3184675.webp?auto=compress&cs=tinysrgb&w=1200"
                avifSrc="/pexels-photo-3184675.avif"
                alt="Inclusive team collaboration"
                className="w-full rounded-[28px] border border-white/60 shadow-[0_32px_60px_rgba(16,24,40,0.18)]"
                sizes="(max-width: 600px) 100vw, 420px"
                fallbackSrc="/placeholder-image.png"
                placeholder={<div className="w-full h-[280px] rounded-[28px] bg-mutedgrey animate-pulse" />}
              />
              <Card tone="muted" padding="sm" className="absolute -bottom-5 left-6 flex w-[260px] items-center gap-3 rounded-2xl border border-white/80 bg-white/90 shadow-card-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sunrise/15 text-sunrise">
                  <Heart className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-heading text-sm font-semibold text-charcoal">Programs built on empathy</p>
                  <p className="text-xs text-slate/70">Rooted in belonging, backed by results.</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} tone="muted" className="py-8">
                <div className="font-heading text-3xl font-bold text-charcoal">{stat.number}</div>
                <p className="mt-2 text-sm text-slate/70">{stat.label}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-softwhite py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="text-center">
            <Badge tone="info" className="mx-auto bg-skyblue/10 text-skyblue">
              What we deliver
            </Badge>
            <h2 className="mt-4 font-heading text-3xl font-bold text-charcoal">
              How we help teams do better work together
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-base text-slate/80">
              Short, practical learning, hands-on coaching, and simple process changes so inclusion is woven into everyday work—not just the workshop.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="h-full p-6">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="font-heading text-xl font-semibold text-charcoal">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate/80">{feature.description}</p>
                <Link to="/services" className="mt-4 inline-flex items-center font-heading text-sm font-semibold text-skyblue">
                  Learn more <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <div className="text-center">
            <Badge tone="info" className="mx-auto bg-sunrise/15 text-sunrise">
              Partners
            </Badge>
            <h2 className="mt-4 font-heading text-3xl font-bold text-charcoal">
              Trusted by organizations across sectors
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate/80">
              Universities, sports leagues, nonprofits, government agencies, and corporations rely on The Huddle Co. to build inclusive cultures.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {['University partners', 'Sports organizations', 'Nonprofits', 'Corporations'].map((label) => (
              <Card key={label} tone="muted" className="py-6 text-center font-heading text-sm font-semibold text-charcoal">
                {label}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-r from-sunrise via-skyblue to-forest" />
        <div className="relative mx-auto max-w-7xl px-6 text-center text-white lg:px-12">
          <h2 className="font-heading text-3xl font-bold">Ready to transform your organization?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-white/90">
            Join leaders who have built more inclusive, empathetic workplaces with our practical, evidence-based methods.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="border-white/60 bg-white text-sunrise hover:bg-white/95"
              leadingIcon={<Calendar className="h-4 w-4" />}
              onClick={() => navigate('/contact')}
            >
              Schedule a discovery call
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
              leadingIcon={<Download className="h-4 w-4" />}
            >
              <Link to="/resources">Get the leadership guide</Link>
            </Button>
          </div>
        </div>
      </section>

      <BookingWidget isOpen={showBookingWidget} onClose={() => setShowBookingWidget(false)} />
    </div>
  );
};

export default HomePage;
