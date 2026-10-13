import Organization from '../models/Organization.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Comment from '../models/Comment.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const loadProjectAccess = asyncHandler(async (req, _res, next) => {
  const project = await Project.findById(req.params.projectId || req.params.id);
  if (!project) throw new HttpError(404, 'Project not found');
  const organization = await Organization.findOne({
    _id: project.organization,
    'members.user': req.user.id
  });
  if (!organization) throw new HttpError(404, 'Project not found');
  const role = organization.members.find((member) => member.user.toString() === req.user.id)?.role;
  const isProjectManager = ['OWNER', 'ADMIN'].includes(role) ||
    project.owner.toString() === req.user.id ||
    (project.managers || []).some((manager) => manager.toString() === req.user.id);
  const isProjectMember = project.members.some((member) => member.toString() === req.user.id);
  const hasAssignedTask = isProjectManager ? false : await Task.exists({
    organization: organization._id,
    project: project._id,
    assignee: req.user.id
  });
  const hasProjectAccess = isProjectManager || isProjectMember || Boolean(hasAssignedTask);
  if (!hasProjectAccess) throw new HttpError(403, 'You do not have access to this project');
  if (req.task && !isProjectManager && req.task.assignee?.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only access tasks assigned to you');
  }
  req.project = project;
  req.organization = organization;
  req.organizationRole = role;
  next();
});

export const loadTaskAccess = asyncHandler(async (req, _res, next) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  req.params.projectId = task.project.toString();
  req.task = task;
  next();
});

export const loadCommentAccess = asyncHandler(async (req, _res, next) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new HttpError(404, 'Comment not found');
  req.params.taskId = comment.task.toString();
  req.comment = comment;
  next();
});

export function requireProjectManager(req, _res, next) {
  const isManager = ['OWNER', 'ADMIN'].includes(req.organizationRole) ||
    req.project.owner.toString() === req.user.id ||
    (req.project.managers || []).some((manager) => manager.toString() === req.user.id);
  if (!isManager) {
    return next(new HttpError(403, 'You do not have permission to manage this project'));
  }
  next();
}
