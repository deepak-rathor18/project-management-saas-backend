import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { loadProjectAccess, requireProjectManager } from '../middleware/projectAccess.js';
import * as projectController from '../controllers/project.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.get('/:id', loadProjectAccess, projectController.getProject);
router.put('/:id', loadProjectAccess, requireProjectManager, projectController.updateProject);
router.delete('/:id', loadProjectAccess, requireProjectManager, projectController.archiveProject);
router.post('/:id/members', loadProjectAccess, requireProjectManager, projectController.addProjectMember);
router.patch('/:id/members/:userId', loadProjectAccess, requireProjectManager, projectController.updateProjectMemberRole);
router.delete('/:id/members/:userId', loadProjectAccess, requireProjectManager, projectController.removeProjectMember);
router.get('/:id/activity', loadProjectAccess, projectController.getProjectActivity);

export default router;
