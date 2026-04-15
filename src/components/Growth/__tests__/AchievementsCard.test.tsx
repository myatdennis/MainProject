import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AchievementsCard from '../AchievementsCard';

describe('AchievementsCard', () => {
  it('renders a fallback title when an achievement type is missing', () => {
    render(
      <MemoryRouter>
        <AchievementsCard
          achievements={[
            { achievement_type: undefined as any, achieved_at: '2025-01-01T00:00:00Z' },
          ]}
          loading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Achievement')).toBeInTheDocument();
  });
});
