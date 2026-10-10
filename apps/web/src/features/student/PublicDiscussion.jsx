import { useState } from 'react';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { QueryState, MutationError } from '../../components/ui/QueryState.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { fmtDateTime } from '../../utils/dates.js';

/** FR-DISC-02: public questions and answers under the club page, with reporting and moderation. */
export function PublicDiscussion({ club }) {
  const key = ['club', club.id, 'public-discussion'];
  const q = useGet(key, `/clubs/${club.id}/discussions/public/messages`);
  const { user, platformRole, can } = useAuth();
  const [text, setText] = useState('');
  const [removing, setRemoving] = useState(null);
  const post = useAction({ invalidate: [key], onSuccess: () => setText('') });
  const report = useAction({ invalidate: [key] });
  const remove = useAction({ invalidate: [key], onSuccess: () => setRemoving(null) });
  const moderator = can('discussion.moderate', club.id) || platformRole === 'osi_admin';

  return (
    <div className="stack">
      {platformRole === 'student' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            post.mutate({ path: `/clubs/${club.id}/discussions/public/messages`, body: { body: text } });
          }}
        >
          <div className="field">
            <label htmlFor="public-q">Ask the club a question</label>
            <textarea
              id="public-q"
              className="input textarea"
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!text.trim() || post.isPending}>
            Post question
          </Button>
          <MutationError mutation={post} />
        </form>
      )}
      <QueryState query={q} emptyTitle="No questions yet" emptyText="Be the first to ask.">
        {(messages) => (
          <ul className="stack msg-list">
            {messages.map((m) => (
              <li key={m.id}>
                <Card>
                  <p className="small muted">
                    {m.authorName}, {fmtDateTime(m.createdAt)}
                  </p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
                  <div className="row">
                    {m.userId !== user.id && (
                      <button
                        className="btn btn-link"
                        onClick={() =>
                          report.mutate({ path: `/discussion-messages/${m.id}/report`, body: {} })
                        }
                      >
                        Report
                      </button>
                    )}
                    {(m.userId === user.id || moderator) && (
                      <button className="btn btn-link" onClick={() => setRemoving(m.id)}>
                        Remove
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {report.isSuccess && (
        <p className="notice notice-ok" role="status">
          Thanks, the club moderators will look at it.
        </p>
      )}
      <MutationError mutation={report} />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this message?"
        message="It will disappear from the discussion for everyone."
        confirmLabel="Remove"
        danger
        busy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => remove.mutate({ method: 'DELETE', path: `/discussion-messages/${removing}` })}
      />
    </div>
  );
}
