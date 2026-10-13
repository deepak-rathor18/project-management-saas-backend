import Organization from '../models/Organization.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Activity from '../models/Activity.js';
import { asyncHandler, HttpError, requireFields, validateStringFields } from '../utils/http.js';

export const listProjects = asyncHandler(async (req, res) => {
  const organizations = await Organization.find({ 'members.user': req.user.id }).select('_id');
  const orgIds = organizations.map((organization) => organization._id);
  const isAdminOrgIds = (await Organization.find({
    _id: { $in: orgIds },
    members: { $elemMatch: { user: req.user.id, role: { $in: ['OWNER', 'ADMIN'] } } }
  }).select('_id')).map((item) => item._id);
  const assignedProjectIds = await Task.distinct('project', {
    organization: { $in: orgIds },
    assignee: req.user.id
  });
  const projects = await Project.find({
    organization: { $in: orgIds },
    $or: [
      { organization: { $in: isAdminOrgIds } },
      { owner: req.user.id },
      { members: req.user.id },
      { managers: req.user.id },
      { _id: { $in: assignedProjectIds } }
    ]
  }).populate('owner', 'name email').populate('members', 'name email').sort({ updatedAt: -1 });
  const adminOrgIds = new Set(isAdminOrgIds.map((id) => id.toString()));
  const managerProjectIds = projects
    .filter((project) => adminOrgIds.has(project.organization.toString()) ||
      project.owner.toString() === req.user.id ||
      project.managers.some((manager) => manager.toString() === req.user.id))
    .map((project) => project._id);
  const tasks = await Task.aggregate([
    {
      $match: {
        project: { $in: projects.map((project) => project._id) },
        $or: [
          { project: { $in: managerProjectIds } },
          { assignee: req.user._id || req.user.id }
        ]
      }
    },
    { $group: { _id: '$project', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } } } }
  ]);
  const counts = new Map(tasks.map((item) => [item._id.toString(), item]));
  res.json({ projects: projects.map((project) => {
    const count = counts.get(project.id) || { total: 0, completed: 0 };
    return { ...project.toObject(), taskCount: count.total, progress: count.total ? Math.round(count.completed * 100 / count.total) : 0 };
  }) });
});

export const createProject = asyncHandler(async (req, res) => {
  requireFields(req.body, ['name', 'organizationId']);
  validateStringFields(req.body, ['description']);
  const organization = await Organization.findOne({ _id: req.body.organizationId, 'members.user': req.user.id });
  if (!organization) throw new HttpError(404, 'Organization not found');
  const role = organization.members.find((member) => member.user.toString() === req.user.id)?.role;
  if (!['OWNER', 'ADMIN'].includes(role)) throw new HttpError(403, 'Only organization admins can create projects');
  const members = Array.isArray(req.body.members) ? req.body.members : [];
  if (members.some((id) => !organization.members.some((member) => member.user.toString() === id))) {
    throw new HttpError(400, 'Every project member must belong to the organization');
  }
  const project = await Project.create({
    organization: organization._id,
    name: req.body.name.trim(),
    description: req.body.description?.trim() || '',
    status: req.body.status || 'ACTIVE',
    priority: req.body.priority || 'MEDIUM',
    startDate: req.body.startDate || undefined,
    dueDate: req.body.dueDate || undefined,
    owner: req.user.id,
    members: [...new Set([req.user.id, ...members])],
    managers: [req.user.id]
  });
  await Activity.create({ organization: organization._id, project: project._id, actor: req.user.id, action: 'PROJECT_CREATED', detail: `Created project ${project.name}` });
  res.status(201).json({ project });
});

export const getProject = asyncHandler(async (req, res) => {
  await req.project.populate('owner members', 'name email');
  res.json({ project: req.project });
});

export const updateProject = asyncHandler(async (req, res) => {
  validateStringFields(req.body, ['name', 'description']);
  const editable = ['name', 'description', 'status', 'priority', 'startDate', 'dueDate'];
  for (const field of editable) {
    if (field in req.body) req.project[field] = req.body[field] || undefined;
  }
  await req.project.save();
  await req.project.populate('owner members', 'name email');
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'PROJECT_UPDATED', detail: `Updated project ${req.project.name}` });
  res.json({ project: req.project });
});

export const archiveProject = asyncHandler(async (req, res) => {
  req.project.status = 'ARCHIVED';
  await req.project.save();
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'PROJECT_ARCHIVED', detail: `Archived project ${req.project.name}` });
  res.json({ message: 'Project archived' });
});

export const addProjectMember = asyncHandler(async (req, res) => {
  requireFields(req.body, ['userId']);
  if (!req.organization.members.some((member) => member.user.toString() === req.body.userId)) {
    throw new HttpError(400, 'User must belong to the organization first');
  }
  if (!['MANAGER', 'MEMBER'].includes(req.body.role || 'MEMBER')) throw new HttpError(400, 'Role must be MANAGER or MEMBER');
  if (!req.project.members.some((member) => member.toString() === req.body.userId)) {
    req.project.members.push(req.body.userId);
  }
  req.project.managers = (req.project.managers || []).filter((manager) => manager.toString() !== req.body.userId);
  if ((req.body.role || 'MEMBER') === 'MANAGER') req.project.managers.push(req.body.userId);
  await req.project.save();
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'PROJECT_MEMBER_ADDED', detail: `Added ${req.body.role === 'MANAGER' ? 'a manager' : 'a member'} to the project` });
  await req.project.populate('owner members', 'name email');
  res.json({ project: req.project });
});

export const updateProjectMemberRole = asyncHandler(async (req, res) => {
  validateStringFields(req.body, ['role']);
  if (!['MANAGER', 'MEMBER'].includes(req.body.role)) throw new HttpError(400, 'Role must be MANAGER or MEMBER');
  if (!req.project.members.some((member) => member.toString() === req.params.userId)) {
    throw new HttpError(404, 'Project member not found');
  }
  req.project.managers = (req.project.managers || []).filter((manager) => manager.toString() !== req.params.userId);
  if (req.body.role === 'MANAGER') req.project.managers.push(req.params.userId);
  await req.project.save();
  await req.project.populate('owner members', 'name email');
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'PROJECT_MEMBER_ROLE_CHANGED', detail: 'Changed a project member role' });
  res.json({ project: req.project });
});

export const removeProjectMember = asyncHandler(async (req, res) => {
  if (req.project.owner.toString() === req.params.userId) throw new HttpError(400, 'The project owner cannot be removed');
  req.project.members = req.project.members.filter((member) => member.toString() !== req.params.userId);
  req.project.managers = (req.project.managers || []).filter((manager) => manager.toString() !== req.params.userId);
  await req.project.save();
  await Task.updateMany({ project: req.project._id, assignee: req.params.userId }, { $set: { assignee: null } });
  await Activity.create({ organization: req.organization._id, project: req.project._id, actor: req.user.id, action: 'PROJECT_MEMBER_REMOVED', detail: 'Removed a member from the project and unassigned their tasks' });
  res.json({ message: 'Member removed from the project; their assigned tasks were unassigned' });
});

export const getProjectActivity = asyncHandler(async (req, res) => {
  const activity = await Activity.find({ project: req.project._id }).populate('actor', 'name').sort({ createdAt: -1 }).limit(50);
  res.json({ activity });
});
