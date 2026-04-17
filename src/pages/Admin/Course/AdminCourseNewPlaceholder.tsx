import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import Loading from '../../../components/ui/Loading';

// /admin/courses/new redirects to the full Course Builder
const AdminCourseNewPlaceholder = () => {
	const navigate = useNavigate();

	useEffect(() => {
		navigate('/admin/course-builder/new', { replace: true });
	}, [navigate]);

	return (
		<div className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-12">
			<Card tone="muted" className="w-full text-center" padding="lg">
				<div className="mx-auto mb-4 flex justify-center">
					<Loading size="md" />
				</div>
				<h1 className="font-heading text-xl font-semibold text-charcoal">Opening Course Builder</h1>
				<p className="mt-2 text-sm text-slate/75">
					Taking you to the full builder experience with module, lesson, quiz, and publish controls.
				</p>
				<div className="mt-4">
					<Link to="/admin/course-builder/new" className="text-sm font-medium text-skyblue hover:underline">
						Continue manually
					</Link>
				</div>
			</Card>
		</div>
	);
};

export default AdminCourseNewPlaceholder;
