import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileUpdateSchema } from '@ccp/shared';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useAction, useGet } from '../../api/hooks.js';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { MutationError } from '../../components/ui/QueryState.jsx';

/** FR-PROF-01: academic profile with participation counts. Username and email are read-only. */
export function ProfilePage() {
  const { user, memberships, reload, platformRole } = useAuth();
  const acts = useGet(['activities', 'all'], '/me/activities', { enabled: platformRole === 'student' });
  const [saved, setSaved] = useState(false);
  const save = useAction({
    onSuccess: async () => {
      await reload();
      setSaved(true);
    },
  });
  const regs = acts.data?.registrations ?? [];
  const counts = {
    registered: regs.filter((r) => r.status !== 'cancelled').length,
    attended: regs.filter((r) => r.status === 'attended').length,
    missed: regs.filter((r) => r.status === 'no_show').length,
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      fullName: user.fullName,
      rollNumber: user.rollNumber ?? '',
      department: user.department ?? '',
      yearOfStudy: user.yearOfStudy ?? '',
      phone: user.phone ?? '',
    },
  });
  const onSubmit = (v) => {
    setSaved(false);
    save.mutate({ method: 'PATCH', path: '/me/profile', body: { ...v, phone: v.phone || null } });
  };

  return (
    <>
      <PageBanner title="Profile" description="Your academic details, clubs and participation." />
      <div className="two-col">
        <Card>
          <h2>Details</h2>
          <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormField label="Full name" error={errors.fullName?.message} {...register('fullName')} />
            <FormField label="Roll number" error={errors.rollNumber?.message} {...register('rollNumber')} />
            <FormField label="Department" error={errors.department?.message} {...register('department')} />
            <FormField
              label="Year of study"
              type="number"
              error={errors.yearOfStudy?.message}
              {...register('yearOfStudy')}
            />
            <FormField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <FormField
              label="Username"
              value={user.username}
              readOnly
              help="Username cannot be changed"
              onChange={() => {}}
            />
            <FormField
              label="College email"
              value={user.email}
              readOnly
              help="Email cannot be changed"
              onChange={() => {}}
            />
            <Button type="submit" disabled={!isDirty || save.isPending}>
              Save changes
            </Button>
            {saved && (
              <p className="notice notice-ok" role="status">
                Profile saved.
              </p>
            )}
            <MutationError mutation={save} />
          </form>
        </Card>
        <div className="stack">
          {platformRole === 'student' && (
            <Card>
              <h2>Participation</h2>
              <dl className="profile-grid">
                <div>
                  <dt className="muted small">Events registered</dt>
                  <dd>{counts.registered}</dd>
                </div>
                <div>
                  <dt className="muted small">Attended</dt>
                  <dd>{counts.attended}</dd>
                </div>
                <div>
                  <dt className="muted small">Missed</dt>
                  <dd>{counts.missed}</dd>
                </div>
              </dl>
            </Card>
          )}
          <Card>
            <h2>Clubs joined</h2>
            {memberships.length === 0 ? (
              <p className="muted">You are not a member of any club yet.</p>
            ) : (
              <ul>
                {memberships.map((m) => (
                  <li key={m.club.id}>
                    {m.club.name}: <span className="pill">{m.roleName}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
