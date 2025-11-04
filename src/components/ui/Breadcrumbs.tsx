import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
  separator?: React.ReactNode;
  className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, separator = '/', className }) => {
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumbs ${className ?? ''}`.trim()}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-2">
            {item.to && !isLast ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span className="current" aria-current="page">{item.label}</span>
            )}
            {!isLast && <span aria-hidden="true">{separator}</span>}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
