import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import SEO from '../../components/SEO/SEO';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import { useSecureAuth } from '../../context/SecureAuthContext';
import { courseStore } from '../../store/courseStore';
import { getAssignmentsForUser } from '../../utils/assignmentStorage';
import { fetchAssignedSurveysForLearner, type LearnerSurveyAssignment } from '../../dal/surveys';
import type { CourseAssignment } from '../../types/assignment';
import { LoadingSpinner } from '../../components/LoadingComponents';

const ClientProfile = () => {
  const { user } = useSecureAuth();
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignment[]>([]);
  const [surveyAssignments, setSurveyAssignments] = useState<LearnerSurveyAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const allCourses = useSyncExternalStore(courseStore.subscribe, courseStore.getAllCourses);

  const learnerId = useMemo(() => {
    if (user?.id) return String(user.id).toLowerCase();
    if (user?.email) return user.email.toLowerCase();
    return 'local-user';
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!learnerId) {
        if (isMounted) {
          setCourseAssignments([]);
          setSurveyAssignments([]);
          setIsLoadingAssignments(false);
          setAssignmentError(null);
        }
        return;
      }

      setIsLoadingAssignments(true);
      setAssignmentError(null);

      try {
        if (courseStore.getAllCourses().length === 0) {
          await courseStore.init({ reason: 'client_profile' });
        }

        const [courses, surveys] = await Promise.all([
          getAssignmentsForUser(learnerId),
          fetchAssignedSurveysForLearner(),
        ]);

        if (!isMounted) return;

        setCourseAssignments(courses.filter((entry) => (entry.assignmentType ?? 'course') === 'course'));
        setSurveyAssignments(surveys);
      } catch (error) {
        console.error('[ClientProfile] Failed to load assigned content', error);
        if (!isMounted) return;
        setCourseAssignments([]);
        setSurveyAssignments([]);
        setAssignmentError('Assigned courses and surveys are unavailable right now. Please retry.');
      } finally {
        if (isMounted) {
          setIsLoadingAssignments(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [learnerId]);

  const courseTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    allCourses.forEach((course) => {
      if (course?.id && course?.title) {
        map.set(String(course.id), String(course.title));
      }
    });
    return map;
  }, [allCourses]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <SEO title="My Profile" description="Manage your profile and preferences." />
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/client/dashboard' }, { label: 'Profile', to: '/client/profile' }]} />
      <Card tone="muted" className="mt-4 space-y-3">
        <h1 className="font-heading text-2xl font-bold text-charcoal">My Profile</h1>
        <div className="text-sm text-slate/80">
          <div><span className="font-semibold">Name:</span> {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' : '—'}</div>
          <div><span className="font-semibold">Email:</span> {user?.email || '—'}</div>
          <div><span className="font-semibold">Role:</span> {user?.role || '—'}</div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/client/dashboard">← Back to dashboard</Link>
          </Button>
        </div>
      </Card>

      <Card tone="muted" className="mt-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Assigned learning</h2>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/client/courses">View courses</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/client/surveys">View surveys</Link>
            </Button>
          </div>
        </div>

        {isLoadingAssignments ? (
          <div className="py-2">
            <LoadingSpinner size="md" text="Loading assigned courses and surveys…" />
          </div>
        ) : assignmentError ? (
          <p className="text-sm text-rose-700">{assignmentError}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-charcoal">Courses ({courseAssignments.length})</h3>
              {courseAssignments.length === 0 ? (
                <p className="text-sm text-slate/70">No courses assigned yet.</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate/90">
                  {courseAssignments.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="rounded border border-cloud px-2 py-1">
                      {entry.courseId ? courseTitleMap.get(String(entry.courseId)) ?? String(entry.courseId) : 'Course unavailable'}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-charcoal">Surveys ({surveyAssignments.length})</h3>
              {surveyAssignments.length === 0 ? (
                <p className="text-sm text-slate/70">No surveys assigned yet.</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate/90">
                  {surveyAssignments.slice(0, 6).map((entry) => (
                    <li key={entry.assignment.id} className="rounded border border-cloud px-2 py-1">
                      {entry.survey?.title || entry.assignment.surveyId || 'Survey'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientProfile;
