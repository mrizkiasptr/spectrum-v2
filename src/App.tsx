import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ComingSoon, NotFound } from './pages/misc';
import { HolidayCalendarPage, MyTasksPage } from './pages/OtherPages';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage, ResetPasswordPage } from './pages/LoginPage';
import { PeoplePage } from './pages/PeoplePage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { TribePage } from './pages/TribePage';
import { BacklogTab } from './pages/project/BacklogTab';
import { DashboardTab } from './pages/project/DashboardTab';
import { DefectsTab } from './pages/project/DefectsTab';
import { DocsTab } from './pages/project/DocsTab';
import { ProjectLayout } from './pages/project/ProjectLayout';
import { ReleasesTab } from './pages/project/ReleasesTab';
import { RetroTab } from './pages/project/RetroTab';
import { SettingsTab } from './pages/project/SettingsTab';
import { SprintsTab } from './pages/project/SprintsTab';
import { SprintBoard } from './pages/sprint/SprintBoard';
import { SprintLayout } from './pages/sprint/SprintLayout';
import { SprintReport, SprintRetro, SprintReview } from './pages/sprint/SprintTabs';

const LATER: [string, string][] = [
  ['/home', 'Home'],
  ['/squad-health-check', 'Squad Health Check'],
  ['/change-requests', 'Change Request'],
  ['/work-performance', 'Work Performance'],
  ['/time-management', 'Time Management'],
  ['/employees', 'Employee'],
  ['/digital-signature', 'Digital Signature'],
  ['/admin/master-data', 'Master Data'],
  ['/admin/configuration', 'Configuration'],
];

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectBoardPage />} />
        <Route path="projects/tribe/:tribe" element={<TribePage />} />
        <Route path="projects/:projectId/sprints/:sprintId" element={<SprintLayout />}>
          <Route index element={<SprintBoard />} />
          <Route path="list" element={<Navigate to={{ pathname: '..', search: '?view=list' }} replace />} />
          <Route path="report" element={<SprintReport />} />
          <Route path="review" element={<SprintReview />} />
          <Route path="retro" element={<SprintRetro />} />
        </Route>
        <Route path="projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<DashboardTab />} />
          <Route path="dashboard" element={<Navigate to=".." replace />} />
          <Route path="backlog" element={<BacklogTab />} />
          <Route path="sprints" element={<SprintsTab />} />
          <Route path="releases" element={<ReleasesTab />} />
          <Route path="defects" element={<DefectsTab />} />
          <Route path="retro" element={<RetroTab />} />
          <Route path="docs" element={<DocsTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>
        <Route path="my-tasks" element={<MyTasksPage />} />
        <Route path="admin/holidays" element={<HolidayCalendarPage />} />
        <Route path="admin/people" element={<PeoplePage />} />
        {LATER.map(([path, title]) => (
          <Route key={path} path={path.slice(1)} element={<ComingSoon title={title} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
