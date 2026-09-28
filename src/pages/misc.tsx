import { Link } from 'react-router-dom';
import { Topbar } from '../components/AppShell';
import { Empty } from '../components/ui';

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <>
      <Topbar crumbs={[{ label: 'Not found' }]} />
      <div className="content">
        <div className="page">
          <Empty icon="search" title={`This ${what} doesn’t exist`}>
            <span>It may have been deleted, or the link is wrong.</span>
            <Link to="/projects" className="btn btn-secondary btn-md">Back to Project Board</Link>
          </Empty>
        </div>
      </div>
    </>
  );
}

/** Modules outside the Project Board scope of this release. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <Topbar crumbs={[{ label: title }]} />
      <div className="content">
        <div className="page">
          <h1 className="page-title">{title}</h1>
          <Empty icon="info" title={`${title} isn’t part of this release yet`}>
            <span>SPEctrum v2 starts with the Project Board module. Other modules move over in later releases.</span>
            <Link to="/projects" className="btn btn-secondary btn-md">Go to Project Board</Link>
          </Empty>
        </div>
      </div>
    </>
  );
}
