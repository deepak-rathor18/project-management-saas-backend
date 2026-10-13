import jwt from 'jsonwebtoken';
import Organization from '../models/Organization.js';
import Project from '../models/Project.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Authentication required');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
  } catch {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  next();
});

export const loadOrganization = asyncHandler(async (req, _res, next) => {
  const organization = await Organization.findOne({
    _id: req.params.organizationId || req.params.id,
    'members.user': req.user.id
  });
  if (!organization) throw new HttpError(404, 'Organization not found');
  req.organization = organization;
  req.organizationRole = organization.members.find(
    (member) => member.user.toString() === req.user.id
  )?.role;
  next();
});

export function requireOrganizationRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.organizationRole)) {
      return next(new HttpError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
}

export const loadProject = asyncHandler(async (req, _res, next) => {
  const project = await Project.findOne({
    _id: req.params.projectId || req.params.id,
    organization: req.organization._id
  });
  if (!project) throw new HttpError(404, 'Project not found');
  const isOrgAdmin = ['OWNER', 'ADMIN'].includes(req.organizationRole);
  const isProjectMember = project.members.some((member) => member.toString() === req.user.id);
  if (!isOrgAdmin && !isProjectMember) {
    throw new HttpError(403, 'You do not have access to this project');
  }
  req.project = project;
  next();
});
