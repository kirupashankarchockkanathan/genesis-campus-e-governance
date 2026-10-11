import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Icon, PageHeader } from '../../components/ui';
import ClubCard from '../../components/ClubCard';
import ClubModal from '../../components/ClubModal';
import { useGov } from '../../context/GovContext';
import { useApp } from '../../context/AppContext';

export default function FavoriteClubs() {
  const { favorites } = useApp();
  const { clubs: CLUBS } = useGov();
  const [open, setOpen] = useState(null);
  const list = CLUBS.filter((c) => favorites.includes(c.id));

  return (
    <div>
      <PageHeader
        eyebrow="Your shortlist"
        title="My favorite clubs"
        subtitle="Communities you've bookmarked. Favourites don't enrol you — they just help you find them again."
        action={<Link to="/student/clubs" className="btn-ghost"><Icon name="Users" className="h-4 w-4" /> Browse directory</Link>}
      />
      {list.length === 0 ? (
        <EmptyState
          icon="HeartOff"
          title="No favourite clubs yet"
          body="Tap the heart on any club to save it here."
          action={<Link to="/student/clubs" className="btn-primary">Find clubs <Icon name="ArrowRight" className="h-4 w-4" /></Link>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => <ClubCard key={c.id} club={c} onView={setOpen} />)}
        </div>
      )}
      <ClubModal club={open} onClose={() => setOpen(null)} />
    </div>
  );
}
