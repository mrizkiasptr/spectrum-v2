import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/toast';
import { Avatar, Empty } from '../../components/ui';
import { fmtDate } from '../../domain/dates';
import { useStore } from '../../store/useStore';
import { useProjectCtx } from './ProjectLayout';

export function DocsTab() {
  const { project } = useProjectCtx();
  const allDocs = useStore((s) => s.docs);
  const members = useStore((s) => s.members);
  const addDoc = useStore((s) => s.addDoc);
  const deleteDoc = useStore((s) => s.deleteDoc);
  const docs = allDocs.filter((d) => d.projectId === project.id);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  const urlOk = /^https?:\/\/\S+\.\S+/.test(url.trim());

  return (
    <div className="page">
      <div className="col" style={{ gap: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Docs</h2>
        <p className="muted" style={{ fontSize: 13 }}>Link the BRDs, FSDs, and designs the team works from, so nobody hunts through chat.</p>
      </div>
      <form
        className="card row wrap"
        style={{ padding: 16, alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (!title.trim() || !urlOk) return;
          addDoc(project.id, title, url);
          toast(`"${title.trim()}" added.`);
          setTitle('');
          setUrl('');
          setTouched(false);
        }}
      >
        <div className="field grow" style={{ minWidth: 220 }}>
          <label className="field-label" htmlFor="doc-title">Title</label>
          <input id="doc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Refund BRD v0.4" />
          {touched && !title.trim() && <span className="field-error">Enter a title.</span>}
        </div>
        <div className="field grow" style={{ minWidth: 280 }}>
          <label className="field-label" htmlFor="doc-url">Link</label>
          <input id="doc-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" />
          {touched && !urlOk && <span className="field-error">Enter a full link starting with https://</span>}
        </div>
        <button type="submit" className="btn btn-primary"><Icon name="plus" size={18} /> Add link</button>
      </form>
      {docs.length === 0 ? (
        <Empty icon="file" title="No docs linked yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col" style={{ width: 200 }}>Added by</th>
                <th scope="col" style={{ width: 140 }}>Updated</th>
                <th scope="col" style={{ width: 56 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const m = members.find((x) => x.id === d.addedBy) ?? null;
                return (
                  <tr key={d.id}>
                    <td>
                      <a href={d.url} target="_blank" rel="noreferrer" className="row" style={{ fontWeight: 600 }}>
                        <Icon name="file" size={16} color="var(--text-muted)" /> {d.title} <Icon name="external" size={14} />
                      </a>
                    </td>
                    <td><span className="row"><Avatar member={m} /> {m?.name}</span></td>
                    <td className="muted num">{fmtDate(d.updatedAt.slice(0, 10))}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn sm"
                        aria-label={`Remove ${d.title}`}
                        onClick={() => {
                          deleteDoc(d.id);
                          toast(`"${d.title}" removed.`, { label: 'Undo', run: () => useStore.setState((s) => ({ docs: [d, ...s.docs] })) });
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
