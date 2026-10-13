import { Router } from 'express';
import { authenticate, loadOrganization, requireOrganizationRole } from '../middleware/auth.js';
import * as organizationController from '../controllers/organization.controller.js';

const router = Router();
router.use(authenticate);

router.post('/', organizationController.createOrganization);
router.get('/', organizationController.listOrganizations);
router.get('/:id/dashboard', loadOrganization, organizationController.getDashboard);
router.get('/:id/activity', loadOrganization, organizationController.getOrganizationActivity);
router.get('/:id', loadOrganization, organizationController.getOrganization);
router.put('/:id', loadOrganization, requireOrganizationRole('OWNER', 'ADMIN'), organizationController.updateOrganization);
router.post('/:id/members', loadOrganization, requireOrganizationRole('OWNER', 'ADMIN'), organizationController.addOrganizationMember);
router.patch('/:id/members/:userId', loadOrganization, requireOrganizationRole('OWNER'), organizationController.updateOrganizationMemberRole);
router.delete('/:id/members/:userId', loadOrganization, requireOrganizationRole('OWNER', 'ADMIN'), organizationController.removeOrganizationMember);

export default router;
